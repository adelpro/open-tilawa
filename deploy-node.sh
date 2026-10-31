#!/usr/bin/env bash
# Tilawa Node Deployment Script
# Usage: curl -sSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh | bash -s -- --type seeder
#   or:  bash deploy-node.sh --type turn --port 3478
#   or:  bash deploy-node.sh --type seeder --disk 500 --upload-kbps 20000 --watchtower
#   or:  bash deploy-node.sh --type seeder --self-update   # the console may update it
set -euo pipefail

# Defaults
TYPE="${TYPE:-seeder}"
PORT="${PORT:-8085}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-}"
TURN_REALM="${TURN_REALM:-turn.tilawah.cc}"
TURN_USER="${TURN_USER:-opentilawa}"
TURN_PASS="${TURN_PASS:-}"
# Empty means "no cap": the node reports its headroom and the console plans
# against it. A number caps the node at that many gigabytes.
DISK_GB="${DISK_GB:-}"
UPLOAD_KBPS="${UPLOAD_KBPS:-0}"
DOWNLOAD_KBPS="${DOWNLOAD_KBPS:-0}"
ADMIN_UI="${ADMIN_UI:-1}"
# Inbound peer port. Published because a node that only dials out is invisible
# to peers that cannot reach it.
PEER_PORT="${PEER_PORT:-6881}"
# Off by default: with it on, the node accepts "update yourself" from the console
# and runs `docker compose pull && up -d` through the host daemon. That is root on
# this host behind the node's admin password, so the operator opts in.
SELF_UPDATE="${SELF_UPDATE:-0}"

# Kept because the parse loop shifts everything away, and the root guard has to
# print the invocation it actually received.
ORIG_ARGS=("$@")

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --type) TYPE="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --admin-user) ADMIN_USER="$2"; shift 2 ;;
    --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
    --turn-realm) TURN_REALM="$2"; shift 2 ;;
    --turn-user) TURN_USER="$2"; shift 2 ;;
    --turn-pass) TURN_PASS="$2"; shift 2 ;;
    --disk) DISK_GB="$2"; shift 2 ;;
    --upload-kbps) UPLOAD_KBPS="$2"; shift 2 ;;
    --download-kbps) DOWNLOAD_KBPS="$2"; shift 2 ;;
    --admin-ui) ADMIN_UI="$2"; shift 2 ;;
    --peer-port) PEER_PORT="$2"; shift 2 ;;
    --watchtower) WATCHTOWER=1; shift ;;
    --self-update) SELF_UPDATE=1; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Everything below writes under /opt and, on a bare host, installs packages. A
# piped script cannot elevate itself reliably (bash already owns stdin), so refuse
# here with the exact line that works — instead of printing "Docker already
# installed" and dying at mkdir with a message that reads like partial success.
if [[ "$(id -u)" -ne 0 ]]; then
  RUN_ARGS=" --type ${TYPE}"
  if (( ${#ORIG_ARGS[@]} > 0 )); then
    RUN_ARGS="$(printf ' %q' "${ORIG_ARGS[@]}")"
  fi
  echo "This installer needs root: it writes under /opt and may install Docker." >&2
  echo "Re-run it with sudo:" >&2
  echo "  curl -fsSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh | sudo bash -s${RUN_ARGS}" >&2
  exit 1
fi

# The seeder refuses to start without a real password: its admin API can add and
# delete torrents. Generate one when the operator did not supply one.
if [[ "$TYPE" == "seeder" && -z "$ADMIN_PASS" ]]; then
  ADMIN_PASS="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"
  echo "Generated ADMIN_PASS for this node: $ADMIN_PASS"
  echo "Store it now — the console needs it to manage the node."
fi

echo "=== Tilawa Node Deployer ==="
echo "Type: $TYPE"
echo "Port: $PORT"
echo ""

# A node is one host, and Docker's own failure ("port is already allocated")
# arrives only after the image pull and names nothing. Ask the kernel first, then
# name the container holding it.
port_busy() { # proto port
  command -v ss >/dev/null 2>&1 || return 1
  if [[ "$1" == "udp" ]]; then
    ss -lunH "sport = :$2" 2>/dev/null | grep -q .
  else
    ss -ltnH "sport = :$2" 2>/dev/null | grep -q .
  fi
}

port_owner() { # port -> the container publishing it, if any
  # A bare host has no Docker yet, and `set -e` would abort on that instead of
  # printing the conflict.
  command -v docker >/dev/null 2>&1 || return 0
  docker ps --filter "publish=$1" --format '{{.Names}}' 2>/dev/null | head -1 || true
}

require_port() { # proto port what remedy
  port_busy "$1" "$2" || return 0
  local owner
  owner="$(port_owner "$2")"
  # This node's own container: re-running the script to change --disk, --watchtower
  # or a bandwidth cap is the documented update path, and `compose up` replaces it.
  [[ "$owner" == "tilawa-seeder" ]] && return 0
  echo "Port $2/$1 ($3) is already taken${owner:+ by container '$owner'}." >&2
  echo "$4" >&2
  exit 1
}

# The address to store in the console. A tailnet name survives a new DHCP lease on
# the LAN and a new address from the ISP; a bare IP survives neither.
TAILNET_NAME=""
if command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
  TAILNET_NAME="$(tailscale status --json --peers=false 2>/dev/null \
    | sed -n 's/.*"DNSName": *"\([^"]*\)".*/\1/p' | head -1 || true)"
  TAILNET_NAME="${TAILNET_NAME%.}"
fi

HOST_IP="$(ip route get 1.1.1.1 2>/dev/null \
  | awk '{ for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit } }' || true)"
HOST_IP="${HOST_IP:-$(hostname -I | awk '{print $1}')}"

# Prints the four values the console asks for, in the order the form asks for
# them. The URL line prefers the tailnet name and says why.
console_block() { # port
  echo "=== Add to the console ==="
  echo "Name:     $(hostname)"
  if [[ -n "$TAILNET_NAME" ]]; then
    echo "URL:      http://${TAILNET_NAME}:$1   (tailnet — survives IP changes)"
    echo "LAN only: http://${HOST_IP}:$1"
  else
    echo "URL:      http://${HOST_IP}:$1"
    echo ""
    echo "That address breaks when this machine's IP changes. Install Tailscale here"
    echo "and on the console host, then use the node's MagicDNS name instead:"
    echo "  tailscale up        # then: tailscale status --json | grep DNSName"
  fi
  echo "User:     ${ADMIN_USER}"
  echo "Password: ${ADMIN_PASS}"
}

# --- Install Docker (if not present) ---
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. You may need to log out and back in for group changes."
else
  echo "Docker already installed: $(docker --version)"
fi

# --- Install docker-compose plugin (if not present) ---
if ! docker compose version &>/dev/null; then
  echo "Installing docker-compose plugin..."
  sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi

# --- Deploy based on type ---
case "$TYPE" in
  seeder)
    echo ""
    echo "=== Deploying Seeder Node ==="
    # Before anything is written or pulled: the two published ports decide whether
    # this can work at all, and the fix (another host, or other ports) is cheaper
    # to apply now than after a failed `compose up`.
    require_port tcp "$PORT" "admin API" \
      "Pass --port with a free port, or remove the node already using it."
    require_port tcp "$PEER_PORT" "peer port" \
      "This host already runs a seeder: use another machine, or pass --peer-port with a free port."
    require_port udp "$PEER_PORT" "peer port" \
      "This host already runs a seeder: use another machine, or pass --peer-port with a free port."
    DATA_ROOT="/opt/tilawa-seeder"
    mkdir -p "$DATA_ROOT/data" "$DATA_ROOT/downloads"

    # Quota: unlimited unless the operator asks for a cap. A cap larger than the
    # disk is not a policy choice, so that is the one case worth refusing.
    FREE_GB="$(df -BG --output=avail "$DATA_ROOT" | tail -1 | tr -dc '0-9')"
    if [[ -n "$DISK_GB" ]]; then
      if ! [[ "$DISK_GB" =~ ^[0-9]+$ ]] || (( DISK_GB < 1 )); then
        echo "--disk expects a whole number of gigabytes (got '$DISK_GB')" >&2
        exit 1
      fi
      if (( DISK_GB > FREE_GB )); then
        echo "--disk ${DISK_GB} GB exceeds the ${FREE_GB} GB free on ${DATA_ROOT}" >&2
        exit 1
      fi
      QUOTA_LINE="Disk quota: ${DISK_GB} GB of ${FREE_GB} GB free"
    else
      DISK_GB=0
      QUOTA_LINE="Disk quota: unlimited — ${FREE_GB} GB free, the node will fill the disk"
    fi

    # Self-update needs the host daemon, and only that: the recreate runs in a
    # sibling container, because a container cannot stop itself and finish. The
    # socket is mounted only when asked for — it makes the node's admin password
    # root on this host, which is a decision, not a default.
    SELF_UPDATE_ENV=""
    SELF_UPDATE_MOUNTS=""
    if [[ "${SELF_UPDATE}" == "1" ]]; then
      SELF_UPDATE_ENV=$'\n      SEEDER_SELF_UPDATE: "1"\n      SEEDER_COMPOSE_PROJECT: tilawa-seeder\n      SEEDER_COMPOSE_HOST_FILE: /opt/tilawa-seeder/docker-compose.yml'
      SELF_UPDATE_MOUNTS=$'\n      - /var/run/docker.sock:/var/run/docker.sock'
    fi

    cat > /opt/tilawa-seeder/docker-compose.yml <<EOF
services:
  seeder:
    image: ghcr.io/adelpro/open-tilawa-seeder:latest
    container_name: tilawa-seeder
    ports:
      - "0.0.0.0:${PORT}:8085"
      # Inbound peers — the node binds TORRENT_PORT, so publishing it is what
      # lets peers dial in instead of waiting for the node to dial them.
      - "${PEER_PORT}:${PEER_PORT}/tcp"
      - "${PEER_PORT}:${PEER_PORT}/udp"
    environment:
      ADMIN_PORT: 8085
      ADMIN_USER: ${ADMIN_USER}
      ADMIN_PASS: ${ADMIN_PASS}
      TORRENT_PORT: ${PEER_PORT}
      # Torrents and audio are two volumes: a .torrent is metadata the node can
      # rebuild, the audio is gigabytes it cannot re-fetch cheaply. Both live
      # outside the container so a recreate (or a Watchtower update) keeps them.
      DOWNLOAD_PATH: /data/downloads
      # 0 = unlimited; the node enforces whatever is set here, before it downloads.
      DISK_QUOTA_GB: ${DISK_GB}
      UPLOAD_LIMIT_KBPS: ${UPLOAD_KBPS}
      DOWNLOAD_LIMIT_KBPS: ${DOWNLOAD_KBPS}
      ADMIN_UI: ${ADMIN_UI}${SELF_UPDATE_ENV}
    volumes:
      - ${DATA_ROOT}/data:/data/torrents
      - ${DATA_ROOT}/downloads:/data/downloads${SELF_UPDATE_MOUNTS}
    restart: unless-stopped
    labels:
      com.centurylinklabs.watchtower.enable: "true"
EOF

# Opt-in remote updates: watchtower pulls the published image and recreates the
# node. Label-scoped, so it never touches anything else on the host.
if [[ "${WATCHTOWER:-0}" == "1" ]]; then
  cat >> /opt/tilawa-seeder/docker-compose.yml <<EOF

  watchtower:
    image: containrrr/watchtower:latest
    container_name: tilawa-watchtower
    command: --label-enable --interval 600 --cleanup
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
EOF
fi
    cd /opt/tilawa-seeder
    docker compose pull
    docker compose up -d

    # `compose up -d` exits 0 even when the container starts and dies a second
    # later, so ask the node itself before calling it deployed.
    HEALTH_OK=""
    for _ in $(seq 1 30); do
      if curl -sf -u "${ADMIN_USER}:${ADMIN_PASS}" \
        "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
        HEALTH_OK=1
        break
      fi
      sleep 1
    done
    if [[ -z "$HEALTH_OK" ]]; then
      echo "Seeder did not answer on 127.0.0.1:${PORT} within 30s. Last log lines:" >&2
      docker compose logs --tail 30 seeder >&2 || true
      exit 1
    fi

    echo ""
    echo "=== Seeder deployed ==="
    echo "Admin UI:  http://${HOST_IP}:${PORT}"
    echo "Health:    http://${HOST_IP}:${PORT}/health  (answering)"
    echo "Username:  ${ADMIN_USER}"
    echo "Password:  ${ADMIN_PASS}"
    echo "${QUOTA_LINE}"
    if (( DISK_GB == 0 )); then
      echo "Cap it later: edit DISK_QUOTA_GB in /opt/tilawa-seeder/docker-compose.yml, then:"
      echo "  cd /opt/tilawa-seeder && docker compose up -d"
    fi
    echo ""
    echo "=== Open the peer port ==="
    echo "The node is only a seeder for peers that can dial it. Two ports matter:"
    printf '  %-22s %s\n' "${PEER_PORT}/tcp + ${PEER_PORT}/udp" \
      "public — forward and allow these"
    printf '  %-22s %s\n' "${PORT}/tcp" \
      "private — the console's admin API, keep it closed"
    echo ""
    if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
      echo "ufw is active on this host. Allow the peer port:"
      echo "  sudo ufw allow ${PEER_PORT}/tcp"
      echo "  sudo ufw allow ${PEER_PORT}/udp"
      echo "Do not add a rule for ${PORT}."
    else
      echo "No active ufw on this host. Open ${PEER_PORT}/tcp and ${PEER_PORT}/udp on"
      echo "whatever firewall fronts it (cloud security group, nftables, ...)."
      echo "Note: with no firewall, ${PORT}/tcp is reachable from anywhere that can route"
      echo "here. Put the node on the tailnet, or firewall that port to the console."
    fi
    echo "On the router: forward ${PEER_PORT}/tcp and ${PEER_PORT}/udp to ${HOST_IP}."
    echo ""
    echo "=== Test it ==="
    echo "Local (must answer):"
    echo "  curl -u ${ADMIN_USER}:${ADMIN_PASS} http://127.0.0.1:${PORT}/health"
    echo "From outside this network (must connect):"
    echo "  nc -vz <public-ip> ${PEER_PORT}"
    echo "If nc times out, the forward or the firewall rule is missing — peers will"
    echo "not reach this node until it connects."
    echo ""
    echo "Console → Seeders → Add seeder. Paste these four values:"
    echo ""
    console_block "$PORT"
    ;;

  turn)
    echo ""
    echo "=== Deploying TURN Server ==="
    require_port udp 3478 "STUN/TURN" \
      "Another TURN or STUN server is already running here. Stop it first."
    require_port tcp 3478 "STUN/TURN" \
      "Another TURN or STUN server is already running here. Stop it first."
    require_port tcp 5349 "TURN over TLS" \
      "Another TURN server is already running here. Stop it first."

    if ! command -v coturn &>/dev/null; then
      echo "Installing coturn..."
      apt-get update && apt-get install -y coturn
    fi

    # relay-ip must be the address peers see. A private address here makes every
    # allocation unusable, so say so rather than writing it silently.
    PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null \
      || hostname -I | awk '{print $1}')
    echo "Public IP: $PUBLIC_IP"
    if [[ "$PUBLIC_IP" =~ ^(10\.|127\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.) ]]; then
      echo "Warning: $PUBLIC_IP is a private address. coturn needs the public one;" >&2
      echo "relay will fail from outside until relay-ip/external-ip are corrected." >&2
    fi

    # Generate TURN password if not provided
    if [ -z "$TURN_PASS" ]; then
      TURN_PASS=$(openssl rand -base64 24)
      echo "Generated TURN password: $TURN_PASS"
    fi

    # min/max-port must match the relay range opened below. coturn's default range
    # is 49152-65535, so a firewall rule for 49160-49200 without these two lines
    # lets the allocation pick a port the firewall drops.
    tee /etc/turnserver.conf > /dev/null <<EOF
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=$PUBLIC_IP
external-ip=$PUBLIC_IP
min-port=49160
max-port=49200
realm=$TURN_REALM
server-name=$TURN_REALM
user=$TURN_USER:$TURN_PASS
lt-cred-mech
fingerprint
no-multicast-peers
no-cli
no-tlsv1
no-tlsv1_1
EOF

    systemctl enable coturn
    systemctl restart coturn

    # "restarted" is not "running": a bad config makes coturn exit immediately.
    if ! systemctl is-active --quiet coturn; then
      echo "coturn did not stay up. Last log lines:" >&2
      journalctl -u coturn -n 20 --no-pager >&2 || true
      exit 1
    fi

    # Open firewall ports
    if command -v ufw &>/dev/null; then
      ufw allow 3478/tcp
      ufw allow 3478/udp
      ufw allow 5349/tcp
      ufw allow 49160:49200/udp
    fi

    echo ""
    echo "=== TURN deployed ==="
    echo "TURN URL:  turn:$PUBLIC_IP:3478"
    echo "Username:  $TURN_USER"
    echo "Password:  $TURN_PASS"
    echo "Realm:     $TURN_REALM"
    echo ""
    echo "=== Ports ==="
    printf '  %-22s %s\n' "3478/udp + 3478/tcp" "public — STUN/TURN"
    printf '  %-22s %s\n' "5349/tcp" "public — TURN over TLS"
    printf '  %-22s %s\n' "49160-49200/udp" "public — relay range (matches min/max-port)"
    echo ""
    echo "A TURN server must be reachable from the internet: do not put it behind"
    echo "Tailscale. The console and the seeder can use the tailnet; this cannot."
    echo "Open the four rules above on the host and in the cloud firewall, and forward"
    echo "them on the router if the host is behind one."
    echo ""
    echo "Console → TURN servers → Add. Paste these four values:"
    echo ""
    echo "Name:     $(hostname)-turn"
    echo "URL:      turn:$PUBLIC_IP:3478"
    echo "User:     $TURN_USER"
    echo "Password: $TURN_PASS"
    ;;

  *)
    echo "Unknown type: $TYPE (use 'seeder' or 'turn')"
    exit 1
    ;;
esac

# Only print the persistence steps that belong to the node just deployed. A
# seeder host has no coturn and no tunnel; a TURN host has no container.
echo ""
case "$TYPE" in
  seeder)
    echo "=== Persistence ==="
    echo "The seeder restarts with Docker: 'restart: unless-stopped' is in"
    echo "/opt/tilawa-seeder/docker-compose.yml, and Docker starts on boot by default."
    echo "If this host has it disabled:"
    echo "  sudo systemctl enable --now docker"
    echo ""
    echo "Manage it:"
    echo "  cd /opt/tilawa-seeder && sudo docker compose ps"
    echo "  sudo docker logs -f tilawa-seeder"
    ;;
  turn)
    echo "=== Persistence ==="
    echo "coturn was enabled and started above."
    echo "  sudo systemctl status coturn"
    ;;
esac
echo ""
echo "Done!"
