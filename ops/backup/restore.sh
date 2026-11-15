#!/usr/bin/env bash
#
# Put one snapshot back, and prove it landed.
#
# This is the only thing in the backup system that writes to the live database. Two
# consequences shape it:
#
#   1. It stops admin-api first. Replacing the file under a running WAL connection would
#      leave the app writing to a database that no longer exists, with a stale -wal beside
#      it. Stop, swap, start.
#   2. It takes a safety copy of the current state before touching anything, so the
#      restore is itself reversible. Restoring the wrong snapshot is a mistake people
#      make once; it should not be the last one they can recover from.
#
# The caller never waits for this: the process that would have answered the request is
# the one being stopped. It runs as a detached one-shot container.

set -euo pipefail

NAME=${1:-}
DB=${DB:-/data/tilawa-admin.sqlite}
LOCAL_DIR=${LOCAL_DIR:-/backups}
COMPOSE_FILE=${COMPOSE_FILE:-/host/docker-compose.yml}
COMPOSE_DIR=${COMPOSE_DIR:-/host}
STATUS=$LOCAL_DIR/restore-status.json
PATTERN='^tilawa-admin-[0-9]{8}T[0-9]{6}Z\.sqlite$'

die() {
  write_status failed "$1"
  echo "restore FAILED: $1" >&2
  exit 1
}

write_status() { # write_status <state> <message> [safety]
  python3 - "$STATUS" "$1" "$2" "${3:-}" "$NAME" <<'PY'
import datetime, json, os, sys

path, state, message, safety, name = sys.argv[1:6]
doc = {
    "finished_at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
    "state": state,
    "snapshot": name,
    "safety_snapshot": safety or None,
    "message": message or None,
}
tmp = path + ".tmp"
with open(tmp, "w") as handle:
    json.dump(doc, handle, indent=2)
    handle.write("\n")
os.replace(tmp, path)
PY
}

check_db() { # check_db <path> -> prints table count, fails on a bad file
  python3 - "$1" <<'PY'
import sqlite3, sys
check = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
integrity = check.execute("PRAGMA integrity_check").fetchone()[0]
if integrity != "ok":
    raise SystemExit(f"integrity={integrity}")
print(check.execute(
    "select count(*) from sqlite_master where type='table' and name not like 'sqlite_%'"
).fetchone()[0])
check.close()
PY
}

[ -n "$NAME" ] || die "no snapshot named"
echo "$NAME" | grep -Eq "$PATTERN" || die "not a snapshot name: $NAME"
[ -f "$LOCAL_DIR/$NAME" ] || die "no such snapshot: $NAME"

want=$(check_db "$LOCAL_DIR/$NAME") || die "the snapshot itself is not usable"
echo "restoring $NAME ($want tables)"

# Safety copy first, so a wrong choice is recoverable.
ts=$(date -u +%Y%m%dT%H%M%SZ)
safety="tilawa-admin-$ts.sqlite"
python3 - "$DB" "$LOCAL_DIR/$safety" <<'PY'
import sqlite3, sys
src = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
dst.close()
src.close()
PY
check_db "$LOCAL_DIR/$safety" >/dev/null || die "safety snapshot did not verify"
chmod 600 "$LOCAL_DIR/$safety" 2>/dev/null || true
echo "safety copy: $safety"

# Stop the writer, swap the file, remove the WAL that belonged to the old one.
docker compose -f "$COMPOSE_FILE" --project-directory "$COMPOSE_DIR" stop admin-api >/dev/null
python3 - "$LOCAL_DIR/$NAME" "$DB" <<'PY'
import shutil, sqlite3, sys
source, target = sys.argv[1], sys.argv[2]
# Copy through SQLite rather than `cp`: it checkpoints a consistent file and the target
# is written by the same library that will read it, not by a byte-for-byte move of a
# file that had a -wal beside it.
src = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
dst = sqlite3.connect(target)
src.backup(dst)
dst.close()
src.close()
PY
rm -f "$DB-wal" "$DB-shm"

docker compose -f "$COMPOSE_FILE" --project-directory "$COMPOSE_DIR" up -d --no-deps admin-api >/dev/null

# Wait for the health endpoint, then confirm the counts match what was restored.
for _ in $(seq 1 30); do
  if python3 - <<'PY' 2>/dev/null
import urllib.request
urllib.request.urlopen("http://open-tilawa-admin-api:9410/api/health", timeout=3).read()
PY
  then
    got=$(check_db "$DB") || die "restored database does not verify"
    if [ "$got" = "$want" ]; then
      write_status ok "restored $want tables" "$safety"
      echo "restore ok: $NAME ($got tables)"
      exit 0
    fi
    die "table count changed after restore: wanted $want, got $got"
  fi
  sleep 2
done

die "admin-api did not become healthy after the restore"
