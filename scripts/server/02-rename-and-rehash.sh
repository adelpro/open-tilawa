#!/usr/bin/env bash
# Phase 3: Rename surah files to 001.mp3...114.mp3 and re-hash torrents
# Run on server: bash 02-rename-and-rehash.sh
#
# Prerequisites:
#   - node, npm, webtorrent-cli installed
#   - Access to the original MP3 source directories
#   - TORRENT_SOURCE_DIR: where the raw MP3s are (per reciter)
#   - TORRENT_OUTPUT_DIR: where to put cleaned torrents

set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/adelpro/code/open-tilawa}"
TORRENT_OUTPUT_DIR="${TORRENT_OUTPUT_DIR:-/data/torrents}"
WEB_TORRENT_DIR="${WEB_TORRENT_DIR:-/var/www/tilawa/torrents}"
TRACKER_URL="${TRACKER_URL:-wss://trackerf.quran.us.kg}"

# Reciter source directories (adjust paths to your actual data)
declare -A RECITER_SOURCES=(
  [1]="/data/raw/saad-al-ghamdi"
  [2]="/data/raw/ahmed-al-ajmi"
  [3]="/data/raw/hussary-warsh"
  [4]="/data/raw/abdulrahman-al-sudais"
  [5]="/data/raw/maher-al-muaiqly"
  [6]="/data/raw/abdulbasit-warsh"
  [7]="/data/raw/mishary-al-afasy"
  [8]="/data/raw/yassin-al-jazaery"
  [9]="/data/raw/mohammed-al-kantaoui"
  [10]="/data/raw/hussary-qalun"
)

echo "=== Step 1: Clean and rename MP3 files ==="
for id in "${!RECITER_SOURCES[@]}"; do
  src="${RECITER_SOURCES[$id]}"
  if [ ! -d "$src" ]; then
    echo "SKIP reciter $id: source dir not found: $src"
    continue
  fi
  echo "--- Reciter $id: $src ---"
  # Remove non-MP3 files
  find "$src" -type f ! -name '*.mp3' -delete
  # Rename to 001.mp3...114.mp3 based on numeric prefix in filename
  for f in "$src"/*.mp3; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    # Extract first 1-3 digit number
    num=$(echo "$base" | grep -oE '[0-9]{1,3}' | head -1)
    if [ -z "$num" ]; then
      echo "WARNING: no number in $base, skipping"
      continue
    fi
    # Pad to 3 digits
    padded=$(printf "%03d" "$((10#$num))")
    target="$src/${padded}.mp3"
    if [ "$f" != "$target" ]; then
      mv -f "$f" "$target"
      echo "  renamed: $base -> ${padded}.mp3"
    fi
  done
  # Verify count
  count=$(ls "$src"/*.mp3 2>/dev/null | wc -l)
  echo "  MP3 count: $count"
done

echo ""
echo "=== Step 2: Re-create torrents with webtorrent ==="
cd "$REPO_DIR"
for id in "${!RECITER_SOURCES[@]}"; do
  src="${RECITER_SOURCES[$id]}"
  [ -d "$src" ] || continue
  reciter_name=$(grep -A2 "id: $id," apps/web/src/constants/reciters.ts | grep name | head -1 | sed "s/.*name: '//;s/'.*//")
  echo "--- Creating torrent for reciter $id ($reciter_name) ---"
  # Use webtorrent CLI to create torrent
  npx webtorrent create "$src" \
    --tracker "$TRACKER_URL" \
    --output "$TORRENT_OUTPUT_DIR/reciter-${id}.torrent" 2>&1 | tail -5
done

echo ""
echo "=== Step 3: Copy torrents to web-served directory ==="
cp "$TORRENT_OUTPUT_DIR"/*.torrent "$WEB_TORRENT_DIR"/ 2>/dev/null || echo "No torrents to copy"
echo "Done. Update xs= URLs in reciters.ts with new infohashes."
