# Admin nodes — provision, operate, release

The console is one artefact with three containers. This file is the operator's
half: what to run, what to put in `.env`, and how to tell a broken node from a
broken console.

## The stack

| Service      | Role                                              | Port (host)             |
| ------------ | ------------------------------------------------- | ----------------------- |
| `admin-edge` | single door: `/` → SPA, `/api/` → API, `/health`  | `127.0.0.1:9400`        |
| `admin-api`  | NestJS API, SQLite at `/data/tilawa-admin.sqlite` | internal `9410`         |
| `admin-web`  | built SPA served by nginx                         | internal `80`           |
| `seeder`     | WebTorrent node + its own admin API               | `127.0.0.1:8085`        |
| `turn`       | coturn (STUN/TURN)                                | host networking, `3478` |

Only the edge is published. The seeder's admin port is loopback-bound on purpose:
the console reaches it over the compose network (`http://seeder:8085`), so it
never needs to be reachable from outside.

## Environment

`apps/admin/.env` (gitignored) feeds `admin-api`. Required in production:

- `COOKIE_JWT_SECRET`, `TEMP_JWT_SECRET` — sessions and one-time links. Rotating
  them signs every user out; rotate on suspicion, not on schedule.
- `TILAWA_PEPPER` — hashes setup tokens and 2FA codes.
- `DB_PATH=/data/tilawa-admin.sqlite`, `NODE_ENV=production` (the compose file
  sets the latter so a dev `.env` cannot leak non-secure cookies into prod).

Mail is configured in the console at **/console/settings** and takes effect on the
next message — no restart. The password is stored encrypted under `MAIL_SECRET`
(32 random bytes, base64); without that variable the console refuses to save one.

`EMAIL` + `EMAIL_APP_SPECIFIC_PASS` (Gmail) remain the bootstrap: a fresh deploy
mails its first setup token before any admin can sign in, so the environment is
the only configuration that exists at that point. Clearing the console
configuration falls back to it. With neither, the API still boots and the routes
that need mail (activation, password reset, email 2FA) answer **503**.

The same screen sends the four operational alerts (service down, node offline,
disk headroom, failed node update) to every active admin plus any extra
addresses, one message when a condition starts and one when it clears.

- `WEBSITE` — the public origin stamped into activation and reset links. The
  compose file sets it to `${ADMIN_WEBSITE:-https://console.tilawah.cc}`
  so a dev `.env` value (`http://localhost:9400`) cannot leak into production
  mail, and the API refuses to start in production while it points at loopback.

Root `.env` feeds the seeder and TURN containers:

- `ADMIN_USER`, `ADMIN_PASS` — the seeder's Basic-auth credentials. `ADMIN_PASS`
  is also what you enter in the console's seeder row; both must agree.
- `TURN_REALM`, `TURN_USERNAME`, `TURN_PASSWORD`, `TURN_EXTERNAL_IP`.

## Provisioning a seeder node

1. Clone this repository on the machine that will hold the audio.
2. Put `ADMIN_USER`/`ADMIN_PASS` in the root `.env` (a long random password; the
   compose default `change-me-in-prod` is a placeholder, not a credential).
3. `docker compose up -d --build seeder`
4. `curl -s http://127.0.0.1:8085/health` → `{"status":"ok", ...}`
5. In the console, **Seeders → Add seeder**: URL `http://seeder:8085` when it
   runs on the same compose network, or `http://<host>:8085` for a remote node
   whose port you have opened deliberately. Enter the same admin user/password.
6. The status chip turns **Online** within a minute (the row's `/health` is
   public). The **Torrents** screen then reads and mutates that node.

Credentials are stored on the row and used server-side; the API never returns
them. To change them later, **Seeders → Edit** on the row (omit both fields to
keep what is stored; **Clear credentials** removes them).

## Provisioning a TURN server

1. Set `TURN_REALM`, `TURN_USERNAME`, `TURN_PASSWORD`, `TURN_EXTERNAL_IP`.
2. `docker compose -f docker-compose.turn.yml up -d`
3. Open `3478/udp`, `3478/tcp`, `5349/tcp` and `49160:49200/udp`.
4. Register it in the console as `turn:<host>:3478`.

The console probes each server with a real STUN binding request every five
minutes (and once at boot), storing status, latency and a 24-hour history
(288 checks). **Online means the UDP path answered a binding request with our
transaction id** — not that a TCP port was open. Plain `turn:` over UDP only; a
`turns:` (TLS) or IPv6 endpoint will report offline because the probe dials
`udp4`.

## Updating a seeder node

The seeder reports `version`, `sha` and its free disk in `/health`; the Seeders
screen stores them on every probe, so the row tells you which release a node
runs and whether it has room for the next release.

**From the console** — open the node's own screen (**Seeders →** click the row)
and use _Update software_. Lifecycle actions live there, not on the list row: the
list is for the fleet's state, that screen is for one node. The button appears
only when the node is **this host's own** (its URL host matches `SEEDER_SERVICE`)
and its version differs from the one the deployment expects. The action is
intentionally narrow and off by default:

- it needs `SEEDER_UPDATE=1`, the host's Docker socket, and the repository
  mounted read-only at `/host` (all three are in the compose `admin-api` block);
- it runs exactly one fixed command pair against the `seeder` service, with no
  user input: `docker compose … pull|build seeder` then `up -d --no-deps
--force-recreate seeder`;
- `SEEDER_UPDATE_MODE=build` compiles from the mounted tree (a checkout);
  `pull` fetches `SEEDER_IMAGE` (a fleet node);
- the request is admin-only, CSRF-guarded and written to the audit trail.

It cannot be applied to a remote node, and asking for one answers 400: the
command drives the Docker socket of the host the console runs on. A second
request while one is running answers 409.

The request returns **202 as soon as the job starts** — a build takes minutes, and
the console answers through a proxy that gives up long before that. Progress is
the row's `updating` flag, which the node screen polls; the outcome is the
`seeder:update` audit entry, with `status: error` and the compose output tail when
it fails, and `updateError` on the row until the next attempt.

A Docker socket is root-equivalent on the host. If that is not acceptable on a
given installation, leave `SEEDER_UPDATE` unset — the button answers 503 and the
node is updated by hand.

**From the node itself** (registry image — the fleet path). Two options:

1. Manual, on schedule:
2. Automatic: re-run `deploy-node.sh` once with `WATCHTOWER=1` (or add the
   service by hand). It runs `containrrr/watchtower --label-enable --interval
600`, scoped to the seeder label, so a new `latest` image recreates the node
   and nothing else on the host is touched.

```bash
cd /opt/tilawa-seeder && docker compose pull && docker compose up -d
```

Tag a release (`v1.21.0`) to publish `ghcr.io/adelpro/open-tilawa-seeder:1.21.0`
(multi-arch: amd64 + arm64) through the `Publish Seeder Image` workflow; nodes
pin `SEEDER_IMAGE` to that tag for reproducible rollbacks.

## Node limits (quota and bandwidth)

A node enforces its own limits — a console-side cap would only be a wish:

- `DISK_QUOTA_GB=150` (or `MAX_DISK_BYTES`) caps what the node holds. The check
  runs twice: the magnet's `xl` before adding, and the real length when metadata
  arrives. Over the cap, the torrent is destroyed before payload moves and the
  API answers **507** with the headroom it has.
- `UPLOAD_LIMIT_KBPS` / `DOWNLOAD_LIMIT_KBPS` throttle the WebTorrent client
  (0 = unlimited). The node's own admin page prints the cap beside the live rate.
- `/health` reports `quotaBytes`, `usedBytes`, `headroomBytes` and `limits`; the
  console plans pushes against that headroom and skips a node that cannot fit
  the releases.
- `ADMIN_UI=0` hides the browsable admin page on a community node; `/api` stays
  available to the console.

## Trackers

The tracker list lives in the console (Reciters → **Trackers**): one `ws://` or
`wss://` URL per line. Every magnet the console builds — reciter save, catalogue
import, the torrent tool — announces to it, and saving rewrites existing
catalogue magnets so no row keeps an old list. `tracker.tilawah.cc` is the one
hostname; the old `trackerf` alias has been removed from DNS and the edge.

## Publishing a release

1. Create the `.torrent` and keep the audio where the seeder can read it.
2. Put the `.torrent` in the node's `TORRENT_DIR` (or paste the magnet on the
   Torrents screen).
3. Torrents → pick the node → add → confirm progress reaches 100%.
4. Add the reciter with the same infohash in **Reciters**.

## Release runbook

1. `yarn typecheck && yarn lint && yarn test` in `apps/admin`;
   `yarn workspace @tilawa-admin/web test`; `npm test` in `apps/seeder`.
2. Bump `package.json` in the root, `apps/api`, `apps/web` and `libs/core`;
   regenerate the contract: build the API, `node dist/export-openapi.js`, then
   `npx prettier --write docs/openapi.json`.
3. Back up the database **inside** the volume:
   `docker exec open-tilawa-admin-api node -e "const D=require('/app/node_modules/better-sqlite3');const db=new D('/data/tilawa-admin.sqlite',{readonly:true});db.backup('/data/backup-<version>.sqlite').then(()=>db.close())"`
4. **Rebuild every image whose code changed** — a release that rebuilds only the
   API leaves the SPA and the seeder on old code:
   `docker compose build admin-api admin-web seeder && docker compose up -d admin-api admin-web edge seeder`
5. Verify, in this order:
   - `curl -s http://127.0.0.1:9400/health` → `"version":"<release>"`
   - `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9400/` → `200`
   - the SPA bundle contains the release's new strings
     (`curl -s http://127.0.0.1:9400/ | grep -o '/assets/[^"]*\.js'`)
   - `docker inspect` the API container: `NODE_ENV=production`
   - anonymous `/api/seeders` and `/api/turns` → **401**
6. Roll back by restoring the backup into a fresh volume and re-running the
   previous image tag; migrations are forward-only, so never point old code at a
   migrated database without the backup.

## Troubleshooting

| Symptom                                     | Meaning                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Seeder 502 “no credentials stored”          | The row has no admin user/password — edit it and add them.                                                                          |
| Seeder 502 “refused the stored credentials” | Credentials no longer match the node's `ADMIN_PASS`.                                                                                |
| Seeder 502 “unreachable”                    | Wrong URL or node down; try `curl` from the API container: `docker exec open-tilawa-admin-api wget -qO- http://seeder:8085/health`. |
| `SQLITE_READONLY_DIRECTORY` on boot         | The volume's root directory is root-owned; `chown -R 1000:1000 /data`.                                                              |
| TURN row stuck offline                      | UDP blocked, wrong host/port, or a `turns:`/IPv6 endpoint (the probe is udp4).                                                      |
| Signup / reset answers 503                  | Mail is not configured — set it at `/console/settings`; `EMAIL` / `EMAIL_APP_SPECIFIC_PASS` only cover the first-run setup token.   |
| Console mail save refused, names `MAIL_SECRET` | Add `MAIL_SECRET` (32 random bytes, base64) to `apps/admin/.env` and recreate `admin-api`; the password cannot be stored without it. |
| Panel says “Environment (Gmail)” after saving | The stored password does not decrypt (rotated `MAIL_SECRET`), so the environment is in use — re-enter the password.                |
