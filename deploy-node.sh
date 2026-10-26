#!/usr/bin/env bash
# Tilawa Node Deployment Script
# Usage: curl -sSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh | bash -s -- --type seeder
#   or:  bash deploy-node.sh --type turn --port 3478
#   or:  bash deploy-node.sh --type seeder --disk 500 --upload-kbps 20000 --watchtower
set -euo pipefail

# Defaults
TYPE="${TYPE:-seeder}"
PORT="${PORT:-8085}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-}"
TURN_REALM="${TURN_REALM:-turn.quran.us.kg}"
TURN_USER="${TURN_USER:-opentilawa}"
TURN_PASS="${TURN_PASS:-}"
# Empty means "no cap": the node reports its headroom and the dashboard plans
# against it. A number caps the node at that many gigabytes.
DISK_GB="${DISK_GB:-}"
UPLOAD_KBPS="${UPLOAD_KBPS:-0}"
DOWNLOAD_KBPS="${DOWNLOAD_KBPS:-0}"
ADMIN_UI="${ADMIN_UI:-1}"

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
    --watchtower) WATCHTOWER=1; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# The seeder refuses to start without a real password: its admin API can add and
# delete torrents. Generate one when the operator did not supply one.
if [[ "$TYPE" == "seeder" && -z "$ADMIN_PASS" ]]; then
  ADMIN_PASS="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"
  echo "Generated ADMIN_PASS for this node: $ADMIN_PASS"
  echo "Store it now — the dashboard needs it to manage the node."
fi

echo "=== Tilawa Node Deployer ==="
echo "Type: $TYPE"
echo "Port: $PORT"
echo ""

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

    cat > /opt/tilawa-seeder/docker-compose.yml <<EOF
services:
  seeder:
    image: ghcr.io/adelpro/open-tilawa-seeder:latest
    container_name: tilawa-seeder
    ports:
      - "0.0.0.0:${PORT}:8085"
    environment:
      ADMIN_PORT: 8085
      ADMIN_USER: ${ADMIN_USER}
      ADMIN_PASS: ${ADMIN_PASS}
      # Torrents and audio are two volumes: a .torrent is metadata the node can
      # rebuild, the audio is gigabytes it cannot re-fetch cheaply. Both live
      # outside the container so a recreate (or a Watchtower update) keeps them.
      DOWNLOAD_PATH: /data/downloads
      # 0 = unlimited; the node enforces whatever is set here, before it downloads.
      DISK_QUOTA_GB: ${DISK_GB}
      UPLOAD_LIMIT_KBPS: ${UPLOAD_KBPS}
      DOWNLOAD_LIMIT_KBPS: ${DOWNLOAD_KBPS}
      ADMIN_UI: ${ADMIN_UI}
    volumes:
      - ${DATA_ROOT}/data:/data/torrents
      - ${DATA_ROOT}/downloads:/data/downloads
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
    echo ""
    echo "=== Seeder deployed ==="
    echo "Admin UI:  http://$(hostname -I | awk '{print $1}'):${PORT}"
    echo "Health:    http://$(hostname -I | awk '{print $1}'):${PORT}/health"
    echo "Username:  ${ADMIN_USER}"
    echo "Password:  ${ADMIN_PASS}"
    echo "${QUOTA_LINE}"
    if (( DISK_GB == 0 )); then
      echo "Cap it later: edit DISK_QUOTA_GB in /opt/tilawa-seeder/docker-compose.yml, then:"
      echo "  cd /opt/tilawa-seeder && docker compose up -d"
    fi
    echo ""
    echo "=== Next step ==="
    echo "Add this seeder to your dashboard:"
    echo "  1. Go to https://admin-tilawa.quran.us.kg"
    echo "  2. Navigate to Seeders"
    echo "  3. Click 'Add Seeder'"
    echo "  4. Name: $(hostname)"
    echo "  5. URL:  http://$(hostname -I | awk '{print $1}'):${PORT}"
    ;;

  turn)
    echo ""
    echo "=== Deploying TURN Server ==="
    if ! command -v coturn &>/dev/null; then
      echo "Installing coturn..."
      sudo apt-get update && sudo apt-get install -y coturn
    fi

    # Get public IP
    PUBLIC_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
    echo "Public IP: $PUBLIC_IP"

    # Generate TURN password if not provided
    if [ -z "$TURN_PASS" ]; then
      TURN_PASS=$(openssl rand -base64 24)
      echo "Generated TURN password: $TURN_PASS"
    fi

    sudo tee /etc/turnserver.conf > /dev/null <<EOF
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=$PUBLIC_IP
external-ip=$PUBLIC_IP
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

    sudo systemctl enable coturn
    sudo systemctl restart coturn

    # Open firewall ports
    if command -v ufw &>/dev/null; then
      sudo ufw allow 3478/tcp
      sudo ufw allow 3478/udp
      sudo ufw allow 5349/tcp
      sudo ufw allow 5349/udp
      sudo ufw allow 49160:49200/udp
    fi

    echo ""
    echo "=== TURN deployed ==="
    echo "TURN URL:  turn:$PUBLIC_IP:3478"
    echo "Username:  $TURN_USER"
    echo "Password:  $TURN_PASS"
    echo "Realm:     $TURN_REALM"
    echo ""
    echo "=== Next step ==="
    echo "Add this TURN server to your dashboard:"
    echo "  1. Go to https://admin-tilawa.quran.us.kg"
    echo "  2. Navigate to TURN Servers"
    echo "  3. Click 'Add TURN Server'"
    echo "  4. Name: $(hostname)-turn"
    echo "  5. URL:  turn:$PUBLIC_IP:3478"
    ;;

  *)
    echo "Unknown type: $TYPE (use 'seeder' or 'turn')"
    exit 1
    ;;
esac

echo ""
echo "=== Persistence (systemd) ==="
echo "To make services start on boot, run:"
echo "  sudo systemctl enable docker"
echo "  sudo systemctl start docker"
echo ""
echo "For the cloudflared tunnel (dashboard access), create a systemd service:"
echo "  sudo cp /home/adelpro/.cloudflared/tilawa-admin.service /etc/systemd/system/tilawa-admin-tunnel.service"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable tilawa-admin-tunnel"
echo "  sudo systemctl start tilawa-admin-tunnel"
echo ""
echo "For TURN servers (coturn):"
echo "  sudo systemctl enable coturn"
echo "  sudo systemctl start coturn"
echo ""
echo "Docker containers auto-restart via 'restart: unless-stopped' in docker-compose.yml."
echo ""
echo "Done!"
