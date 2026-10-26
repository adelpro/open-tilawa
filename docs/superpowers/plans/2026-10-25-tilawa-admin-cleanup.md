# Tilawa Admin Cleanup, Monitoring & Management Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean the `apps/admin` fork of everything uslub, then add real TURN monitoring, WebTorrent (seeder) management, and in-dashboard deploy tutorials for TURN and seeder nodes.

**Architecture:** The admin dashboard lives at `apps/admin` inside open-tilawa (forked from uslub, never re-synced from uslub — no edits to `~/code/uslub`, ever). Cleanup is deletion + rename inside `apps/admin` only. TURN monitoring is a `@nestjs/schedule` cron that runs a UDP STUN binding probe per server, writes status/latency/history to SQLite. WebTorrent management proxies the seeder node's basic-auth admin API (`GET/POST/DELETE /api/torrents`, `GET /api/files`) through dashboard endpoints, so seeder creds get stored per row. Tutorials are a Help screen section + `docs/ADMIN-NODES.md`.

**Tech Stack:** NestJS 11, better-sqlite3 (no ORM), `@nestjs/schedule`, node `dgram` (STUN), Vite/React SPA, supertest + jest.

**Spec:** this document + the user decisions recorded below. Current-state audit basis (read on 2026-10-25):
- `apps/admin` is `@tilawa-admin/{api,web,core}` already; uslub remnants are dead uslub-product code, vendor dirs, migrations, string branding, and stale tests.
- `turn_servers` table has `status/last_seen/active_allocations` (allocations never updated); poll = TCP socket only, manual only.
- `seeders` service polls `GET /health` (public) for stats — works; no creds stored.
- Seeder node API (`apps/seeder/seed-all.mjs`, port 8085, Basic auth): `GET /health` (public), `GET /api/torrents`, `POST /api/torrents {magnet|torrentPath}`, `GET /api/files`, `DELETE /api/torrents/:hash`. **Bug: the GET branch catches both methods, so POST is unreachable today.**

**User decisions (2026-10-25):**
1. Full uslub cleanup in the copy only; uslub repo untouched.
2. Keep 2FA (incl. recovery codes, trusted devices); drop Google/GitHub OAuth, owner transfer, email change.
3. TURN monitoring: automatic STUN probe + stored status; no external alerting.
4. WebTorrent: dashboard-side control (inventory, add, remove, sync).

## Global Constraints

- Node 22 via nvm for every command: `export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"`.
- Never read, edit, build or sync `~/code/uslub`. All paths below are under `/home/adelpro/code/open-tilawa`.
- All commands run from `/home/adelpro/code/open-tilawa/apps/admin` unless stated otherwise.
- No new runtime dependencies except `@nestjs/schedule`.
- SQLite: no ORM, migrations forward-only, headless repos stay in `apps/api/src/store` or `libs/core/src/store`; keep constructor `CREATE TABLE IF NOT EXISTS` idiom for kill-and-recreate tables (seeders/turns/torrents), migrations only for tables FK-attached to `users`.
- Work on the `develop` branch; conventional commits `feat(admin-api): …` / `fix(admin-web): …` etc., phase by phase.
- Version bump tag at the end: `1.21.0` (root `apps/admin/package.json`).
- Feature work only starts after Phase A is fully green: `yarn typecheck && yarn lint && yarn test`.

## Review Focus

The failure modes the spec implies but task tests don't cover by default — each pinned by a test in its owning task:

1. **STUN probe vs TCP reality:** a TURN server that answers STUN over UDP but refuses TCP must report `online`, not `offline`. → Task B2's test runs a UDP-only responder and asserts `online`; its timeout case covers UDP-silent → `offline`.
2. **Seeder 401 UX:** a node whose admin password changed must return a readable 401-derived result (`{ error: 'unauthorized' }`), never a stack-trace 500. → Task C2 test.
3. **CSRF on new proxy mutations** (`/api/seeders/:id/torrents`, sync): cookie without header = 403 via the existing middleware. → Task C2 test reuses the harness's CSRF assertion style.
4. **Old DB survives the migration deletions:** the live `tilawa-admin.sqlite` has `schema_migrations` rows for deleted files; boot must not crash. → Task A5 exercises a copy of the deployed DB.
5. **GET before method dispatch in the seeder:** the fix must keep `GET /api/torrents` intact while making `POST /api/torrents` and `DELETE /api/torrents/:hash` reachable. → Task C1's fake-seeder test hits all three.

---

## Phase A — uslub removal

### Task A1: Snapshot the live DB before schema-touching work

**Files:**
- Create: `/home/adelpro/code/open-tilawa/apps/admin/backup/tilawa-admin-pre-cleanup.sqlite` (via online backup; path gitignored)

**Interfaces:**
- Produces: a restorable snapshot; no code. Verified by file existence + integrity check.

- [ ] **Step 1: Take an online snapshot from the deployed volume**

```bash
cd /home/adelpro/code/open-tilawa
docker exec open-tilawa-admin-api node -e "
const db=require('better-sqlite3')(process.env.DB_PATH);
db.backup('/tmp/pre-cleanup.sqlite');
console.log('ok');"
docker cp open-tilawa-admin-api:/tmp/pre-cleanup.sqlite apps/admin/backup/tilawa-admin-pre-cleanup.sqlite
```

- [ ] **Step 2: Verify snapshot integrity**

```bash
node -e "const db=require('better-sqlite3')('backup/tilawa-admin-pre-cleanup.sqlite');console.log(db.pragma('integrity_check',{simple:true}));"
```
Expected: `ok`

- [ ] **Step 3: Commit nothing from the snapshot** — add `backup/` to `apps/admin/.gitignore` first.

### Task A2: Delete uslub-only API modules and callsites

**Files:**
- Delete: `apps/api/src/auth/oauth/` (all of oauth.client/config/controller/module/service/state.ts)
- Delete: `apps/api/src/owner/`
- Delete: `apps/api/src/me/me-email-change.controller.ts`
- Delete uslub-only repos in `libs/core/src/store/`: `api-keys.repo.ts`, `documents.repo.ts`, `gate-runs.repo.ts`, `profiles.repo.ts`, `preferences.repo.ts`, `user-identities.repo.ts`
- Delete uslub-only engine: `libs/core/src/engine/`
- Delete vendor dirs: `vendor/gates/`, `vendor/skills/`, `vendor/voice-default/`
- Modify: `libs/core/src/index.ts` — remove exports of everything deleted above; keep users/sessions/trusted-devices/recovery-codes/email-otp/temp-links/audit/types/scopes exports
- Modify: `apps/api/src/app.module.ts` — remove `OwnerModule` import+list; drop `UslubThrottlerGuard` rename (done in A4, leave name now)
- Modify: `apps/api/src/auth/auth.module.ts` / `auth.controller.ts` / `auth.service.ts` — remove oauth imports, social routes (`/auth/{provider}/*`), `user-identities` references
- Modify: `apps/api/src/me/me.module.ts`, `me.service.ts` — remove email-change wiring
- Modify: `apps/api/src/store/store.module.ts` / remaining repos — drop repo providers for deleted files (audit.repo kept if admin.service uses it; verify with grep first)

**Interfaces:**
- Produces: a booting Nest app whose auth routes are: local signup/activation/signin/signout, reset via temp-links, `/two-fa` (from auth module), `/me`, `/setup`, `/admin/**`, plus the ops modules (seeders/turns/torrents/reciters).

- [ ] **Step 1: Map the dependents before deleting** — `grep -rn "OAuth" apps/api/src --include="*.ts" | grep -v "src/auth/oauth"` and record every touched file. Same for `OwnerModule|OwnerService`, `me-email-change`, `ProfilesRepository|ApiKeysRepository|GateRunsRepository|DocumentsRepository|PreferencesRepository|UserIdentitiesRepository`.

- [ ] **Step 2: Establish a green baseline before touching anything**

```bash
yarn typecheck && yarn lint && yarn test
```
Record the passing counts. (If baseline is red, stop and fix baseline first.) The suite includes `test/auth.spec.ts` and `test/health.spec.ts`, which construct `AppModule` — they are the boot oracle for the deletions to come.

- [ ] **Step 3: Delete the files listed above**, then update every callsite from Step 1's map.

- [ ] **Step 4: Prove the module still boots and the trimmed auth surface works**

```bash
yarn lint && yarn typecheck
yarn workspace @tilawa-admin/api jest test/auth.spec.ts test/health.spec.ts --runInBand
```
Expected: PASS. Any "cannot find module" points at a missed callsite.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(admin-api): remove uslub oauth/owner/email-change modules and dead repos"
```

### Task A3: Drop stale uslub test files and web dead routes

**Files:**
- Delete: `apps/api/test/oauth-mcp.spec.ts`, `social-signin.spec.ts`, `owner-transfer.spec.ts`, `email-change.spec.ts`, `toolchain-api.spec.ts`, `master-pref.spec.ts`, `bootstrap.spec.ts`, `avatar.spec.ts`, `dashboard.spec.ts` (verify each is about a deleted feature before deleting; keep anything asserting kept behaviour)
- Delete: `apps/web/src/routes/Keys.tsx`, `Profiles.tsx`, `ProfileEditor.tsx`, `Usage.tsx`, `OAuthConsent.tsx`, `OwnerTransfer.tsx`, `EmailChange.tsx`
- Modify: `apps/web/src/App.tsx` — remove those imports/routes; keep the rest as-is
- Modify: `apps/web/src/lib/i18n/{en,ar}.ts` — delete keys only referenced by deleted screens (the parity test checks en/ar coverage, not usage, so orphan keys are caught only by this sweep; leave the catalogue cleaner rather than not)
- Delete uslub-branded SEO artefacts: `apps/web/scripts/prerender.mjs`, `apps/web/scripts/make-assets.py`, `apps/web/public/og.png` and the uslub copy in `Privacy.tsx` / `Terms.tsx` / `About.tsx` (decide keep-reword vs delete per file after reading the copy; record the decision in the commit body)

**Interfaces:**
- Produces: an SPA that renders sign-in → account → AdminConsole (Seeders/Turns/Torrents/Reciters) with zero dead imports; i18n parity test still green.

- [ ] **Step 1: Delete api test files after grep-confirming** each targets deleted surface (`grep -l "oauth\|owner\|email-change\|toolchain\|master-pref\|bootstrap\|avatar" apps/api/test/*.spec.ts`).

- [ ] **Step 2: Delete the web dead routes + i18n keys; fix App.tsx imports.** Run the web suite:

```bash
yarn workspace @tilawa-admin/web test
```
Expected: green (route/table/a11y tests updated to the trimmed route list where they asserted deleted screens).

- [ ] **Step 3: Commit** — `chore(admin-web): drop uslub screens, dead routes and stale api specs`

### Task A4: Rename residual uslub branding

**Files (exact strings):**
- `apps/api/src/main.ts:52,57,68` — swagger hint `uslub_…` → `tilawa_…`, cookie name `uslub_session` → `tilawa_session` (⚠️ cookie rename invalidates live sessions: acceptable, already noted in the deploy step of Task E1), log line `uslub-api listening` → `tilawa-admin-api listening`
- `apps/api/src/health.controller.ts:20` — `service: 'tilawa-admin-api'`
- `apps/api/src/csrf/csrf.constants.ts:10` — `CSRF_COOKIE = 'tilawa_csrf'` (dev ISO already excludes? no: CSRF cookie change invalidates issued sessions only until next signin — acceptable)
- `apps/api/src/config/throttler.guard.ts` — class `TilawaThrottlerGuard` + app.module provider
- `apps/api/src/config/env/env.config.dto.ts:41` — `DB_PATH = './data/tilawa-admin.sqlite'`
- `apps/api/src/store` + `libs/core` files containing `uslub.sqlite`/`uslub` comments — rename strings/comments
- root `apps/admin/package.json` — scripts: `@uslub/core`→`@tilawa-admin/core`, `@uslub/api`→`@tilawa-admin/api`, `@uslub/web`→`@tilawa-admin/web`; delete `dev:mcp`; delete the string-rename leftovers in any remaining dev:* script
- `apps/api/test/twofa-pending.spec.ts:153,208` — test emails → `@tilawa.test`

- [ ] **Step 1: `grep -rn "uslub" apps libs package.json --include="*.ts*"` minus node_modules/yarn.lock** — the list above plus whatever else it finds; every hit gets a tilawa rename or explanation (comments documented as history `// ported from uslub` are allowed to keep one provenance mention).

- [ ] **Step 2: Full gate run**

```bash
yarn typecheck && yarn lint && yarn test
```
Expected: all green, zero `uslub` hits in `apps admin` source (the comment provenance lines excepted).

- [ ] **Step 3: Commit** — `chore(admin-api): rebrand uslub strings, cookie/DB defaults and workspace scripts`

### Task A5: Slim libs/core migrations to what the admin panel needs

**Files:**
- Delete (uslub-only, verified unreferenced after A2): `libs/core/src/store/migrations/003_voice.sql`, `005_oauth.sql`, `007_mcp_oauth.sql`, `010_toolchain.sql`, `013_owner.sql`, `015_master_prompt.sql`
- Modify: `libs/core/src/store/migrations/011_email_otp.sql` / `014_theme.sql` — keep only if referenced by kept code (`grep -rn "email_otp\|themes" apps/api/src`); delete otherwise
- Keep: `001_init.sql` (users base), `002_auth.sql`, `006_locale.sql`, `008_setup_tokens.sql`, `009_temp_links.sql`, `012_recovery_codes.sql`

- [ ] **Step 1: Boot-test the live-DB-copy scenario**

```bash
cp /home/adelpro/code/open-tilawa/apps/admin/backup/tilawa-admin-pre-cleanup.sqlite /tmp/admin-live-copy.sqlite
DB_PATH=/tmp/admin-live-copy.sqlite PORT=9991 yarn workspace @tilawa-admin/api start:dev 2>&1 | head -20
```
Expected: no boot failure. The migration runner only iterates migration files present on disk (`db.ts`), so `schema_migrations` rows for deleted filenames are dead entries and are skipped. No `duplicate column` error. Stop the dev server.

- [ ] **Step 2: Boot-test a fresh DB**

```bash
rm -f /tmp/admin-fresh.sqlite*
DB_PATH=/tmp/admin-fresh.sqlite PORT=9992 yarn workspace @tilawa-admin/api start:dev 2>&1 | head -20
```
Expected: boot, migrations applied = exactly the kept set.

- [ ] **Step 3: Commit** — `chore(admin-api): drop uslub-only filesystem migrations`

## Phase B — TURN monitoring

### Task B1: STUN probe utility (dgram UDP binding request)

**Files:**
- Create: `apps/api/src/turns/stun-probe.ts`
- Test: `apps/api/test/stun-probe.spec.ts`

**Interfaces:**
- Produces: `probeStun(host: string, port: number, opts?: { timeoutMs?: number }): Promise<{ ok: true; latencyMs: number } | { ok: false; reason: 'timeout' | 'unreachable' }>`. UDP socket, 20-byte binding request (magic `0x2112A44d`, txn id random 12B), 5s default timeout, parse the XOR-MAPPED-ADDRESS to confirm a real STUN answer (not just any UDP packet).

- [ ] **Step 1: Write the failing test** — spin a local UDP socket that answers the binding request with a well-formed STUN response; assert `probeStun('127.0.0.1', <port>)` → `{ok:true, latencyMs>=0}`. Second case: socket that never replies → `{ok:false, reason:'timeout'}`.

- [ ] **Step 2: Run** `yarn workspace @tilawa-admin/api jest test/stun-probe.spec.ts --runInBand` — expect FAIL (module missing).

- [ ] **Step 3: Implement in `stun-probe.ts`** — binding-req builder + XOR-MAPPED-ADDRESS parser (RFC 5389 §11.2), `AbortSignal`-free manual timeout on the socket.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** — `feat(admin-api): stun-probe turn check utility`

### Task B2: probe goes into TurnsService, history table, latency

**Files:**
- Modify: `apps/api/src/turns/turns.service.ts` — replace the `net.Socket` block in `poll()` with `probeStun(hostStr, port)`; parse host:port from `turn:…`/`turns:…` URL (URL parsing lives in the same `url.replace(/^turn[u]?:?/,'')` spot as today). Store `latency_ms`. On each poll, insert `turn_events(server_id, status, latency_ms)` and keep only the last 200 rows per server.
- Test: `apps/api/test/turns.spec.ts` (extend the existing harness pattern) — a running fake STUN responder makes a server row flip to `online` with `latencyMs` populated; a bogus host flips to `offline` with an event row; **UDP-OK-but-TCP-locked is online** (probe is UDP, so this is exercised plus asserted).

**Interfaces:**
- Produces:
  - `TurnServer` gains `latencyMs: number | null`.
  - `GET /api/turns/:id/history` (controller, `@Roles('admin')` like the rest) → `{ events: [{status, latencyMs, createdAt}] }`, last 50 first.

- [ ] **Step 1: Failing tests** in `turns.spec.ts` (the fake STUN responder, offline flip, history endpoint, `latencyMs: null` when never polled).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** (service + controller route).

- [ ] **Step 4: Run** — PASS. `yarn typecheck` green.

- [ ] **Step 5: Commit** — `feat(admin-api): stun probe turn status, latency and history`

### Task B3: Scheduled auto-poll

**Files:**
- Modify: `apps/api/src/turns/turns.module.ts` — `ScheduleModule.forRoot()` imported here (not globally, to keep it scoped)
- Create: `apps/api/src/turns/turns-scheduler.service.ts` — `@Cron('0 */5 * * * *')` calling `turnsService.pollAll()`; errors caught and logged, never thrown (a cron that dies takes the scheduler down).
- Modify: `apps/api/src/app.module.ts` — register `TurnsSchedulerService` if module registration suffices (it does: `providers` inside `TurnsModule`).
- Test: `apps/api/test/turns-scheduler.spec.ts` — instantiate the scheduler service with a spied turns service, call its `handleCron()` directly (the cron wiring is not relied upon), assert `pollAll` was called and a throwing `pollAll` is swallowed + logged.

- [ ] **Step 1: install dep** — `yarn workspace @tilawa-admin/api add @nestjs/schedule`

- [ ] **Step 2: failing test** → **Step 3: run, expect FAIL** → **Step 4: implement** → **Step 5: run, expect PASS, `yarn typecheck` green** → **Step 6: commit** — `feat(admin-api): scheduled 5-min turn stun polling`

## Phase C — WebTorrent management from the dashboard

### Task C1: Fix the seeder admin bug + seeder-client helper + creds columns

**Files:**
- Modify: `/home/adelpro/code/open-tilawa/apps/seeder/seed-all.mjs` — swap the order: dispatch on `req.method` **before** matching `/api/torrents`; keep `GET /health` public, `POST /api/torrents` and `DELETE /api/torrents/:hash` reachable behind Basic auth (they already are credential-gated; only the method order is wrong).
- Modify: `apps/admin/apps/api/src/seeders/seeders.service.ts` — add idempotent `ALTER TABLE seeders ADD COLUMN admin_user TEXT`, `admin_pass TEXT` (wrapped in try/catch for duplicate column, matching the constructor idiom); `SeedersService.update(id, {adminUser?, adminPass?})`; `update()` accepts both so a node's password rotate is one call.
- Create: `apps/api/src/seeders/seeder-client.ts` — `seederFetch(seederRow, path, opts)`: fetch with `Authorization: Basic base64(admin_user:admin_pass)`, `AbortSignal.timeout(5_000)`, {method} forwarded; on 401 returns result `{ error: 'unauthorized' }`; on non-ok `{ error: 'upstream' , status}`; on JSON passthrough result.
- Test: `apps/api/test/seeder-client.spec.ts` — start an http server on a random port expecting the Basic header, assert GET/POST/DELETE reach it (this pins the Review-Focus 5 fix from the seeder side too).

- [ ] **Step 1: apply seed-all.mjs ordering fix** and smoke it locally: with a fake `ADMIN_USER`/`ADMIN_PASS` and no WebTorrent client needed for the 400 path, `curl -u admin:pass -XPOST http://127.0.0.1:8085/api/torrents -d '{}'` — expect 400 with `{"error":"magnet or torrentPath required"}` instead of the JSON stats dump (which is what the current GET-branch returns).

- [ ] **Step 2: failing seeder-client test → implement → pass.**

- [ ] **Step 3: commit** — `fix(seeder): dispatch HTTP methods before path checks; seeders table gains node creds`

### Task C2: Proxy endpoints through the admin API

**Files:**
- Modify: `apps/api/src/seeders/seeders.controller.ts` + `seeders.service.ts`:
  - `GET /api/seeders/:id/torrents` → seeder `GET /api/torrents` (list+stats, no DB change)
  - `POST /api/seeders/:id/torrents` body `{magnet?: string, torrentPath?: string}` → seeder POST; `{ok,name,infoHash}`
  - `DELETE /api/seeders/:id/torrents/:hash` → seeder DELETE
  - `GET /api/seeders/:id/files` → seeder `GET /api/files` (.torrent filenames)
  - `POST /api/seeders/:id/credentials` body `{adminUser, adminPass}` (admin role) → stored in the `seeders` row; the at-rest risk (credentials live in the admin DB) is a documented accepted risk, restated in the Phase E deploy record
  - `PATCH /api/seeders/:id` body `{name?, url?, adminUser?, adminPass?}` — update a node (including credential rotation) in one call
- Extend `apps/api/test/seeders.spec.ts`: CSRF (cookie-only mutation = 403 per Review Focus 3), unauthorized-from-upstream surfaces as `{error:'unauthorized'}` (Review Focus 2), happy path add/list/remove against the fake seeder.

**Interfaces:**
- Consumes: `seederFetch()` from C1.
- Produces: route surface the SPA calls in C3. Error shape is uniform on every proxy route: a seeder 401 maps to HTTP 200 envelope `{ error: 'unauthorized' }` (read by the SPA, which flags the row "credentials needed"); upstream 5xx or non-JSON maps to `{ error: 'upstream' }`; connect timeout maps to `{ error: 'timeout' }`; a wrong seeder id answers HTTP 404. `-sync` is defined in C3 on the torrents module as `POST /api/torrents/sync {seederId}`.

- [ ] **Step 1: failing spec** → **Step 2: implement** → **Step 3: pass** → **Step 4: commit** — `feat(admin-api): seeder proxy for torrents inventory, add, remove, files, creds`

### Task C3: SPA — Torrents + Seeders screens

**Files:**
- Modify: `apps/web/src/routes/Seeders.tsx` — add-node form gains username/password fields (stored via the C2 credentials/PATCH route); per row a credentials edit modal; status chips unchanged from today
- Rewrite: `apps/web/src/routes/Torrents.tsx` — pick a seeder (dropdown of `GET /api/seeders`), show its live inventory (`progress`, `peers`, `up/down speed`, `uploaded`, `done`) and the synced catalogue rows (with `stale` marking), action buttons: **Sync to DB** (`POST /api/torrents/sync {seederId}`), **Add** (magnet or .torrent filename from the node's file list), **Remove** per torrent, **List files** (`GET /api/seeders/:id/files`)
- Extend the a11y/table tests (`apps/web/test/`) minimally for the new screen shapes.
- Modify: `apps/api/src/torrents/torrents.service.ts` + `torrents.controller.ts` — `seeder_id` column (constructor ALTER idiom), `sync(seederId)`: pull the seeder's inventory through the C2 routes and upsert into `torrents` (infohash + name + magnet + `seeder_id`); `GET /api/torrents` gains `?seederId=` filtering; a row whose seeder was removed renders as `status: 'stale'` in the SPA

- [ ] **Step 1: failing test for `sync()`** (fake seeder fixture returns 2 torrents; calling sync twice keeps 2 rows) → **Step 2: implement** → **Step 3: pass** → **Step 4: web suite** → **Step 5: commit** — `feat(admin-web): manage seeder torrents from the dashboard`

## Phase D — Tutorials

### Task D1: In-dashboard node setup guide

**Files:**
- Modify: `apps/web/src/routes/Help.tsx` — add a **Node setup** section with two ordinal tutorials, one per node type, rendered from components already available (`CopyLine` for command blocks; simple `Panel` blocks for steps).
- Tutorial 1 — Seeder (WebTorrent node): 6 steps (choose a server; run the one-line `curl bash` with `--type seeder`; set ADMIN_USER/ADMIN_PASS; open inbound TCP 8085 admin + 6881 UDP/TCP peers; firewall notes; add in **Seeders → Add Seeder** (name/host URL), then store admin creds with the new credentials button; verify the row flips `online` after first poll).
- Tutorial 2 — TURN: 6 steps (server; run `--type turn`; DNS A record **not** through the tunnel; open 3478/5349 TCP+UDP + UDP 49160-49200; verify; add in **Turns → Add TURN Server** `turn:<ip>:3478`; watch the STUN probe status).
- i18n: same guidance under `en`/`ar` keys (a `node.setup.*` namespace); the Arabic text reuses the terminology the catalogue already established for Seeders/Turns titles rather than inventing new words

- [ ] **Step 1: write the section + keys** → **Step 2: run the catalogue parity test** (`yarn workspace @tilawa-admin/web test`) → **Step 3: commit** — `feat(admin-web): node setup tutorials in help screen`

### Task D2: `docs/ADMIN-NODES.md` and README cross-reference

**Files:**
- Create: `/home/adelpro/code/open-tilawa/docs/ADMIN-NODES.md` — the two procedures in full, including troubleshooting: `redirect_uri`-style trap equivalents — for TURN the A-record-not-through-tunnel trap is the documented one, for seeder the admin port not being 6881.
- Modify: `/home/adelpro/code/open-tilawa/README.md` — "Deploying New Nodes" section becomes a pointer to `docs/ADMIN-NODES.md` (one paragraph, keep the two curl one-liners).

- [ ] **Step 1: write the docs** — the two procedures in full, each ending in a verify-able state row in the dashboard (Seeder row `online`, TURN row probed `online`). Troubleshooting captures the two host-level traps: TURN DNS must be a plain A record **not proxied through Cloudflare** (UDP does not traverse the tunnel), and the seeder admin port is 8085 while peer traffic is 6881 ( UDP/TCP ).
- [ ] **Step 2: sanity-check every command** in the doc against `deploy-node.sh --help` output (no real deploy from this session); assert no dead references.
- [ ] **Step 3: commit** — `docs: admin node deployment guide for seeder and TURN nodes`

## Phase E — Verification, versioning, deploy

### Task E1: Full gate + rebuild + redeploy

- [ ] **Step 1: gates**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
yarn typecheck && yarn lint && yarn test
```
Expected: green everywhere; test counts recorded in the session log.

- [ ] **Step 2: regenerate the committed OpenAPI spec** if `apps/api/src/export-openapi.*` survived A2 (keep it; it documents the now-tilawa surface):

```bash
yarn workspace @tilawa-admin/api build && cd apps/api && node dist/export-openapi.js && npx prettier --write ../../../docs/openapi.json
```
(If the exporter was deleted, delete the drift test instead and note it — no half-path.)

- [ ] **Step 3: version bump + tag** — root `package.json` `1.21.0`; tag `v1.21.0`; commit `chore: bump version to 1.21.0`.

- [ ] **Step 4: deploy** from `/home/adelpro/code/open-tilawa`: `docker compose build admin-api seeder && docker compose up -d --no-deps admin-api seeder`; wait for both to turn healthy; then `curl -fsS https://admin-tilawa.quran.us.kg/api/health` → 200 and the dashboard homepage loads on the new session cookie name (expect sign-in once).
   Expected visible state within 5 minutes: existing TURN rows flipped `online`/`offline` by the scheduler, each with a `latencyMs`; a seeder row shows its synced torrent inventory after the first Sync. Also record the accepted-risk note: seeder admin credentials now live in the admin DB.
   **Remote seeder nodes** run the pre-fix `seed-all.mjs`; after the image publishes, re-run `deploy-node.sh --type seeder` on each node (or `docker compose pull && up -d`) so the POST/DELETE paths actually work there.

- [ ] **Step 5: record the deploy outcome** in the session chat with real observations, not expectations.

---

## Deliberately not in this plan

- External alerts (Telegram) for TURN offline — user decided against; revisit if a node death goes unnoticed.
- Seeding the tracker/admin DB from reciter-audit.json — out of scope; Reciters module untouched.
- Schema redesign for `torrents` (magnet uniqueness) — ALTER-only touches; migration version start 016 if a real migration is ever needed.
