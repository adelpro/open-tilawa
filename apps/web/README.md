# Open Tilawa web app

Vite + React SPA. Two things make it unusual, and both live in the service
worker: it is an installable PWA, and it streams Quran recitations out of a
WebTorrent swarm through the same worker.

## Build

```bash
npm install
npm run dev      # http://localhost:3000 (service worker enabled in dev)
npm run build    # tsc && vite build -> dist/
npm run preview  # serve dist/
```

`npm run build` emits `dist/sw.js` plus `dist/workbox-*.js`. The WebTorrent
bundle is **not** bundled by Vite: `public/webtorrent.min.js` is a vendored copy
of `webtorrent@3.0.21/dist/webtorrent.min.js`, loaded at runtime by
`src/components/torrrent.tsx` (`import("/webtorrent.min.js")`).

## One service worker, two jobs

A browser allows **one** service worker per scope, and the app needs scope `/`
for both jobs:

| Job | Code | Requests it answers |
|---|---|---|
| PWA | `src/sw.js` (Workbox precache + SPA navigation route) | navigations, precached assets |
| WebTorrent streaming | `src/service-worker/webtorrent.js` | `/webtorrent/<infoHash>/<path>` |

They are merged in `src/sw.js`, which imports the WebTorrent fragment **first**
so its listener gets the first chance to respond. They never claim the same
request: WebTorrent matches only `/webtorrent/*`, Workbox matches only precached
URLs and navigations.

`src/service-worker/webtorrent.js` is a verbatim copy of
`webtorrent@3.0.21/dist/sw.min.js` (minus its sourcemap comment). It relays each
`/webtorrent/*` request to a window client over a `MessageChannel`; the page
streams the requested byte range back, so `<audio>` sees an ordinary 206
response and can seek.

Do not replace it with a hand-written handler: the keepalive/cancel/`STREAM`
message protocol has to match what `client.createServer()` expects in the page.

## Streaming path

1. `src/utils/webtorrent-client.ts` — one `WebTorrent` client per page
   (module-level singleton). It registers the worker — `/dev-sw.js?dev-sw` with
   `type: 'module'` in dev, the built `/sw.js` in production — waits for
   `navigator.serviceWorker.ready`, then calls `client.createServer({ controller })`.
   Both steps must happen **before** any torrent is added:
   `createServer` throws `server already created` on a second call, and
   `file.streamURL` throws `No server created`. Registration lives here rather
   than in `vite-plugin-pwa`'s auto-inject because `createServer` needs the
   `ServiceWorkerRegistration` object.
2. `src/hooks/use-torrent.ts` — adds the torrent with `{ deselect: true }`, so
   the 114-surah torrent does not download itself in the background. Only the
   torrent is owned by the hook; it is destroyed on unmount/reciter change, the
   client is not.
3. `src/components/audio-player.tsx` — `audio.src = file.streamURL` and
   `file.select()` for the current surah, `deselect()` on the previous one.
   Itqan-sourced reciters (and anything without a torrent file) keep the plain
   HTTP `<audio src={track.link}>` fallback.

`file.streamURL` looks like `/webtorrent/<infoHash>/<file path>`. Because the
worker is the server, the app requires a secure context (HTTPS, or localhost in
development).

## nginx (production)

`nginx.conf` has three rules that matter:

- `location = /sw.js` — `no-cache`. A cached worker stays pinned to an old
  version and keeps streaming with stale code.
- `location ~* ^/workbox-[^/]+\.js$` — `no-cache` for the worker's runtime chunk.
- `location /webtorrent/ { return 404; }` — these URLs are answered by the
  worker. If one ever reaches nginx (worker not active yet), fail instead of
  returning the SPA shell.

The generic `\.(js|css|...)$` block caches assets for a year, which is why the
exact-match worker rules must come first.

## Updating WebTorrent

The npm dependency, the page bundle, and the worker fragment must stay on the
same version:

```bash
npm install webtorrent@<version>
cp node_modules/webtorrent/dist/webtorrent.min.js public/webtorrent.min.js
head -n 1 node_modules/webtorrent/dist/sw.min.js > /tmp/sw.js   # drop the sourcemap line
# paste the existing header comment back on top of /tmp/sw.js into
# src/service-worker/webtorrent.js
```

Then rebuild and re-check streaming.

## Verifying streaming

1. DevTools → Network, filter `/webtorrent/`.
2. Play a surah: expect `206`, a `Content-Range` header, and playback starting
   while `torrent.progress` is far below 100%.
3. Seek to the middle: another `206` at the new offset, still playing.
4. A torrent whose peers are TCP/UDP only will stay slow — browsers connect to
   WebRTC peers, plus HTTP web seeds (`ws=`) when the magnet has them.

## Known limits

- `clientsClaim()` + `skipWaiting()` mean a deploy can activate a new worker
  mid-session; an in-flight stream is interrupted and resumes after reload.
- The worker's `ReadableStream` is cancelled if the page is backgrounded long
  enough to be frozen; playback restarts from the last buffered position.
- iOS Safari needs HTTPS and a first-load navigation before the worker controls
  the page; the very first play on a fresh origin may fall back to the HTTP
  source link shown in the error state.

## The player screen

Three edges and no router: a top bar (wordmark + menu), the player column, and
a bottom bar (list, speed, stream status). Lists, settings and the two
informational pages are bottom sheets on native `<dialog>`. The design source of
truth is
[`docs/superpowers/specs/2026-10-26-tilawa-web-player-chrome-design.md`](../../docs/superpowers/specs/2026-10-26-tilawa-web-player-chrome-design.md),
on top of the minimal-player spec it extends.

- `src/app/player-page.tsx` — the whole surface: reciter chip, surah name in
  Amiri, scrubber, five transport controls, one line of error text.
- `src/components/top-bar.tsx` — wordmark and the one `⋯` that opens settings.
- `src/components/bottom-bar.tsx` — current surah + list button, playback speed,
  and the signal button. `details-popover.tsx` is v1's stream readout (peers,
  download/upload, downloaded, progress, files, source).
- `src/components/sheet.tsx` — surah rows (verses, juz, file size once the
  torrent knows it) and reciter rows (source host, completeness, P2P/HTTP), on
  native `<dialog>`: focus trap, backdrop, Escape and focus return are the
  platform's job.
- `src/components/audio-engine.tsx` — the only `<audio>` element, mounted beside
  the page. It owns the torrent session, the stored position and the playback
  rate, nothing else.
- `src/hooks/use-player-nav.ts` — the only path from "play this surah" to a
  state change; previous/next clamp at 1 and 114 instead of wrapping.
- `src/hooks/use-persistence.ts` — `open-tilawa:v2` (per-reciter positions,
  `theme`, `rate`) plus a migration from the v1 keys. Cold start restores the
  last reciter and surah, paused, and never autoplays.
- **Theme**: white is the identity and the default; `[data-theme="dark"]` is
  v2's night palette, applied before the first paint in `main.tsx`.
- **Language**: Arabic only in this phase. The menu shows the row with English
  marked "قريباً"; the copy table, English names and `dir` flipping are a
  separate spec.
- Fonts are self-hosted (`public/fonts`, generated `src/app/fonts.css`): IBM Plex
  Sans Arabic 400/600 for UI and Amiri 400 for surah names and the wordmark,
  SIL OFL 1.1 (see `public/fonts/OFL.txt`).

Run the logic tests with `npm test` (node:test, no extra dependencies).
