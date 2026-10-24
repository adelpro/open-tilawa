# open-tilawa

Uslub-style self-hostable infrastructure for the Open Quran WebTorrent stack.

## Scope
- `apps/tracker` – `bittorrent-tracker` (WebSocket + HTTP)
- `apps/seeder` – Hardened `webtorrent` seeder (fetches magnets from `tilawa.quran.us.kg/api/magnet-uris` with fallback to `MAGNETLINKS.js`)
- `apps/turn` – Placeholder for `coturn` (to be added)
- `edge/` – Nginx reverse proxy with WebSocket upgrade support

The live frontend at [tilawa.quran.us.kg](https://tilawa.quran.us.kg) remains untouched for now. This repo only containerizes the tracker/seeder/edge so it can point to our self-hosted endpoints and leave room for local migration later.

## Relation to other repos
- [`adelpro/open-quran-tracker`](https://github.com/adelpro/open-quran-tracker) – Original tracker + seeder repo (kept as-is)
- [`adelpro/open-quran`](https://github.com/adelpro/open-quran) – Frontend/app repo (external for now)

## Quick start
```bash
cp .env.example .env
docker compose up -d --build
```

## Endpoints (local)
- Edge: `http://127.0.0.1:8084/`
- Tracker stats: `http://127.0.0.1:8084/stats`
- Health: `http://127.0.0.1:8084/health`

## Notes
- Tracker is only exposed via the edge by default (bound to `127.0.0.1`)
- Seeder uses a named volume `seed_downloads` to persist downloaded torrents
- Cloudflared should point `trackerf.quran.us.kg` to the edge (`127.0.0.1:8084`) with WebSocket upgrades enabled
- TURN should be served directly via `coturn` (not through Cloudflare Tunnel) for proper WebRTC
