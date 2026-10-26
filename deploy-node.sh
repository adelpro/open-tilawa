#!/usr/bin/env bash
# Tilawa Node Deployment Script
# Usage: curl -sSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh | bash -s -- --type seeder
#   or:  bash deploy-node.sh --type turn --port 3478
set -euo pipefail

# Defaults
TYPE="${TYPE:-seeder}"
PORT="${PORT:-8085}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-}"
TURN_REALM="${TURN_REALM:-turn.quran.us.kg}"
TURN_USER="${TURN_USER:-opentilawa}"
TURN_PASS="${TURN_PASS:-}"

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
    mkdir -p /opt/tilawa-seeder/data
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
      # 0 = unlimited; the node enforces whatever is set here, before it downloads.
      DISK_QUOTA_GB: ${DISK_QUOTA_GB:-0}
      UPLOAD_LIMIT_KBPS: ${UPLOAD_LIMIT_KBPS:-0}
      DOWNLOAD_LIMIT_KBPS: ${DOWNLOAD_LIMIT_KBPS:-0}
      ADMIN_UI: ${ADMIN_UI:-1}
    volumes:
      - /opt/tilawa-seeder/data:/data/torrents
    restart: unless-stopped
EOF
    cd /opt/tilawa-seeder
    docker compose pull
    docker compose up -d
    echo ""
    echo "=== Seeder deployed ==="
    echo "Admin UI:  http://$(hostname -I | awk '{print $1}'):${PORT}"
    echo "Health:    http://$(hostname -I | awk '{print $1}'):${PORT}/health"
    echo "Username:  ${ADMIN_USER}"
    echo "Password:  ${ADMIN_PASS}"
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
