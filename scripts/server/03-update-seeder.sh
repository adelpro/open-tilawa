#!/usr/bin/env bash
# Phase 4: Update seeder to seed all 10 curated reciters
# Run on server: bash 03-update-seeder.sh

set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/adelpro/code/open-tilawa}"
TORRENT_DIR="${TORRENT_DIR:-/data/torrents}"
SEEDER_DIR="${SEEDER_DIR:-$REPO_DIR/apps/seeder}"

echo "=== Current seeder state ==="
cat "$SEEDER_DIR/seed.mjs" 2>/dev/null | head -40 || echo "seed.mjs not found"

echo ""
echo "=== Torrent files available ==="
ls -la "$TORRENT_DIR"/*.torrent 2>/dev/null | wc -l

echo ""
echo "=== To update the seeder: ==="
echo "1. Edit $SEEDER_DIR/seed.mjs to load all .torrent files from $TORRENT_DIR"
echo "2. Restart the seeder container:"
echo "   cd $REPO_DIR && docker compose restart seeder"
echo "3. Verify seeding:"
echo "   docker logs open-tilawa-seeder --tail 20"
echo ""
echo "=== Verify all torrents are being seeded ==="
echo "curl -s http://127.0.0.1:8083/stats | python3 -m json.tool 2>/dev/null || echo 'tracker stats unavailable'"
