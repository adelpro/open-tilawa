#!/usr/bin/env bash
#
# Snapshot the admin catalogue and keep a copy on pharmacyserver.
#
# The catalogue (tilawa-admin.sqlite + WAL) is the only single-copy asset in
# this stack: the audio corpus is mirrored on pharmacyserver, the code is in
# git, and the console is a container. Losing this file means losing every
# recitation entry, account, alert and audit row.
#
# Why VACUUM INTO and not `cp`: the live database is in WAL mode, so the
# .sqlite file on disk is behind the -wal. Copying the two together is a race;
# VACUUM INTO runs inside SQLite and writes a consistent, compacted snapshot.
# There is no sqlite3 CLI on this host or in the image, so the work happens
# through the image's better-sqlite3 binding.
#
# Why the push is best-effort: pharmacyserver is on a link whose public IP
# changes between probes and which goes offline for hours. A run that cannot
# reach it must leave the local copy in place, say so in status.json, and try
# again next time - never report success it did not achieve.
#
# Installed by tilawa-db-backup.timer (every 2 h). Run it by hand any time.

set -euo pipefail

DB=${DB:-/data/tilawa-admin.sqlite}
LOCAL_DIR=${LOCAL_DIR:-$HOME/backups/tilawa}
REMOTE=${REMOTE:-pharmacyserver}
REMOTE_DIR=${REMOTE_DIR:-tilawa-backups}
# Several destinations, space separated, each "user@host:dir". REMOTE/REMOTE_DIR remain
# the single-target form and are used when this is unset, so an existing .env keeps working.
REMOTES=${REMOTES:-}
KEEP_RECENT_HOURS=${KEEP_RECENT_HOURS:-72}
KEEP_DAILY_DAYS=${KEEP_DAILY_DAYS:-30}
KEEP_MAX=${KEEP_MAX:-240}
STATUS=$LOCAL_DIR/status.json

# How to reach the remote. Bash array so the same options reach rsync and plain ssh;
# the key is only set when something mounted one (the runner does, the host need not).
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10)
[ -n "${SSH_KEY:-}" ] && SSH_OPTS+=(-i "$SSH_KEY" -o IdentitiesOnly=yes)
[ -n "${SSH_KNOWN_HOSTS:-}" ] && SSH_OPTS+=(-o UserKnownHostsFile="$SSH_KNOWN_HOSTS")

# Every destination, as parallel arrays so the ssh and the path stay together.
TARGET_SSH=()
TARGET_DIR=()
if [ -n "$REMOTES" ]; then
  for entry in $REMOTES; do
    TARGET_SSH+=("${entry%%:*}")
    TARGET_DIR+=("${entry#*:}")
  done
else
  TARGET_SSH+=("$REMOTE")
  TARGET_DIR+=("$REMOTE_DIR")
fi

mkdir -p "$LOCAL_DIR"

# One run at a time: a slow rsync to a flapping host must not stack up.
exec 9>"$LOCAL_DIR/.lock"
flock -n 9 || { echo "another run is in progress, skipping"; exit 0; }


# Two modes that are not a backup:
#
#   --delete <name>  remove one snapshot here and on every target. The console offers it
#                    because a wrong rotation should not need ssh to undo.
#   --check          say whether each target is reachable and writable, without taking a
#                    snapshot. What a fresh install runs before trusting the timer.
case "${1:-}" in
  --delete)
    target_name=${2:-}
    echo "$target_name" | grep -Eq '^tilawa-admin-[0-9]{8}T[0-9]{6}Z\.sqlite$' \
      || { echo "not a snapshot name: $target_name" >&2; exit 2; }
    removed_local=no
    [ -f "$LOCAL_DIR/$target_name" ] && rm -f -- "$LOCAL_DIR/$target_name" && removed_local=yes
    echo "local: $removed_local"
    for i in "${!TARGET_SSH[@]}"; do
      if ssh "${SSH_OPTS[@]}" "${TARGET_SSH[$i]}" \
           "rm -f -- ~/${TARGET_DIR[$i]}/$target_name" 2>/dev/null; then
        echo "${TARGET_SSH[$i]}: removed"
      else
        echo "${TARGET_SSH[$i]}: unreachable"
      fi
    done
    exit 0
    ;;
  --check)
    for i in "${!TARGET_SSH[@]}"; do
      if ssh "${SSH_OPTS[@]}" "${TARGET_SSH[$i]}" \
           "mkdir -p ~/${TARGET_DIR[$i]} && test -w ~/${TARGET_DIR[$i]}" 2>/dev/null; then
        echo "${TARGET_SSH[$i]}:${TARGET_DIR[$i]} ok"
      else
        echo "${TARGET_SSH[$i]}:${TARGET_DIR[$i]} FAILED"
      fi
    done
    exit 0
    ;;
esac

ts=$(date -u +%Y%m%dT%H%M%SZ)
name="tilawa-admin-$ts.sqlite"

prev_remote_ok=""
prev_remote_file=""
if [ -f "$STATUS" ]; then
  IFS='|' read -r prev_remote_ok prev_remote_file <<<"$(python3 -c '
import json,sys
try:
    d=json.load(open(sys.argv[1]))
    r=d.get("remote",{}) or {}
    print("%s|%s" % (r.get("last_ok_at") or "", r.get("last_ok_file") or ""))
except Exception:
    print("|")
' "$STATUS")"
fi

write_status() { # write_status <state> <error>
  python3 - "$STATUS" "$1" "$2" "$name" "$prev_remote_ok" "${lsha:-}" "${bytes:-0}" "$3" <<'PY'
import json, os, sys, datetime
status_path, state, error, name, prev_remote, sha, size, remote_last = sys.argv[1:9]
now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
doc = {
    "generated_at": now,
    "status": state,
    "local": {"file": name, "bytes": int(size), "sha256": sha},
    "remote": {"state": state if state != "failed" else "unknown",
               "last_ok_at": prev_remote or None,
               "last_ok_file": remote_last or None,
               "verified_at": os.environ.get("VERIFIED_AT") or None,
               "verified_error": os.environ.get("VERIFIED_ERROR") or None},
    "error": error or None,
    "targets": json.loads("[" + (os.environ.get("TARGETS_JSON") or "") + "]"),
}
tmp = status_path + ".tmp"
with open(tmp, "w") as f:
    json.dump(doc, f, indent=2)
    f.write("\n")
os.replace(tmp, status_path)
PY
}

# 1. Snapshot + verify, in one process, so a half-written dump is never kept.
#
# The database is opened read-only (the volume is mounted :ro as well, so this is a
# second belt): Connection.backup reads the source and writes a separate file, which
# means the job cannot damage what it is copying. python3's sqlite3 is the same
# backup API as VACUUM INTO, and it is the one thing every image already has.
if ! report=$(python3 - "$DB" "$LOCAL_DIR/$name" <<'PY2' 2>&1
import json, sqlite3, sys

src, dst = sys.argv[1], sys.argv[2]
try:
    source = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    target = sqlite3.connect(dst)
    source.backup(target)
    target.close()
    source.close()

    check = sqlite3.connect(dst)
    integrity = check.execute("PRAGMA integrity_check").fetchone()[0]
    tables = check.execute(
        "select count(*) from sqlite_master "
        "where type='table' and name not like 'sqlite_%'"
    ).fetchone()[0]
    check.close()
    print(json.dumps({"integrity": integrity, "tables": tables}))
except Exception as error:  # a half-written file must never be reported as a snapshot
    print(json.dumps({"integrity": f"error: {error}", "tables": 0}))
    sys.exit(1)
PY2
); then
  rm -f "$LOCAL_DIR/$name"
  write_status failed "snapshot failed: $report" ""
  echo "FAILED: $report" >&2
  exit 1
fi

integrity=$(printf '%s' "$report" | python3 -c 'import json,sys; print(json.load(sys.stdin)["integrity"])' 2>/dev/null || echo "unparsed")
tables=$(printf '%s' "$report" | python3 -c 'import json,sys; print(json.load(sys.stdin)["tables"])' 2>/dev/null || echo 0)

if [ "$integrity" != "ok" ] || [ "${tables:-0}" -lt 20 ]; then
  rm -f "$LOCAL_DIR/$name"
  write_status failed "snapshot rejected: integrity=$integrity tables=$tables" ""
  echo "FAILED: integrity=$integrity tables=$tables" >&2
  exit 1
fi

chmod 600 "$LOCAL_DIR/$name"
lsha=$(sha256sum "$LOCAL_DIR/$name" | cut -d' ' -f1)
bytes=$(stat -c%s "$LOCAL_DIR/$name")

# 3. Push to every target, then read each copy back.
#
# One destination was the shape of a single-machine backup. A list costs almost nothing
# here and means a second copy can live somewhere that is not this house.
targets_json=""
state=ok
err=""
for i in "${!TARGET_SSH[@]}"; do
  t_ssh=${TARGET_SSH[$i]}
  t_dir=${TARGET_DIR[$i]}
  t_state=pending
  t_error=""
  t_verified=""

  if rsync -az --timeout=60 -e "ssh ${SSH_OPTS[*]}" \
       --include='tilawa-admin-*.sqlite' --exclude='*' \
       "$LOCAL_DIR/" "$t_ssh:$t_dir/" 2>/dev/null; then
    if rsha=$(ssh "${SSH_OPTS[@]}" "$t_ssh" \
                "sha256sum ~/$t_dir/$name 2>/dev/null | cut -d' ' -f1" 2>/dev/null) \
       && [ "$rsha" = "$lsha" ]; then
      t_state=ok
      # The far copy is readable only if it is still a database: a checksum proves the
      # bytes arrived, not that the file at rest is intact. Read it back and open it.
      probe="$LOCAL_DIR/.verify-$ts-$i.sqlite"
      if rsync -az --timeout=60 -e "ssh ${SSH_OPTS[*]}" \
           "$t_ssh:$t_dir/$name" "$probe" 2>/dev/null; then
        verdict=$(python3 - "$probe" <<'PY3' 2>&1
import json, sqlite3, sys
try:
    check = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
    integrity = check.execute("PRAGMA integrity_check").fetchone()[0]
    tables = check.execute(
        "select count(*) from sqlite_master "
        "where type='table' and name not like 'sqlite_%'"
    ).fetchone()[0]
    check.close()
    print(json.dumps({"integrity": integrity, "tables": tables}))
except Exception as error:
    print(json.dumps({"integrity": f"error: {error}", "tables": 0}))
PY3
)
        rm -f "$probe"
        r_integrity=$(printf '%s' "$verdict" | python3 -c 'import json,sys;print(json.load(sys.stdin)["integrity"])' 2>/dev/null || echo unparsed)
        if [ "$r_integrity" = ok ]; then
          t_verified=$(date -u +%Y-%m-%dT%H:%M:%SZ)
          prev_remote_ok=$t_verified
          prev_remote_file=$name
        else
          t_state=failed
          t_error="copy at rest is not a healthy database: $r_integrity"
        fi
      else
        t_error="pushed, but could not be read back"
      fi
    else
      t_error="push landed but checksum could not be confirmed"
    fi
  else
    t_error="unreachable, local copy kept"
  fi

  # The run's verdict is the worst target's: a healthy second copy does not excuse a
  # broken first one.
  if [ "$t_state" = failed ]; then
    state=failed
  elif [ "$t_state" = pending ] && [ "$state" = ok ]; then
    state=pending
  fi
  [ -n "$t_error" ] && err="${err:+$err; }$t_ssh: $t_error"

  targets_json="$targets_json${targets_json:+,}$(python3 - "$t_ssh" "$t_dir" "$t_state" "$t_error" "$t_verified" <<'PY4'
import json, sys
print(json.dumps({"remote": sys.argv[1], "dir": sys.argv[2], "state": sys.argv[3],
                  "error": sys.argv[4] or None, "verified_at": sys.argv[5] or None}))
PY4
)"
done

# The page reads the first target as "the remote"; keep that shape for one destination
# and expose the full list beside it.
verified_at=$(printf '%s' "$targets_json" | python3 -c '
import json,sys
t=json.loads("["+sys.stdin.read()+"]")
print(next((x["verified_at"] for x in t if x.get("verified_at")), "") or "")')
verified_error=""
if [ "$state" = failed ]; then
  verified_error=$(printf '%s' "$targets_json" | python3 -c '
import json,sys
t=json.loads("["+sys.stdin.read()+"]")
print(next((x["error"] for x in t if x["state"]=="failed" and x.get("error")), ""))')
fi
export TARGETS_JSON="$targets_json"
export VERIFIED_AT="$verified_at" VERIFIED_ERROR="$verified_error" TARGETS_JSON="${TARGETS_JSON:-}"

# 4. Prune both ends, with the same rule and the same code.
#
# A count is the wrong unit for a backup: 30 snapshots every two hours is two and a
# half days, so a corruption nobody noticed for a week would leave every copy
# poisoned. The rule is time-shaped instead — keep everything from the last
# KEEP_RECENT_HOURS, then one per day for KEEP_DAILY_DAYS, and never exceed
# KEEP_MAX. The timestamp lives in the file name, so the decision needs no stat and
# works the same over ssh.
#
# Names on stdin (newest first); names to delete on stdout.
select_prunable() {
  local now recent daily kept=0 stamp day epoch
  declare -A day_seen=()
  now=$(date -u +%s)
  recent=$((now - KEEP_RECENT_HOURS * 3600))
  daily=$((now - KEEP_DAILY_DAYS * 86400))
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    stamp=${name#tilawa-admin-}
    day=${stamp:0:8}
    epoch=$(date -u -d "${stamp:0:4}-${stamp:4:2}-${stamp:6:2} ${stamp:9:2}:${stamp:11:2}:${stamp:13:2}" +%s 2>/dev/null || echo 0)
    if ((kept < KEEP_MAX)) && ((epoch >= recent)); then
      kept=$((kept + 1))
      continue
    fi
    if ((kept < KEEP_MAX)) && ((epoch >= daily)) && [ -z "${day_seen[$day]:-}" ]; then
      day_seen[$day]=1
      kept=$((kept + 1))
      continue
    fi
    echo "$name"
  done
}

prune() { # prune <end-label> <names-command> [remote-dir]
  local end=$1 names_cmd=$2 t_dir=${3:-} names pruned
  names=$(eval "$names_cmd" | sort -r) || return 0
  pruned=$(printf '%s\n' "$names" | select_prunable)
  [ -n "$pruned" ] || return 0
  if [ "$end" = local ]; then
    printf '%s\n' "$pruned" | while IFS= read -r name; do
      rm -f -- "$LOCAL_DIR/$name"
    done
  else
    local t_ssh=${end#remote }
    printf '%s\n' "$pruned" | ssh "${SSH_OPTS[@]}" "$t_ssh" \
      "cd ~/$t_dir && xargs -r rm -f --" 2>/dev/null || return 0
  fi
  echo "pruned $(printf '%s\n' "$pruned" | wc -l) on $end ($KEEP_RECENT_HOURS h full, then daily for $KEEP_DAILY_DAYS d)"
}

prune local "ls -1 '$LOCAL_DIR'/tilawa-admin-*.sqlite 2>/dev/null | xargs -r -n1 basename"

# The remote is pruned whether or not this run's push landed: an unreachable host
# fails here silently and is retried next run, but a reachable one should not keep
# growing because one rsync timed out.
for i in "${!TARGET_SSH[@]}"; do
  prune "remote ${TARGET_SSH[$i]}" "ssh ${SSH_OPTS[*]} '${TARGET_SSH[$i]}' 'ls -1 ~/${TARGET_DIR[$i]}/tilawa-admin-*.sqlite 2>/dev/null | xargs -r -n1 basename' 2>/dev/null" "${TARGET_DIR[$i]}"
done


write_status "$state" "$err" "$prev_remote_file"
echo "backup $name: integrity=ok tables=$tables bytes=$bytes remote=$state${err:+ ($err)}"
