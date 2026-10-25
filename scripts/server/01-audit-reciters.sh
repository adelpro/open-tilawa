#!/usr/bin/env bash
# Phase 0: Audit current reciter data
# Run on server: bash 01-audit-reciters.sh

set -euo pipefail

TORRENT_DIR="${TORRENT_DIR:-/data/torrents}"
WEB_TORRENT_DIR="${WEB_TORRENT_DIR:-/var/www/tilawa/torrents}"

echo "=== Seeder torrents ==="
ls -la "$TORRENT_DIR" 2>/dev/null || echo "Seeder torrent dir not found: $TORRENT_DIR"

echo ""
echo "=== Web-served torrents ==="
ls -la "$WEB_TORRENT_DIR" 2>/dev/null || echo "Web torrent dir not found: $WEB_TORRENT_DIR"

echo ""
echo "=== Infohashes in reciters.ts ==="
grep -oE '[a-f0-9]{40}' apps/web/src/constants/reciters.ts 2>/dev/null || echo "Run from repo root"

echo ""
echo "=== Docker containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i tilawa
