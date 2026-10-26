# Infrastructure — how every part fits

One host, one set of containers, three public entry points. This is the map: what
each piece does, which port it listens on, and how data moves between them.

```
                    Cloudflare (TLS, WebSockets)
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
 tilawa.quran.us.kg     tracker.quran.us.kg      admin-tilawa.quran.us.kg
        │                       │                        │
        └──────────► open-tilawa-edge :8084 (host loopback) ◄──┘
                             │
        ┌────────────────────┼─────────────────────┐
        ▼                    ▼                     ▼
   web :80            tracker :8083         admin-edge :9400 (host)
 (public SPA)        (bittorrent-tracker)          │
        │                                     ┌────┴─────┐
        │                                     ▼          ▼
        │                              admin-api :9410  admin-web :80
        │                              (SQLite volume)   (dashboard SPA)
        │                                     │
        │                                     │ docker socket (updates only)
        └──── torrents ⇄ seeder :8085 ◄───────┘
                              │
                        /data volume (audio + .torrent)
                              │
                        TURN :3478 (host network, opt-in relay)
```

## 1. Public site — `web`

- **Image:** built from `apps/web` (Vite), served by nginx on port 80; only the
  edge publishes it.
- **What it does:** lists reciters, plays audio from torrents in the browser
  (WebTorrent + a service worker), and offers an HTTP fallback.
- **Speeds:** the player reports peers and ↓/↑ rates through one formatter
  (`formatSpeed`), so 900 B/s, 40 KB/s and 1.2 GB/s all read correctly.
- **Content source:** today its reciter list is **static** (`src/constants`); it
  does not read the admin catalogue. That is a known gap, not a design.

## 2. Tracker — `tracker`

- **Image:** `bittorrent-tracker --http --ws --port 8083 --stats`.
- **Binding:** `127.0.0.1:8083` on the host, on the compose network as `tracker`.
- **Public name:** `tracker.quran.us.kg`, one name, through a Cloudflare tunnel
  with `enableWebsockets: true`; the edge proxies to the tracker with
  `Upgrade`/`Connection` headers preserved. The old `trackerf` hostname is gone
  (DNS record deleted).
- **State:** none. It is stateless; no volume, no backup, safe to recreate.
- **Stats:** `/stats` is public on the tracker host; it must stay behind the
  proxy rather than published directly.

## 3. Seeder — `seeder`

- **Image:** `ghcr.io/adelpro/open-tilawa-seeder` (multi-arch), built from
  `apps/seeder`. Runs `seed-all.mjs`.
- **What it holds:** the `.torrent` files and the audio in the `/data` volume —
  nothing is baked into the image.
- **Admin API:** Basic auth on `:8085`; `/health` is public. The node **refuses
  to start** without a real `ADMIN_PASS` (the compose placeholder counts as
  none).
- **What `/health` answers:** `version`, `sha`, `disk {free,total}`,
  `quotaBytes`, `usedBytes`, `headroomBytes`, `limits`, plus live counters. The
  dashboard stores these on every probe.
- **Disk policy:** `DISK_QUOTA_GB` (or `MAX_DISK_BYTES`) caps what the node will
  hold. Enforcement happens on the node: a magnet's `xl` is checked before
  adding, and the real length is checked the moment metadata arrives — over the
  cap, the torrent is destroyed before payload moves and the API answers 507.
- **Bandwidth:** `UPLOAD_LIMIT_KBPS` / `DOWNLOAD_LIMIT_KBPS` throttle the
  WebTorrent client (0 = unlimited). The admin page shows the cap next to the
  live speed.
- **Admin UI:** `ADMIN_UI=0` keeps `/api` for the dashboard but stops serving the
  browsable page.
- **Announce:** the node announces every torrent it seeds to the tracker list in
  `constants/TRACKERS.js` (canonical: `wss://tracker.quran.us.kg`) in addition to
  the trackers inside each `.torrent`. A remote node without the internal
  `tracker` service simply has one unreachable entry; the rest still announce.
- **Add/remove:** normally driven by the dashboard (it proxies with the stored
  credentials); the node's own API remains the authority.

## 4. TURN — `turn`

- **Image:** `coturn/coturn`, host networking, config at `apps/turn/entrypoint.sh`.
- **Ports:** 3478 UDP/TCP, 5349 TCP (TLS), relay 49160–49200 UDP.
- **Public name:** `turn.quran.us.kg` (TCP via tunnel; UDP reaches the host
  directly).
- **Purpose:** relays WebRTC traffic between browser peers when direct
  connectivity fails. It is **not** a tracker and never appears in a magnet.
- **Monitoring:** the admin probes each registered server with a STUN binding
  request every five minutes and keeps 24 h of latency history.

## 5. Admin — `admin-edge`, `admin-api`, `admin-web`

- **`admin-edge`** (`127.0.0.1:9400`): the only published admin door. `/` → SPA,
  `/api/` → API, `/health` → API health, with HSTS and a 8 MB body limit.
- **`admin-api`**: NestJS. SQLite at `/data/tilawa-admin.sqlite` (volume
  `open-tilawa_admin_data`). Production env (`NODE_ENV=production`), secrets in
  `apps/admin/.env`.
- **`admin-web`**: the dashboard SPA; its nginx template provides the SPA
  fallback (deep links) and the CSP.
- **What it manages:** seeder nodes (status, version, disk/quota/headroom,
  credentials, torrents, software update), TURN servers (status/latency/history),
  the reciter catalogue, the tracker list, and a torrent ↔ magnet tool.
- **Software updates:** `POST /api/seeders/:id/update` runs a fixed compose pair
  against the host daemon through a mounted socket. It is admin-only,
  CSRF-guarded, audited, and only works for the **local** node. Remote nodes
  update themselves: `docker compose pull && up -d`, or Watchtower with
  `--label-enable` (`WATCHTOWER=1` in `deploy-node.sh`).
- **Roles:** every ops route requires `admin` (satisfied by `super_admin`);
  sessions are cookie-based with CSRF double-submit.

## 6. Data flows

**Catalogue → node**
1. A reciter is added/edited in the dashboard: name, riwaya, infohash, magnet,
   size. The magnet is normalised to the configured tracker list.
2. *Push to nodes* or the per-node checklist adds what the node is missing, by
   magnet, through the node's API.
3. The node resolves metadata, checks its quota, downloads into `/data`, and
   starts seeding. The dashboard reads the node's live inventory — never a copy.

**Magnet → facts**
`POST /api/metadata` on a node resolves a magnet just far enough to report name,
size and file count, then destroys it; the dashboard uses it to fill a reciter
form and to power the converter.

**Torrent → magnet**
The tools screen reads the `.torrent` locally, hashes the exact `info` bytes, and
appends the configured trackers. No node is involved.

## 7. Ports

| Port | Bound to | Service | Public? |
| --- | --- | --- | --- |
| 8084 | 127.0.0.1 | edge (public site + tracker vhost) | via tunnel |
| 8083 | 127.0.0.1 | tracker | via edge |
| 8085 | 127.0.0.1 / node IP | seeder admin API | dashboard only |
| 6881 | node | peer traffic (TCP/UDP) | yes, on nodes |
| 3478, 5349, 49160-49200 | host | TURN | yes (UDP direct) |
| 9400 | 127.0.0.1 | admin edge | via tunnel |
| 9410 / 80 | compose network | admin-api / admin-web | no |

## 8. Environment

Root `.env` (seeder + tracker + turn): `ADMIN_USER`, `ADMIN_PASS`,
`DISK_QUOTA_GB`, `UPLOAD_LIMIT_KBPS`, `DOWNLOAD_LIMIT_KBPS`, `ADMIN_UI`,
`TORRENT_PORT` (inbound peer port, published on the node),
`SEEDER_IMAGE`, `TURN_*`, `TRACKER_PORT`.

`apps/admin/.env` (API): `COOKIE_JWT_SECRET`, `TEMP_JWT_SECRET`,
`TILAWA_PEPPER`, `DB_PATH`, `CORS_ORIGIN`, `EMAIL`, `EMAIL_APP_SPECIFIC_PASS`,
`SEEDER_*` (update action), `DOCKER_GID` (compose).

## 9. Operations

- **Deploy:** `docker compose build <service> && docker compose up -d <service>`.
  Rebuild **every** service whose code changed — a partial deploy is how a stale
  image survives.
- **Backup:** SQLite backup through the API container's `better-sqlite3`
  (`db.backup()`), stored inside the `admin_data` volume or copied out.
- **Rollback:** restore the backup, then run the previous image tag. Migrations
  are forward-only.
- **Monitoring:** `/health` on the admin and on each seeder; the TURN probe
  history; `docker logs` for the API and cloudflared.

## 10. Known gaps

- Community-node enrollment (outbound token + heartbeat) is designed but not
  built; a community node today needs its admin port reachable.
- The public site does not read the catalogue yet (static list).
- Remote nodes update themselves; the dashboard's update button is local only.
- Catalogue manifests are not signed yet.
