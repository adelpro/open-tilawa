# Changelog

## 1.5.4 — 2026-10-27

Patch. App versions: **web 1.4.4**, **admin 1.24.0**, **seeder 1.4.2**.

### Changed

- The stream source is named by transport, not by prose: **`P2P`**, **`HTTP`**, and
  **`P2P + HTTP`** when both are feeding the torrent. `waiting` still reads
  «بانتظار الأقران» because it is a state, not a source.

## 1.5.3 — 2026-10-27

Patch. App versions: **web 1.4.3**, **admin 1.24.0**, **seeder 1.4.2**.

### Fixed

- **The source said "من الخادم" with peers connected.** The web seed is never
  removed once added, so the label was pinned to it. There is now a fourth state,
  «الأقران والخادم», for a torrent fed by both — which is the normal case after
  a slow first peer.
- **`.torrent` files were cached for a year as immutable.** A corrected announce
  list was masked by the CDN (`cf-cache-status: HIT`) and clients parsed a broken
  file. They are now `no-cache`, and the client requests
  `/torrents/<hash>.torrent?v=<version>` so a fix always busts the cache.
- Announce lists in the served torrents were rewritten to the seven trackers that
  answer; the compose-internal `tracker:8083` no longer leaks into a file the
  browser downloads.

## 1.5.2 — 2026-10-27

Patch. App versions: **web 1.4.2**, **admin 1.24.0**, **seeder 1.4.1**.

### Fixed

- `wss://tracker.fastcast.nz` no longer resolves; it left the browser announce
  list, which now carries only the project tracker and two public WebSocket
  trackers that answer.

## 1.5.1 — 2026-10-27

Patch. App versions: **web 1.4.1**, **admin 1.24.0**, **seeder 1.4.1**.

### Fixed

- **The Itqan importer crashed when the seeder was running.** The one-shot client
  asked for port 6881, which the node already holds; uTP answered
  `UTP_ECONNRESET` before the `.torrent` was written. It now takes an ephemeral
  port and leaves DHT, LSD and uTP discovery to the node.
- **Dead trackers removed.** `wss://tracker.btorrent.xyz` answers connection
  refused and is gone from the browser list; fourteen long-dead UDP/WS trackers
  left the node list. The project's own tracker now leads the browser announce
  list.

### Notes

- Deploy: rebuild `web`; recreate `seeder` on the `seeder-v1.4.1` image.

## 1.5.0 — 2026-10-27

Repo release. App versions: **web 1.4.0**, **admin 1.24.0**, **seeder 1.4.0**.

### Added

- **Catalogue-owned roster.** `reciters.published` decides what the player shows;
  `GET /api/public/reciters` returns only published rows and now carries their
  `id`. The admin console gets a publish switch, so curation no longer needs a
  deploy.
- **HTTP fallback inside WebTorrent.** After 8 s with zero peers the client adds
  `https://<origin>/media/` as a BEP19 web seed. Pieces are verified against the
  torrent hashes, stored, uploaded to other peers, and peers are used in parallel
  if they appear. The `<audio>` element never changes source.
- **`/media` on the web container.** `seed_downloads` is mounted read-only and
  served by nginx with `try_files … =404` and `limit_rate 1m`, matching the path
  WebTorrent builds (`<folder>/<NNN>.mp3`).
- **Stream sheet truth.** It now reports the live source (peers / server /
  waiting) and, for the current surah, whether the fallback exists — one cached
  `HEAD` per surah opened.
- **Desktop "quiet stage".** On ≥ 1024 px: no bottom sheets and no hamburger.
  Lists open as a 360 px panel docked to the reading edge, non-modal, the stage
  re-centres beside it, and the list can be **pinned** so picking a reciter keeps
  it open. Four-word navigation in the header, a 160 px spectrum horizon, and a
  1 px floor line that stays when paused.
- **Keyboard shortcuts on desktop** — `Space`, `←/→` (15 s), `↑/↓` (surahs), `R`,
  `S`, `M`, `?`, `Esc`. Registered only for wide layouts with a fine pointer,
  ignored while typing, with a first-visit hint and a `?` panel on demand.
- **Itqan import for seeders** (`apps/seeder/import-itqan.mjs`): API key plus
  `X-Client-Name`/`X-Client-Version`, the 114-track truncation guard, a real disk
  quota check, size verification and an overwrite guard.
- **`docs/STREAMING.md`**: the full flow, cold start, the no-peer path, MP3
  range streaming, failure modes and what is deliberately absent.
- Meta description, canonical URL, Open Graph/Twitter tags, and preloads for the
  two Arabic font subsets.

### Changed

- **Riwaya is data.** `Hafs`, `Warsh`, `Qalon`, `unknown` — there is no code-side
  default to `Hafs`; the code table and the seeder import no longer invent one.
- **The web has no reciter list in its bundle.** Rows come from the catalogue and
  the last good payload is cached in `localStorage`; an outage costs freshness,
  not playback.
- `APP_VERSION` is read from `package.json`; one version string to bump.
- Paused playback hides the spectrum entirely.
- About, Privacy and Settings get a 700 px measure and more air on desktop.

### Fixed

- Duplicate reciters (Maher twice, Husary three times, a stale Wadih hash that
  came back from the dead) — one row per person, straight from the catalogue.
- The service worker no longer claims `/media`; 206 responses are not cacheable
  and a cached whole file would have poisoned range requests.
- An empty or unreachable roster says so with a retry instead of looping a
  torrent error.
- The seeder importer refuses an existing folder a live torrent is serving, and
  it checks quota and free space before downloading.
- The footer's two name rows no longer overflow their container.

### Notes

- **Deploy order:** admin API → data step (unpublish the twelve, publish the
  eight, set riwaya) → web → import the two Itqan recitations → publish them.
- Itqan licensing is still unresolved; rights remain with the reciters and
  publishers, and the release does not claim otherwise.
- `/media` serves the seeder in the same compose stack (the primary node), not
  the whole fleet.
- Inline snapshot of the earlier release: repo `1.4.0` / web `1.3.5` /
  admin `1.23.2` / seeder `1.3.3`.
