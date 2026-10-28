# Changelog

## 1.6.1 — 2026-10-29

Patch. App versions: **web 1.8.0**, **admin 1.25.1**, **seeder 1.4.3**.

Completes the catalogue screen, which shipped in 1.6.0 an hour earlier without
being able to answer its own questions.

### Added

- **A scope filter on the catalogue.** It listed all 22 rows, so three live
  reciters read as two dozen releases. Published is the default; the 19 drafts
  are one click away, and the count is on the button.
- **Sortable columns** — name, riwaya, size, coverage — with `aria-sort`, because
  "which reciters are on no node" was answerable only by scanning.
- **A confirmation before sending the catalogue to the nodes**, carrying the
  numbers the plan already computed: how many reciters move, and how many the
  90 % cap leaves behind.

### Changed

- **Table screens use the width.** The eight-column table was crushed into
  1000 px on a large display; those screens now take up to 1440 px, while prose
  keeps its measure.
- **The placement popup says so when there is only one node** to place on.

## 1.6.0 — 2026-10-29

Minor. App versions: **web 1.8.0**, **admin 1.25.0**, **seeder 1.4.3**.

The release where the console stopped describing the system and started
recording it.

### Added

- **Placement.** The catalogue now records what was asked of each node —
  `pending`, `placed`, `failed` — instead of leaving the operator to compare two
  lists by eye. A request becomes `placed` only when the node reports it, and
  fails after three hours if it never does, or when a node stops reporting a
  torrent it used to hold.
- **Coverage on every reciter.** Four states, each with one action: healthy,
  *not seeded* (published and held by nobody — the one a listener feels),
  *unpublished* (disk spent on what the site hides), dormant.
- **Place and unplace from Reciters.** One row per node, sorted by free space,
  refusing a node that cannot fit the release.
- **The pinned node.** The seeder this dashboard runs is recognised by its URL
  host and sits at the top of the fleet with its own row treatment, because if it
  is down the site is down.
- **Version drift.** Desired (the checkout, or the image tag) versus running
  (the node's own `/health`), per node.
- **"Make nodes complete."** Fills every node from the catalogue and stops at
  90 % of its quota, then says how many reciters it left out.
- **A seeder poll every five minutes**, so the fleet's numbers are true without
  anyone clicking. The dashboard had been showing `22 torrents · 32.7 GB` for a
  node holding three.
- **`normalise.mjs`**, a tool that turns a downloaded folder into a library
  entry: files renamed to `001.mp3`…`NNN.mp3`, everything that is not the mushaf
  dropped, the release name stripped of source tags, and a fresh torrent with
  our announce list and a `url-list` web seed.
- **An eight-step node tutorial** covering disk sizing, `6881/udp`, placement and
  the 90 % rule — the parts that actually bite someone standing up a node.

### Changed

- **Three surfaces became two nouns.** Reciters is the catalogue and its
  placement; Nodes is the fleet. `/dashboard/torrents` — a node page with a node
  chosen silently — is gone, and so is its sidebar entry.
- **The node screen stops creating.** A torrent enters through the catalogue,
  which is what decides where it goes; the node keeps only repairs.
- **Deleting on a node means deleting the data.** The confirm says so, and
  unplacing is the separate action that stops seeding while keeping the files the
  HTTP source serves.
- **The book's torrents were rebuilt.** Every published reciter is 114 files
  named `001.mp3`…`114.mp3`, one whole mushaf per release, with our tracker
  first, the public ones beside it, and a `url-list` pointing at `/media/`.
  `(MP3_Quran)` and `_Update2` are gone from the names — they were the source
  site's metadata, and they travelled into the torrent name, the magnet and the
  web-seed path.
- **Magnets carry `xs`.** Metadata arrives over HTTP even with no swarm peer,
  which is what makes an HTTP-only reciter playable.
- **The TURN credential comes from the build.** It used to be a hardcoded
  fallback, so a working relay password shipped in the bundle four times.
- **TURN logs to stdout** instead of writing 762 MB a day into its own container.

### Fixed

- **Deleting a torrent killed the seeder.** `client.get()` is async, so the guard
  never fired and `torrent.destroy` threw on a promise — every delete took the
  node down mid-request. It also left the payload on disk and the `.torrent` in
  place, so the next restart re-added the whole release.
- **A fresh admin database could not be created.** `reciters` existed only
  because a service created it at request time, so migration 017 failed on any
  empty database. It is a migration now (`015_reciters.sql`).
- **Production was offline.** Both compose files declared `edge`, `web` and
  `tracker` in the same project, so a staging deploy *replaced* the production
  containers. Staging has its own project in the fix, and for the alpha it is
  gone entirely: one environment, one file.
- **A sheet opened over another closed itself.** The history entry belongs to the
  layer now, not to each sheet.
- **The camera panel** names why it could not open, and releases the stream when
  the sheet closes instead of leaving the light on.

### Removed

- **The staging stack**, its volumes, its tunnel hostname and its env file.
- **`turn-tls.quran.us.kg`** and the TLS listener coturn never opened — no
  certificate, and a raw TCP tunnel cannot pass through the HTTP proxy anyway.
- **The Tailscale endpoints** from the ICE config: dead candidates for every real
  listener, and they published the tailnet's address.

## 1.5.12 — 2026-10-27

Minor. App versions: **web 1.7.0**, **admin 1.24.0**, **seeder 1.4.2**.

### Added

- **A ring has a name.** Creating one asks for it, prefilled with the device
  name, so «حلقتك» reads «حلقة عادل» instead of a device label or an em dash.
- **Joining without a camera.** A desktop has no camera to point at a phone, so
  the pairing code can be copied as text («نسخ الرمز») and pasted on the other
  device under «إدخال الرمز يدوياً». If the camera fails to open, that field
  appears by itself instead of leaving the listener stuck on an error.

### Fixed

- **A fresh ring showed «0 أجهزة» and «لا أجهزة مسجّلة بعد».** The device row was
  only added when the relay echoed it back, so the sheet contradicted itself for
  the length of a round trip — or forever if the echo never came. The row goes
  into the list immediately and the echo only confirms it.
- **The ring name could render as «—».** It now falls back to the device name
  while the account's own name is still in flight.

## 1.5.11 — 2026-10-27

Patch. App versions: **web 1.6.1**, **admin 1.24.0**, **seeder 1.4.2**.

### Changed

- **The pairing code is a popup.** «إظهار رمز الربط» now opens the code centred on
  screen at 240 px, with «توليد رمز جديد» and a close button, instead of dropping
  a block into the sheet where the other person had to squint at it.

### Fixed

- **Signing out did nothing.** The key was erased, but the sheet stayed mounted and
  Gun's `leave()` clears `user.is` without emitting an `auth` event, so nothing
  re-read the state and the account still looked signed in. The atoms are reset
  explicitly now.
- **The auth subscription removed Gun's own listeners.** Each component registered
  its own `gun.on('auth')` and called `gun.off()` on unmount — and `off()` takes no
  argument, so it stripped *every* listener on the root, the network's included.
  There is one subscription for the app now, registered once and never removed.

## 1.5.10 — 2026-10-27

Minor. App versions: **web 1.6.0**, **admin 1.24.0**, **seeder 1.4.2**.

### Added

- **The ring.** An account is now named for what it is: one key, and every device
  that holds a copy of it. The sheet reads «حلقتك» with the device count, and the
  two halves of the handshake are named for the side you are on.

### Changed

- **A device in the ring is never offered the scanner.** It has a key already, so
  the only thing it can do is lend it: «إضافة جهاز» shows the pairing code and
  nothing else. Scanning belongs to a device with no key yet — «الانضمام إلى
  حلقة» — which is joining a ring rather than adding to one.
- **The camera takes over the sheet.** The viewfinder now fills the visible area
  instead of starting below the create card, where the panel clipped it. The
  other cards leave the flow while the camera is open.

### Fixed

- The scanner was started from the click handler, racing the render; it is
  started from an effect once the reader element exists.

## 1.5.9 — 2026-10-27

Patch. App versions: **web 1.5.1**, **admin 1.24.0**, **seeder 1.4.2**.

### Changed

- **There is no username and no password.** An account is a key generated in the
  browser; that key is the identity, and another device gets it by scanning a
  pairing code. The sign-in form is gone, and so is the copy that implied a
  password could recover an account.

### Fixed

- **The account died when the browser closed.** Gun's `recall()` only ever
  writes to sessionStorage, so the keypair was lost with the tab and every
  restart needed a fresh scan. It is now kept in localStorage, and signing out
  erases it.
- **Primary buttons were invisible in the dark theme.** They used `text-surface`,
  a colour token that does not exist in this palette, so the label inherited the
  ink colour and sat dark-on-dark (light-on-light in the night theme). They use
  `text-invert`, the house pairing for `bg-ink`.
- **The account sheet changed height when switching tabs.** With `size="auto"`
  the panel grew and shrank under the finger; the body now has a fixed height and
  scrolls.

## 1.5.8 — 2026-10-27

Minor. App versions: **web 1.5.0**, **admin 1.24.0**, **seeder 1.4.2**.

Favourites and listen counts, and an account that carries them between devices.

### Added

- **A favourite button on every reciter**, with the public totals beside it: how
  many listeners favourited that reciter and how many times it was played.
- **Two personal scopes in the reciter sheet** — «مفضّلتي» and «آخر ما استمعت»
  (the last ten you opened, newest first) — next to the two public sorts.
- **Accounts over the self-hosted gun relay** (`gundb-relay.quran.us.kg`).
  Sign up with a username and password, or link a second device.
- **Device linking by QR.** The code carries a one-time key, not the account key:
  the real keypair sits on the relay encrypted to a throwaway pair for two
  minutes and is deleted on first successful scan.
- **A device list** with rename, a `this device` marker, a `primary` badge, and
  last-seen times.
- **A schema stamp** on the account graph (`version: 1`) with forward migrations.

### Changed

- **Signing out refuses to run on the last device** without typing the
  confirmation, because there is no password reset and the account would be lost.
- **Favourites work signed out.** They live in this browser first and union into
  the account on login, so nothing made before signing in is dropped.
- **The heart and eye glyphs are Phosphor icons** (`Heart`, `Headphones`) rather
  than text symbols, with tabular counts.

### Fixed

- **Clients were pinned to the build that installed the worker.** Navigations
  served `index.html` from the precache, so a client whose worker never updated
  kept an old build's HTML and hashed bundles indefinitely — the files those
  bundles pointed at were long gone from nginx. Navigations are network-first now
  (2 s) with the precached shell as the offline fallback. A deploy reaches people
  on their next load.
- **Two quick favourites lost one count.** Bumps are serialised per reciter; two
  toggles in the same millisecond used to tie on Gun's state clock and leave the
  tab stale until reload.
- **A fresh account never got a schema stamp.** `.once()` on a path the relay had
  never seen does not always answer, and the write sat behind it. Reads are
  bounded now.
- **The device list said "no devices" after signing in.** The login snapshot
  replaced the atom after this device had already written its row; it merges.
- **The account sheet showed an 80-character key as the username.** `recall()`
  drops the alias, so it is stored in the account profile and read back.
- The favourite button announced itself in English on an Arabic screen.

## 1.5.7 — 2026-10-27

Patch. App versions: **web 1.4.7**, **admin 1.24.0**, **seeder 1.4.2**.

### Changed

- **The waves are throttled.** Per-layer smoothing dropped by roughly half
  (0.22/0.14/0.10/0.07 → 0.13/0.09/0.065/0.045) and the analyser is read every
  second frame, so the spectrum breathes at ~30 Hz instead of twitching at 60.

## 1.5.6 — 2026-10-27

Patch. App versions: **web 1.4.6**, **admin 1.24.0**, **seeder 1.4.2**.

### Changed

- **The spectrum is waves, not one hairline.** «الطيف» now draws four layered
  traces of the time-domain signal — different smoothing, gain and phase per
  layer — so it reads as 3–5 moving waves that grow and shrink instead of a
  single line pinned to the floor.
- Waves is the default shape (`ribbon` keeps its stored key; the label is now
  «موجات»). Bars and peaks keep their gamma lift and throttle from 1.5.5.

## 1.5.5 — 2026-10-27

Patch. App versions: **web 1.4.5**, **admin 1.24.0**, **seeder 1.4.2**.

### Changed

- **The spectrum is legible at ordinary levels.** Bars and peaks lift the analyser
  value by a gamma (0.65) before it becomes pixels, so a normal voice reads at
  half height instead of a hairline; the floor bar is 3 px.
- **Throttled, not twitchy.** Bars rise fast (0.5) and fall slowly (0.14); the
  ribbon follows a smoothed loudness with the same asymmetry, so quiet passages
  keep a readable shape without per-frame jitter.
- The desktop horizon draws at 90 % ink instead of 70 %.

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
