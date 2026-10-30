# Changelog

## 1.10.6 — 2026-10-30

Patch. App versions: **web 1.10.6**, **admin 1.29.1**, **seeder 1.4.3**.

### Changed

- **The title's chevrons are toggles.** The arrow that opened the surah or
  reciter panel now closes it too, turns over while the panel is open, and
  reports `aria-expanded` — pressing the word a second time no longer needs the
  panel's own close button.
- **The surah number sits with the surah's facts.** The seal above the title was
  the first thing read in a header whose subject is the name. It is now a 20px
  ring at the start of the verse-count / juz line, on that line's 12px type, so
  the block reads name → reciter → facts.

## 1.10.5 — 2026-10-30

Patch. App versions: **web 1.10.5**, **admin 1.29.1**, **seeder 1.4.3**.

### Fixed

- **موجات reaches both edges.** The ribbon read the spectrum on a nearly linear
  axis, so the top octave — where a recitation has nothing — took as much of the
  width as the four octaves below it. On a 520px block that left the last fifth of
  the strip on the floor, and the wave looked cut off before the edge. The axis is
  now log-spaced from 90 Hz to 16 kHz: the band that carries the voice gets most
  of the width, the treble fades out over the last few columns instead of flatly,
  and the DC bin is skipped so the bass edge has no notch.

## 1.10.4 — 2026-10-30

Patch. App versions: **web 1.10.4**, **admin 1.29.1**, **seeder 1.4.3**.

### Fixed

- **The riwaya is said once.** 1.10.3 appended the reading to the reciter line
  even when the catalogue already carries it in the name — "ياسين الجزائري
  (ورش) · ورش" — so the same word arrived twice. The suffix now shows only when
  the name does not already name that reading.
- **The title sits on the centre line.** The chevron took its own width out of
  the title, drawing the surah name about twenty pixels off centre. A spacer
  the size of the glyph keeps the word itself on the line.

## 1.10.3 — 2026-10-30

Patch. App versions: **web 1.10.3**, **admin 1.29.1**, **seeder 1.4.3**.

### Changed

- **The player's title is a colophon.** The desktop stage opened with a 56px
  surah name floating at 22vh and a 16px reciter line 72px under it — two bare
  strings in an empty screen, with the "open" chevrons at 30% opacity and only on
  hover. It is one anchored block now: the surah number in a hairline seal, the
  name at `clamp(32px, 3.4vw, 52px)` with no negative tracking (the old value
  broke the rule against negative tracking on Arabic), the reciter as a real pill
  that carries the riwaya when the catalogue knows it, and the verse count and
  juz as the quiet last line. The block uses the `.theatre-title` class the
  stylesheet already carried, so a pinned panel finally centres it on the stage
  instead of the whole viewport.

## 1.10.2 — 2026-10-30

Patch. App versions: **web 1.10.2**, **admin 1.29.1**, **seeder 1.4.3**.

### Fixed

- **موجات is a spectrum again.** 1.10.1 turned the ribbon into a scrolling
  history of loudness: one number every 60 ms, newest at the right edge, so a
  syllable crossed the block as a travelling needle and the strip fell back to the
  floor between ayat. The ribbon now reads the same frequency bands as the bars —
  x is frequency again — and each of its four layers holds every band with its own
  rise and fall. Nothing moves sideways; the shape stands still and only its
  height follows the recitation.

## 1.10.1 — 2026-10-30

Patch. App versions: **web 1.10.1**, **admin 1.29.1**, **seeder 1.4.3**.

### Changed

- **Mail & alerts is two tabs.** Outbound email and Alerts sat stacked as two
  panels, so the screen opened as one long scroll and read as a different kind of
  page from Seeders, Status and Tools. It now uses the same `Tabs` component and
  the same page header as those screens: one tab in the tab order, arrows and
  Home/End between them, and a panel that names the tab it belongs to.

## 1.10.0 — 2026-10-30

Minor. App versions: **web 1.10.1**, **admin 1.29.0**, **seeder 1.4.3**.

### Added

- **A daily status mail.** One message a day at an hour you set, listing every
  service, node and TURN server with its state, its 24-hour uptime and its
  latency, the free space on each node, and how many alerts are open. It is sent
  whether everything is up or not, on purpose: an inbox that only ever carries
  problems cannot be told apart from a mailer that stopped, so the daily green
  message is what makes silence mean something. The day is recorded, so a
  restart in the same hour cannot send twice, and the mail is written in each
  recipient's language.

### Changed

- **The console screen is called "Mail & alerts"** — `البريد والتنبيهات` — in the
  nav and as its title. It was "Settings", which read like a personal page next
  to Account while holding one shared credential and one fleet-wide rule set.

## 1.9.2 — 2026-10-30

Patch. App versions: **web 1.10.1**, **admin 1.28.0**, **seeder 1.4.3**.

### Fixed

- **The spectrum ribbon is a loudness history, not a pitch contour.** It was
  low-passing signed time-domain samples from unsynchronised snapshots, which
  aliased against the read rate: the height followed the reciter's pitch (14% to
  82% of the strip in simulation) and the twitch was an artefact. The strip now
  scrolls a peak envelope left at a fixed speed — one point per 60 ms, about 14 s
  across — with each layer keeping its own rise and fall, and frequency-bin work
  is skipped in ribbon mode.

This release also carries the 1.9.1 change below: the launch film is in the
repository.

## 1.9.1 — 2026-10-30

Patch. App versions: **web 1.10.0**, **admin 1.28.0**, **seeder 1.4.3** — no app
code changed in this release.

### Added

- **The launch film is in the repository.** `film/` carries the composition
  sources, the audio beds, the capture set and the finished renders, with the two
  notes and the storyboard beside them. It is 49 MB across 104 files; a clone now
  pays for that, and the alternative — an LFS remote or an external asset host —
  was not in place.

## 1.9.0 — 2026-10-30

Minor. App versions: **web 1.10.0**, **admin 1.28.0**, **seeder 1.4.3**.

### Added

- **Mail is configured in the console, at runtime.** `/console/settings` holds the
  SMTP host, port, TLS mode, username, From address and password. A save is
  verified against the provider before it is written, so a typo cannot replace a
  working transport with a broken one, and the change takes effect on the next
  message — no recreate, no deploy. The password is stored AES-256-GCM under
  `MAIL_SECRET` and is never returned by any route, only `hasPassword`.
  `EMAIL`/`EMAIL_APP_SPECIFIC_PASS` remain the bootstrap: the first-run setup
  token is mailed before any admin can sign in, so the environment is the only
  configuration that exists at that point. Clearing the console falls back to it.
- **Four operator alerts, mailed and deduplicated.** Service down (three
  consecutive failed checks), pinned node offline (fifteen minutes without a
  poll), disk headroom under the floor, and a failed node update. One message
  when a condition opens, one when it clears, suppression under ten minutes and a
  one-hour cooldown after a resolve, so a flapping dependency cannot train anyone
  to ignore the inbox. Recipients are every active admin, each in their own
  language, plus optional extra addresses. The rules read what the status, seeder
  and TURN pollers already stored — nothing new is measured.
- **An install prompt backed by real captures.** Five screenshots of the running
  player (three phone, two desktop with `form_factor: 'wide'`), regularised by
  `scripts/screenshots.mjs`, with a test that reads the PNG headers so a capture
  at a new viewport fails the suite instead of the manifest.

### Changed

- **The riwaya is named the way the catalogue stores it.** `al-Duri` becomes
  `al-Douri`, with the old spelling kept as an alias so no stored row has to be
  migrated — both open the form on the same reading.
- **Every published contact address is `tilawah.cc`.** The About page, the console
  footer, the legal pages, the SEO copy and the seeder/tracker image labels
  replace the two earlier domains.
- **The alert panel reports the source the transport is actually using.** A stored
  configuration whose password this process cannot decrypt says so, rather than
  claiming a configuration that is not in use.

### Fixed

- An alert whose first mail never left the process is re-sent instead of being
  lost behind its own dedupe row.
- The resolve path is atomic, so two overlapping passes cannot both mail
  "recovered".
- A blank From address falls back to the username instead of shipping a message
  with no From header.
- Node update failures survive a restart, so a recreate no longer mails a false
  "update recovered".

The seeder stays at **1.4.3**: its only change in this release is the maintainer
address in the image label.

## 1.8.2 — 2026-10-29

Patch. App versions: **web 1.9.3**, **admin 1.27.2**, **seeder 1.4.3**.

### Changed

- **The About page answers what a listener actually asks.** Six sections replace
  the four paragraphs: how the sound reaches you, what happens when nobody else
  is listening, what a ring syncs and what nobody can restore for you, what to
  know before relying on it, where the recordings come from, and that the code
  is open. Every number in it is a number in the code — the 8-second grace
  before the web seed, the 1 MB/s per-connection cap, the seed that stays
  attached after peers appear — and the riwaya line states the rule the
  catalogue already keeps: an unknown reading is not guessed at.

## 1.8.1 — 2026-10-29

Patch. App versions: **web 1.9.2**, **admin 1.27.2**, **seeder 1.4.3**.

### Changed

- **The node's torrent table sorts.** الاسم، الحجم، على الخادم and الأقران are
  buttons now, the same contract as the reciter table: clicking the active
  column flips the direction instead of resetting it, `aria-sort` carries the
  ordering for a screen reader, and the arrow is decoration. "على الخادم" orders
  by severity — healthy, stale, orphan — because sorting the labels would group
  rows by spelling.

## 1.8.0 — 2026-10-29

Minor. App versions: **web 1.9.2**, **admin 1.27.1**, **seeder 1.4.3**.

Seven new recitations, three readings beyond Hafs, and an About page that stops
claiming more than the app does.

### Added

- **Seven recitations; ten in the roster.** Hafs: Basfar, Alhusari, Al-Minshawi.
  Warsh: ElSaltani, Saber Abdulhakam. Qalon: ElSaltani. al-Douri: Saber
  Abdulhakam. Imported from the Itqan catalogue, seeded from the node, and
  published with Arabic names and the sizes the node actually holds.
- **The About page credits the source.** The recordings come from the Itqan
  community catalogue; rights stay with the reciters and the publishers.

### Changed

- **"No account" became "no account needed".** Listening never asks for one, and
  the page now says what a ring is for: settings and favourites carried across
  the devices you connect.
- **Privacy says what a ring adds.** Three outbound calls while listening; a
  connected ring adds the sync relay, and only while it is connected.

### Fixed

- **The privacy page ignored its own translations** and rendered a hardcoded
  Arabic list, so an English reader was given Arabic. It now renders
  `privacy.items`, and the two locales can no longer disagree.

## 1.7.0 — 2026-10-29

Minor. App versions: **web 1.9.0**, **admin 1.27.0**, **seeder 1.4.3**.

One icon language, one rhythm, one form anatomy — and the bugs that only showed
up once the two apps were put side by side.

### Changed

- **One icon system.** Both apps take Phosphor through `components/icons.tsx` at
  16, 20 or 24, `regular` weight, `fill` only as a state. The player's 17
  hand-drawn glyphs, its four inline SVGs and the `▾ ✎` characters are gone;
  `wifi-waiting` stays because Phosphor cannot animate its arcs.
- **One spacing rhythm, in rem.** The 4px scale in both apps, six type steps in
  the player, and `<meta name="text-scale">` so the OS text setting reaches the
  page. The sheet's search icon now lines up with its rows.
- **One form anatomy.** 44px controls, 16px input text, visible labels,
  `aria-describedby`/`aria-invalid` wired by the field itself, tokenised errors.
  The create-ring and paste-ticket flows are real `<form>`s.
- **The theme switch cross-fades** in 180ms through the View Transitions API,
  skipped under reduced motion.
- **Cards have a heading and a footer.** `NodeCard` names itself with an `<h2>`
  and puts its actions in a `<footer>`.

### Fixed

- **The skip buttons pointed the wrong way in English.** They were hardcoded
  left/right and only correct in Arabic; `back`/`forward` now flip with the
  document.
- **The footer named the action, not the surah.** "قائمة السور" replaced the
  visible surah name in the accessible name — a WCAG 2.5.3 failure Lighthouse
  found on three nodes.
- **An admin field's error was announced with no field attached.** `Field`
  rendered the hint and the error and associated neither; the control now gets
  both ids, and the hardcoded English "Error: " prefix is gone.
- **The admin wordmark was squeezed into a 28px square** (512×240 pinned to both
  sides).
- **The admin back links pointed left in Arabic.** They use the mirrored `back`
  glyph now.

### Verified

- Lighthouse, production builds: web a11y 100 / SEO 100 / best-practices 96,
  admin a11y 100 / SEO 100 / best-practices 96. The remaining console error is
  the roster fetch CORS-blocked from localhost, not a page defect.
- 200% text scale: no horizontal overflow and no clipped text on the player,
  settings or about.
- `test/icons.test.ts` guards the contract: one import site, the size scale, no
  glyph characters, rem type, no half-step spacing.

## 1.6.2 — 2026-10-29

Patch. App versions: **web 1.8.1**, **admin 1.25.2**, **seeder 1.4.3**.

Three readouts that were wrong at the edges: a fractional speed, a quiet
recitation, and a healthy relay on a high address.

### Fixed

- **A sub-byte transfer reads `0 B/s`.** WebTorrent reports fractional speeds
  (0.8 B/s); a negative unit exponent indexed off the start of the ladder and
  the stream sheet printed `819 undefined/s`. The admin seeder readout carried
  the same formula.
- **A healthy TURN server on a 154.x address is reported as online.** The IPv4
  XOR decode used a signed `^`, so any first octet ≥ `0x80` threw and coturn's
  correct reply was logged as a malformed STUN reply.
- **The wave holds its height.** Recitation peaks sit at 0.05–0.2 of full scale,
  so the ribbon drew a ripple on the floor; an automatic gain lifts a quiet
  recitation toward the block without attenuating a loud one.

### Changed

- **The wave settles instead of flickering.** The gain and the envelope it
  follows are low-passed and the layers follow more slowly, so the strip
  breathes with the recitation rather than twitching on every syllable.

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
