#!/usr/bin/env bash
#
# Set up — or reconfigure — the catalogue backups on a deployment.
#
# The README version of this is four files and a timer. That is fine once and awful on the
# third machine, which is what this script is for: it writes the destinations, checks each
# one is reachable and writable, installs the timer, and takes the first snapshot.
#
#   ./ops/backup/install.sh --remote adelpro@host-a:tilawa-backups
#   ./ops/backup/install.sh --remote adelpro@host-a:tilawa-backups --remote adelpro@host-b:backups
#   ./ops/backup/install.sh --status
#
# Re-running it replaces the destination list; it never touches existing snapshots.

set -euo pipefail

PROJECT_DIR=${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}
ENV_FILE="$PROJECT_DIR/.env"
UNIT_DIR=${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user
# A non-login shell (ssh, cron, an agent) has no session bus address, and `systemctl
# --user` then fails with "Failed to connect to bus" even though linger is on.
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
export DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}
RETENTION_FILE=${XDG_CONFIG_HOME:-$HOME/.config}/tilawa-backup.env
REMOTES=""
DO_STATUS=no

while [ $# -gt 0 ]; do
  case "$1" in
    --remote) REMOTES="${REMOTES:+$REMOTES }$2"; shift 2 ;;
    --remote=*) REMOTES="${REMOTES:+$REMOTES }${1#--remote=}"; shift ;;
    --status) DO_STATUS=yes; shift ;;
    -h|--help)
      sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

compose() {
  docker compose -f "$PROJECT_DIR/docker-compose.yml" --project-directory "$PROJECT_DIR" \
    --profile ops "$@"
}

if [ "$DO_STATUS" = yes ]; then
  echo "== current destinations =="
  grep -E '^REMOTES=' "$ENV_FILE" 2>/dev/null || echo "(none configured)"
  echo "== reachability =="
  compose run --rm --no-deps backup --check || true
  echo "== last run =="
  BACKUP_HOST_DIR="${BACKUP_HOST_DIR:-/home/adelpro/backups/tilawa}" python3 - "$PROJECT_DIR" <<'PY'
import json, os, sys
path = os.path.join(os.environ.get("BACKUP_HOST_DIR", "/home/adelpro/backups/tilawa"), "status.json")
try:
    doc = json.load(open(path))
except OSError:
    print("no status.json yet")
else:
    print("status:", doc.get("status"))
    for target in doc.get("targets", []):
        print(f"  {target['remote']} -> {target['state']}")
PY
  exit 0
fi

[ -n "$REMOTES" ] || { echo "nothing to do: pass --remote user@host:dir (or --status)" >&2; exit 2; }

# Validate the shape before writing it anywhere: a typo here fails at 2 a.m. inside a
# timer, where nobody reads the output.
for entry in $REMOTES; do
  echo "$entry" | grep -Eq '^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+:[~/A-Za-z0-9._/-]+$' \
    || { echo "bad destination: $entry (want user@host:dir)" >&2; exit 2; }
done

echo "== writing destinations =="
# Replace the line if present, append otherwise. One line, because a second REMOTES line
# would be silently ignored - the same trap ADMIN_CORS_ORIGIN fell into.
python3 - "$ENV_FILE" "$REMOTES" <<'PY'
import os, re, sys

path, value = sys.argv[1], sys.argv[2]
lines = open(path).read().splitlines() if os.path.exists(path) else []
out, replaced = [], False
for line in lines:
    if line.startswith("REMOTES="):
        out.append(f"REMOTES={value}")
        replaced = True
    else:
        out.append(line)
if not replaced:
    out.append("")
    out.append("# Catalogue backup destinations, space separated: user@host:dir")
    out.append(f"REMOTES={value}")
open(path, "w").write("\n".join(out) + "\n")
print(f"REMOTES={value}")
PY

echo "== retention =="
if [ ! -f "$RETENTION_FILE" ]; then
  mkdir -p "$(dirname "$RETENTION_FILE")"
  cat >"$RETENTION_FILE" <<'EOF'
# Keep every snapshot from this window, then one per day, capped at KEEP_MAX.
KEEP_RECENT_HOURS=72
KEEP_DAILY_DAYS=30
KEEP_MAX=240
EOF
  echo "wrote $RETENTION_FILE"
else
  echo "kept $RETENTION_FILE"
fi

echo "== checking each destination =="
compose run --rm --no-deps backup --check | tee /tmp/tilawa-backup-check.$$
if grep -q FAILED /tmp/tilawa-backup-check.$$; then
  rm -f /tmp/tilawa-backup-check.$$
  echo "at least one destination failed; fix it before relying on the timer" >&2
  exit 1
fi
rm -f /tmp/tilawa-backup-check.$$

echo "== installing the timer =="
mkdir -p "$UNIT_DIR"
cat >"$UNIT_DIR/tilawa-db-backup.service" <<EOF
[Unit]
Description=Snapshot the tilawa admin SQLite catalogue and push it to the configured targets
After=docker.service

[Service]
Type=oneshot
EnvironmentFile=-%h/.config/tilawa-backup.env
ExecStart=/usr/bin/docker compose -f $PROJECT_DIR/docker-compose.yml --project-directory $PROJECT_DIR --profile ops run --rm --no-deps backup
TimeoutStartSec=600
EOF

cat >"$UNIT_DIR/tilawa-db-backup.timer" <<'EOF'
[Unit]
Description=Every 2 hours, snapshot the tilawa catalogue and sync it to its targets

[Timer]
OnCalendar=*-*-* 0/2:07:00
Persistent=true
RandomizedDelaySec=180
AccuracySec=1min

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now tilawa-db-backup.timer
echo "timer: $(systemctl --user list-timers tilawa-db-backup.timer --no-pager | sed -n 2p)"

echo "== first snapshot =="
compose run --rm --no-deps backup | tail -1
echo
echo "done. Run now / delete / restore are in the console at /console/backups."
