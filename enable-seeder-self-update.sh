#!/usr/bin/env bash
# Let a seeder node update itself — one command, run on the node.
#
#   curl -fsSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/enable-seeder-self-update.sh | sudo bash
#
# What it changes: the node's compose file gains the Docker socket and three env
# values, then the node is recreated on the latest image. Nothing else on the
# host is touched, the file is backed up first, and a second run is a no-op.
#
# Why the socket: pulling an image and recreating a container is a Docker
# operation. It is done in a sibling container, because a container cannot stop
# itself and finish the job. Off until this script is run — that is the trade:
# the node's admin password becomes root on its own host.
set -euo pipefail

COMPOSE="${COMPOSE:-/opt/tilawa-seeder/docker-compose.yml}"
SERVICE="${SERVICE:-seeder}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run it with sudo: it edits ${COMPOSE} and restarts the node." >&2
  exit 1
fi
if [[ ! -f "$COMPOSE" ]]; then
  echo "No compose file at ${COMPOSE} — is this a seeder node? Set COMPOSE=/path/to/file." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to edit the compose file safely." >&2
  exit 1
fi

backup="${COMPOSE}.bak-$(date +%Y%m%d%H%M%S)"
cp "$COMPOSE" "$backup"
echo "Backed up to ${backup}"

python3 - "$COMPOSE" <<'PY'
import sys

path = sys.argv[1]
text = open(path).read()
if 'SEEDER_SELF_UPDATE' in text:
    print('self-update is already enabled')
    raise SystemExit(0)
if '\n    environment:\n' not in text or '\n    volumes:\n' not in text:
    raise SystemExit(f'{path}: expected `environment:` and `volumes:` under the service')

text = text.replace(
    '\n    environment:\n',
    '\n    environment:\n'
    '      SEEDER_SELF_UPDATE: "1"\n'
    '      SEEDER_COMPOSE_PROJECT: tilawa-seeder\n'
    f'      SEEDER_COMPOSE_HOST_FILE: {path}\n',
    1,
)
text = text.replace(
    '\n    volumes:\n',
    '\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n',
    1,
)
open(path, 'w').write(text)
print('self-update enabled')
PY

cd "$(dirname "$COMPOSE")"
docker compose config -q
echo "Pulling the latest image and recreating the node..."
docker compose pull --quiet
docker compose up -d

port="$(docker compose port "$SERVICE" 8085 | head -1 | cut -d: -f2)"
for _ in $(seq 1 30); do
  if body="$(curl -sf "http://127.0.0.1:${port}/health" 2>/dev/null)"; then
    printf '%s' "$body" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print("node", d.get("version"), "selfUpdate=", d.get("selfUpdate"), "torrents=", d.get("torrents"))
'
    echo
    echo "Done. Open http://<this-host>/${port}/ and the update button is live."
    exit 0
  fi
  sleep 2
done

echo "The node did not answer on port ${port} — check: docker logs ${SERVICE}" >&2
exit 1
