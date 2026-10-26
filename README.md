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
   - On 200: `client.add(torrentBlob, { announce: wsTrackers, deselect: true })`.
   - On 404: falls back to `client.add(magnet)` (requires WebRTC peers).
3. **Metadata** resolves → `showPlaylist()` builds a track list. Web-seed reciters use HTTP URLs (`ws + filename`); P2P-only reciters keep the `TorrentFile` reference.
4. **Playback**: the app registers one service worker (`/sw.js`, PWA + WebTorrent merged), calls `client.createServer()`, and points `<audio>` at `file.streamURL`. The worker answers range requests from torrent pieces, so playback starts on the first pieces and seeking works. Itqan-sourced reciters keep a plain HTTP `<audio src>`.
5. **Selection**: only the current surah is selected (`deselect: true` + `file.select()`), so the rest of an 114-file torrent does not compete for bandwidth.
6. **TURN**: coturn relays WebRTC when direct P2P fails (symmetric NAT). External IP is resolved from the DDNS hostname `turn.quran.us.kg`.

### Key constraints (browser WebTorrent)

- **WebSocket trackers only** (`wss://`/`ws://`). HTTP/UDP trackers are silently ineffective in a browser.
- **Metadata without peers**: host `.torrent` files over HTTP (`client.add(url)`) — preferred over magnet fallback.
- **Web seeds** (`ws=` / `urlList`): plain HTTP origin serving files; enables playback with zero peers (but only after metadata exists).
- **Incremental vs full-file**: stream with `file.streamURL` (service worker, range requests). `file.blob()`/`getBlobURL()` are gone in v3 and would download the whole file first.

### Service worker (PWA + WebTorrent)

One worker owns scope `/` and does both jobs: Workbox precaches the app shell
and serves navigations, while a vendored copy of WebTorrent's `sw.min.js`
answers `/webtorrent/*` range requests. It is built with
`vite-plugin-pwa`'s `injectManifest` strategy from `apps/web/src/sw.js`.

See [apps/web/README.md](apps/web/README.md) for the merge contract, the nginx
`/sw.js` no-cache rules, and the WebTorrent version-bump procedure.

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

Versioning, tags and the order to deploy in: [docs/RELEASING.md](docs/RELEASING.md).

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

## Deploying New Nodes

### Seeder Node (Docker)

Run on any Ubuntu/Debian server:

```bash
curl -sSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh | bash -s -- --type seeder --port 8085 --admin-user admin --admin-pass YOUR_PASSWORD
```

Add a disk cap (recommended on a shared host) and follow image releases:

```bash
curl -sSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh \
  | bash -s -- --type seeder --disk 500 --upload-kbps 20000 --watchtower
```

Without `--disk` the node reports its free space and accepts anything that fits;
with it, the node refuses a magnet whose length would cross the cap. The script
refuses a cap larger than the disk it is installing onto. The generated compose
publishes the admin port and the peer port `6881` (TCP+UDP) and keeps
`/data/torrents` and `/data/downloads` on separate host volumes, so a recreate or
a Watchtower update never discards downloaded audio.

Then add to dashboard:
1. Go to https://admin-tilawa.quran.us.kg
2. Navigate to **Seeders** → **Add Seeder**
3. Name: server hostname
4. URL: `http://<server-ip>:8085`
5. Leave *Add the catalogue to this node* ticked to queue every reciter the node
   is missing as soon as it is registered

The node's version, build SHA, disk, quota and headroom appear on the seeders
screen after the first probe. **Unlink** removes the node from the dashboard only;
the node keeps seeding.

### TURN Server (Native)

```bash
curl -sSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh | bash -s -- --type turn --turn-realm turn.quran.us.kg --turn-user opentilawa --turn-pass YOUR_PASSWORD
```

Then add to dashboard:
1. Go to https://admin-tilawa.quran.us.kg
2. Navigate to **TURN Servers** → **Add TURN Server**
3. Name: `hostname-turn`
4. URL: `turn:<server-ip>:3478`

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| TYPE | seeder | Node type: seeder or turn |
| PORT | 8085 | Seeder admin port |
| ADMIN_USER | admin | Seeder admin username |
| ADMIN_PASS | change-me-in-prod | Seeder admin password |
| DISK_GB (`--disk`) | unlimited | Cap on what the node holds, in gigabytes |
| UPLOAD_KBPS / DOWNLOAD_KBPS | 0 (unlimited) | Bandwidth caps for the seeding client |
| ADMIN_UI | 1 | `0` keeps the admin API and hides the browsable page |
| PEER_PORT (`--peer-port`) | 6881 | Inbound peer port, published TCP+UDP |
| WATCHTOWER (`--watchtower`) | 0 | `1` adds a label-scoped Watchtower to follow image releases |
| TURN_REALM | turn.quran.us.kg | TURN realm |
| TURN_USER | opentilawa | TURN username |
| TURN_PASS | (auto-generated) | TURN password |
