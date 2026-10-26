# Plan: Complete tasks & clean up

## Status
- Repo renamed to `open-tilawa` (GitHub: adelpro/open-quran), local at `/home/adelpro/code/open-tilawa`.
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

### 3. Rename open-tilawa-tracker repo (optional)
- [ ] If desired: `gh repo rename open-tilawa-tracker --repo adelpro/open-quran-tracker`
- [ ] Or merge its git history into open-tilawa and archive the old repo
- [ ] Update any references (README already lists it)

### 4. Frontend (apps/web)
- [x] SPA in `apps/web/` (Vite + React), built and served by the `web` container
- [x] WebTorrent 3.0.21 pinned; streaming via `file.streamURL` through a service
      worker (replaced the MediaSource pump and the whole-file Blob fallback)
- [x] PWA enabled; the PWA worker and WebTorrent's streaming worker are merged
      into one `/sw.js` (see `apps/web/README.md`)
- [ ] Update client rtc-config.ts to use self-hosted TURN

### 5. Further cleanup
- [ ] Remove `uslub.backup` if no longer needed (large)
- [ ] Clean stale `.code-index/adelpro-open-tilawa-view` if open-tilawa-view moved
- [ ] Prune unused Docker images/volumes periodically

## Double folders cleaned
- Removed `/home/adelpro/open-quran-tracker` (local) — superseded by `/home/adelpro/code/open-tilawa/apps/{tracker,seeder}`; GitHub backup retained.

### 6. Deferred feature: P2P HLS (Phase 5.4)
Status: DEFERRED (not started). Registered as a future feature.

What it is: split each surah MP3 into ~10s HLS segments (~150 KB each) and serve
them via hls.js + p2p-media-loader, so peers share segments instead of whole
surahs (helios-h2020/h.extension-MediaStreaming-WebTorrent pattern).

Why deferred:
- Sharing probability is low at our scale (114 surahs x many reciters); only the
  popular surahs (Al-Fatiha, Al-Baqarah, Yasin, ...) would benefit.
- Origin bandwidth is free (archive.org web seeds), so P2P HLS's main benefit
  (offloading origin cost) does not apply yet.
- Requires re-encoding ~2280 surahs into segments + hosting segments ourselves
  (archive.org does not serve HLS), plus a player rewrite (hls.js +
  p2p-media-loader instead of <audio> + streamTo).
- Whole-file P2P via WebTorrent already covers the case where two peers want the
  same surah; HTTP range requests already give seek.

Trigger to revisit (any one):
- Move off archive.org to a self-hosted/paid origin where bandwidth is a cost.
- Add live/continuous streaming (radio, live recitation) where segments are the
  right unit.
- Evidence that specific surahs are hot enough that P2P would materially
  reduce origin load.

Minimal viable experiment (when revisiting):
1. Pick one reciter + one surah (Al-Fatiha).
2. ffmpeg -i 001.mp3 -c:a aac -hls_time 10 -hls_list_size 0 001.m3u8
3. Host segments + manifest on the web container (nginx).
4. Add hls.js + p2p-media-loader to a test page; verify sharing between two tabs.
5. Measure whether segment sharing actually occurs at our user count.

Related: keep full MP3 + `file.streamURL` (service worker range requests) + web seeds as the primary path (Phases 1-4).
