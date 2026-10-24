# Plan: Complete tasks & clean up

## Status
- Repo renamed to `open-tilawa` (GitHub: adelpro/open-tilawa), local at `/home/adelpro/code/open-tilawa`.
- Tracker + seeder + nginx edge running (8083 direct, 8084 via edge).
- Coturn setup added (docker-compose.turn.yml) — tested, working with host networking.
- Duplicate local folder `/home/adelpro/open-quran-tracker` removed (GitHub backup kept).

## Remaining tasks

### 1. TURN/coturn in production
- [ ] Set real creds in `.env`: `TURN_USERNAME`, `TURN_PASSWORD`, `TURN_EXTERNAL_IP` (public IP of homeserver)
- [ ] DNS: point `turn.quran.us.kg` A record to public IP (NOT through Cloudflare Tunnel — UDP needed)
- [ ] Open firewall: UDP/TCP 3478, 5349, UDP 49160-49200
- [ ] Start: `docker compose -f docker-compose.turn.yml up -d`
- [ ] Verify: `turnutils_uclient` or browser `chrome://webrtc-internals` (ICE pair should be relay)
- [ ] Disable dead `cloudflared-turn` systemd service to avoid confusion: `systemctl disable --now cloudflared-turn`

### 2. Tunnel cutover (when ready to restart tunnel)
- [ ] Update `/home/adelpro/.cloudflared/config.yml` already points trackerf → 8084 (edge)
- [ ] Restart `cloudflared-trackerf` (needs sudo or wait for reboot) so it picks up 8084
- [ ] After restart, the direct 8083 publish can be removed from docker-compose.yml (single-edge model)

### 3. Rename open-quran-tracker repo (optional)
- [ ] If desired: `gh repo rename open-tilawa-tracker --repo adelpro/open-quran-tracker`
- [ ] Or merge its git history into open-tilawa and archive the old repo
- [ ] Update any references (README already lists it)

### 4. Frontend migration to local (future)
- [ ] Add `apps/web/` (Next.js/Vite PWA) with Dockerfile (mirror uslub/apps/web)
- [ ] Add `web` service to docker-compose.yml, edge routes `/` to it
- [ ] Pin WebTorrent version, fix `getBlobURL` → v2 `blob()` API, stream instead of loading all blobs
- [ ] Update client rtc-config.ts to use self-hosted TURN

### 5. Further cleanup
- [ ] Remove `uslub.backup` if no longer needed (large)
- [ ] Clean stale `.code-index/adelpro-open-quran-view` if open-quran-view moved
- [ ] Prune unused Docker images/volumes periodically

## Double folders cleaned
- Removed `/home/adelpro/open-quran-tracker` (local) — superseded by `/home/adelpro/code/open-tilawa/apps/{tracker,seeder}`; GitHub backup retained.
