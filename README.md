# open-tilawa

Self-hostable infrastructure for the **Open Tilawa WebTorrent stack**: a
peer-to-peer Quran recitation player that streams audio from archive.org web
seeds and WebTorrent peers, with no central media server.

## High-level architecture

```
Browser (React/Vite SPA)
   │  WebTorrent (WebRTC + WebSocket trackers)
   │  HTTP range requests to web seeds (archive.org)
   ▼
Edge (nginx)  ──►  Web (SPA + /torrents/*.torrent)
   │
   ├──► Tracker (bittorrent-tracker, WS+HTTP)  ◄── seeders + browsers
   │
   └──► (coturn, host network)  ◄── WebRTC relay
Seeder (node WebTorrent)  ──►  downloads torrents, saves .torrent files to shared volume
```

### Services (docker-compose.yml)

| Service | Image | Role | Port |
|---|---|---|---|
| `edge` | nginx:alpine | Reverse proxy: routes `/` to web, `/stats`+WS to tracker | 127.0.0.1:8084 |
| `web` | node:20 build → nginx | Vite SPA + serves `/torrents/*.torrent` from shared volume | 80 (internal) |
| `tracker` | bittorrent-tracker | WebSocket + HTTP tracker for WebTorrent peers | 127.0.0.1:8083 |
| `seeder` | node:22 | Seeds all reciter torrents; writes `.torrent` files to `seed_torrents` volume | 6881 |
| `turn` (separate compose) | coturn | STUN/TURN relay for WebRTC (host network) | 3478, 5349, 49160–49200 |

Volumes: `seed_downloads` (seeder data), `seed_torrents` (shared with web for `.torrent` serving).

### Data flow

1. **Seeder** fetches magnet URIs (from `MAGNETS_URL` or fallback `MAGNETLINKS.js`), downloads each torrent, and saves its `.torrent` file to `/data/torrents` (shared volume → web's `/torrents/`).
2. **Browser** loads the SPA, selects a reciter. `use-torrent.ts`:
   - Fetches `/torrents/{infohash}.torrent` (HTTP metadata, no peers needed).
   - On 200: `client.add(torrentFileUrl, { announce: wsTrackers, urlList: webSeeds })`.
   - On 404: falls back to `client.add(magnet)` (requires WebRTC peers).
3. **Metadata** resolves → `showPlaylist()` builds a track list. Web-seed reciters use HTTP URLs (`ws + filename`); P2P-only reciters keep the `TorrentFile` reference.
4. **Playback**: `MusicPlayer` uses `file.streamTo(audio)` (MediaSource, incremental, seekable) for P2P-only tracks; web-seed tracks use native `<audio src>` (HTTP range requests).
5. **Fallback**: on audio error, auto-discovers alternate `ws=` mirrors from the magnet and retries.
6. **TURN**: coturn relays WebRTC when direct P2P fails (symmetric NAT). External IP is resolved from the DDNS hostname `turn.quran.us.kg`.

### Key constraints (browser WebTorrent)

- **WebSocket trackers only** (`wss://`/`ws://`). HTTP/UDP trackers are silently ineffective in a browser.
- **Metadata without peers**: host `.torrent` files over HTTP (`client.add(url)`) — preferred over magnet fallback.
- **Web seeds** (`ws=` / `urlList`): plain HTTP origin serving files; enables playback with zero peers (but only after metadata exists).
- **Incremental vs full-file**: use `streamTo`/`appendTo` for playback; reserve `blob()` for download links.

### Environment (.env)

| Key | Purpose |
|---|---|
| `EDGE_PORT` | Edge nginx port (default 8084) |
| `TRACKER_PORT` | Tracker port (default 8083) |
| `MAGNETS_URL` | URL to fetch magnet URIs (falls back to bundled list) |
| `TURN_REALM` | Coturn realm (turn.quran.us.kg) |
| `TURN_USERNAME` / `TURN_PASSWORD` | Coturn credentials |
| `TURN_EXTERNAL_IP` | DDNS hostname (turn.quran.us.kg) — resolved at coturn startup |

### DDNS

`update-turn-dns.sh` runs every 5 min (cron), updates the Cloudflare A record for `turn.quran.us.kg`, and restarts coturn only when the IP changed.

### Deployment

```bash
cp .env.example .env   # fill in TURN creds
docker compose up -d --build
docker compose -f docker-compose.turn.yml up -d
```

Endpoints (local): Edge `http://127.0.0.1:8084/`, Tracker stats `http://127.0.0.1:8084/stats`, Health `http://127.0.0.1:8084/health`.

### Related repos

- `adelpro/open-quran` — frontend/app repo (external for now)
- `adelpro/open-quran-tracker` — original tracker + seeder (kept as-is)

## Scope of recent work (Phases 1–5)

- **Phase 1**: `.torrent` coverage for all 20 reciters (2 missing archive.org ones added).
- **Phase 2**: 10s metadata timeout, retry button, web-seed fallback link.
- **Phase 3**: incremental streaming via `file.streamTo()` instead of whole-file `blob()`.
- **Phase 4**: UX polish — peer/speed status, spinner hints, retryable failures.
- **Phase 5.1**: auto-discover web-seed mirrors from magnet `ws=` params.
- **Phase 5.2**: user-triggered offline download button.
- **Phase 5.3**: TURN external IP fixed (DDNS hostname + conditional restart).
- **Phase 5.4**: P2P HLS deferred (registered in PLAN.md with trigger conditions).
