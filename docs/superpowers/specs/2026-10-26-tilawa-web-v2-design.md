# Open Tilawa Web v2 — "Night Listening Room" — Design

- **Date:** 2026-10-26
- **Status:** design approved in conversation; awaiting spec review
- **Scope:** `apps/web` only. No API, admin, or seeder changes.
- **Supersedes:** the paper/light identity in `/DESIGN.md` for the web app. The
  root `DESIGN.md` stays as the Uslub reference; a web-specific `DESIGN.md`
  section is appended in phase 1 (see §10).

## 1. Intent

Today the app is a phone-width column with two modals. Choosing a reciter is a
dialog, choosing a surah is a dialog, the playlist is a flat list of names with
no meta and no current-track state, and every player detail lives in local
component state so the track is lost on navigation. On desktop it is a phone
app in the middle of a large screen.

v2 rebuilds the **whole experience** — layout, information architecture, queue,
and player — around one direction: a dark listening room where the player is the
centre of the app and the recitation, not chrome, holds the eye.

**Success criteria**

1. Any listening state is reachable, linkable, and survives refresh and
   navigation (`/reciter/:id/:surah`).
2. Reciter and surah selection happen on real surfaces; **no modal is required
   to start playing**.
3. Playback continues while the user browses elsewhere in the app, on both
   mobile (mini-player) and desktop (fixed centre zone).
4. The queue shows all 114 surahs with per-row metadata and a current-track
   marker.
5. The player never shifts layout between connecting, playing, and error states.
6. Dark is the default and the identity; a light variant exists for daylight.

**Non-goals (v2)**

- No drag-to-reorder queue. The mushaf order is the point; shuffle is the only
  reordering.
- No ayah-level playback, tafsir, or translation.
- No accounts, sync, or server-side favourites (the app is local-first).
- No new UI dependency. Tab bar, sheet, scrubber and equaliser are hand-built.
- No Virtual DOM list virtualisation. 114 rows does not need it.

## 2. Design direction

Anchor references (`designmd`):

- **`ios-tidal`** — true-black canvas, tonal elevation, one accent meaning one
  thing, no shadows, gallery negative space, crossfade-only motion.
- **`ios-youtube-music`** — the hero is a single large element and the chrome
  recedes around it; dense lists, generous player.

### 2.1 Colour tokens (dark, default)

| Token | Value | Role |
|---|---|---|
| `--canvas` | `#000000` | the entire app background |
| `--surface-1` | `#0A0A0A` | queue rows, search field, mini-player |
| `--surface-2` | `#1A1A1A` | sheets, pressed rows, current queue row |
| `--divider` | `#262626` | hairlines, scrubber track |
| `--ink` | `#FFFFFF` | titles, all actions, active states |
| `--ink-secondary` | `#9A9A9A` | reciter name, meta, timestamps |
| `--ink-tertiary` | `#5C5C5C` | disabled text and controls |
| `--accent-cyan` | `#00FFFF` | **fidelity only** — transport source badges |
| `--error` | `#FF453A` | playback and connection errors |

Hard rules:

- Cyan is used for **one** concept: where the audio comes from (`P2P` / `HTTP`).
  It never fills a play button, marks an active tab, or indicates selection.
- **No drop shadows anywhere.** Elevation is a tonal step only.
- White is the action colour: play, active tab, focus ring, selected transport.
- No gradients. No colour extraction from artwork (there is none).
- Numerals are tabular (`font-variant-numeric: tabular-nums`) in every
  timestamp, size, and surah number.

### 2.2 Colour tokens (light variant)

A tonal inversion, not the old paper palette. Reached by `[data-theme='light']`
and `prefers-color-scheme: light` when the user has not chosen explicitly.

| Token | Value |
|---|---|
| `--canvas` | `#FFFFFF` |
| `--surface-1` | `#F7F7F7` |
| `--surface-2` | `#EFEFEF` |
| `--divider` | `#E0E0E0` |
| `--ink` | `#0A0A0A` |
| `--ink-secondary` | `#6E6E73` |
| `--ink-tertiary` | `#A1A1A6` |
| `--accent-cyan` | `#007A8A` (cyan is illegible on white; this is the only permitted substitution) |

### 2.3 Typography

TIDAL's geometric sans has no Arabic coverage. Two self-hosted faces, OFL
licensed, `woff2`, `font-display: swap`, `unicode-range` restricted to Arabic:

| Role | Face | Size / weight | Notes |
|---|---|---|---|
| Surah monument | **Amiri** | `clamp(2rem, 6vw, 4.5rem)` / 400 | `line-height: 1.55` — see deviation below |
| Screen title | IBM Plex Sans Arabic | 24–28px / 700 | tight `-0.02em` |
| Queue row name | IBM Plex Sans Arabic | 16px / 600 | |
| Body / reciter name | IBM Plex Sans Arabic | 15px / 400 | |
| Meta (size, count) | IBM Plex Sans Arabic | 12–13px / 400 | `--ink-secondary` |
| Technical badge | IBM Plex Sans Arabic | 10px / 700 | Latin text only, `+0.06em` tracking, uppercase |

**Deviations from the TIDAL reference, deliberate:**

1. **Leading.** TIDAL sets display type at 1.15. Arabic at that leading clips
   diacritics and descenders. Amiri gets **1.55**, IBM Plex Arabic titles 1.35.
   This is the single most important adaptation — copying the reference value
   produces broken Arabic.
2. **Tracking.** Negative tracking on display type applies to Latin only.
   Arabic headings stay at `0`. The "technical voice" that TIDAL gets from
   tracked-out uppercase is carried by the two Latin badges (`P2P`, `HTTP`).
3. **No thin weights.** 400 / 600 / 700 only, as in the reference.

### 2.4 Hero in place of album art

Recitation has no cover image, so the "art is the hero" move is re-pointed at
the **calligraphic surah name**: the name set large in Amiri, centred in the
void, with a small tabular surah number and the fidelity badge beside the
reciter name underneath. Zero assets, scales to any viewport, and reads like a
mushaf plate rather than a streaming app.

## 3. Structure and information architecture

### 3.1 Navigation as tabs, not a header

The sticky header and its four links disappear. Three destinations, rendered as
a fixed side nav on desktop and a bottom tab bar on mobile:

| Tab | Route | Content |
|---|---|---|
| المكتبة | `/` | reciter library: search + filter chips + rows |
| التشغيل | `/reciter/:id[/:surah]` | the desk |
| حول | `/about` | about, privacy, contact links, version |

### 3.2 Desktop shell (≥1024px)

```
┌──────────┬─────────────────┬─────────┐
│ brand    │   سورة البقرة   │ التالي   │
│ ⌘K بحث   │  (Amiri, huge)  │ ٣ آل…   │
│ القّراء   │  P2P ●          │ ٤ النساء │
│ ● reciter│  ──────●──────  │ ٥ المائدة│
│ ● reciter│  ١٢:٤٠  −٣١:٠٢  │   …     │
│ filter   │  ⏮  ▶  ⏭  ↺    │ السابق   │
│ ──────── │                 │ ١ الفاتحة│
│ ☾ حول    │                 │         │
└──────────┴─────────────────┴─────────┘
   280px         centre          360px
```

- Left rail 280px (72px icon rail for 1024–1279px): brand, search, reciter rows
  with fidelity/source badges, filter chips, theme + about at the bottom.
- Centre: the Now Playing surface. It is **fixed**, not scrolling — the player
  is always visible.
- Right: the queue, independently scrollable.

### 3.3 Mobile shell (<1024px)

- Bottom tab bar, 64px + `env(safe-area-inset-bottom)`, three tabs.
- **Mini-player** (56px) docked directly above the tab bar whenever something is
  loaded: surah name, current time, play/pause, 2px progress hairline. Tapping
  expands the Now Playing overlay; swipe down collapses it. Audio never stops.
- The queue is a bottom sheet inside the Now Playing overlay, opened by a handle
  labelled `قائمة التشغيل · ١١٤`.

### 3.4 Routes

| Route | Meaning |
|---|---|
| `/` | library |
| `/reciter/:id` | desk, nothing playing: reciter monument, queue, resume chip, "تشغيل الكل" |
| `/reciter/:id/:surah` | desk with that surah (1–114) playing — shareable |
| `/about`, `/privacy`, `/contact` | kept, reached from the About tab |

Invalid `:id` → library with an inline notice. Invalid `:surah` (non-numeric,
out of 1–114) → `/reciter/:id` with an inline notice. No separate 404 route for
these; the existing `not-found` route still catches unknown paths.

The current behaviour where `/` silently redirects to the last reciter is
removed. `/` always renders the library, with a **"متابعة الاستماع"** card at
the top when a saved position exists. A saved position is surfaced on
`/reciter/:id` as a resume chip showing the time.

### 3.5 Three states of the centre zone

The monument slot keeps a reserved min-height in all three, so nothing shifts:

1. **Connecting** — the surah name is rendered immediately (optimistic). Under
   it: a cyan pulse dot, `جارٍ الاتصال · peers 0 · ↓ ٠`, and the fidelity badge.
   At 8s, two buttons appear: `إعادة المحاولة` and `تشغيل من المصدر`. No
   full-panel spinner, no layout jump.
2. **Playing** — scrubber, transport, queue marker updates live.
3. **Error** — monument stays; message in `--error`; same two buttons.

Transitions between states crossfade (200ms). The status slot never resizes.

## 4. Queue

The queue is the fixed mushaf order of all 114 surahs, rendered in the right
zone (desktop) or the sheet (mobile).

**Row anatomy** (min-height 44px, RTL):

```
 ▌ ▮▮▮  ٢   البقرة                     ٤٨٫٢ م.ب
   ٢      آل عمران                     ٢٨٫١ م.ب
```

- Leading: an equaliser (3 bars, 3px wide, 2px gap, white) on the current row;
  it **freezes when paused**. Otherwise the surah number, tabular.
- Name: 16px/600 white; current row gets `--surface-2` fill.
- Trailing meta: file size from `torrentInfo.files[i].length`. When an Itqan
  HTTP playlist provides a duration, show the time instead. Never fabricate a
  duration — torrents expose bytes, not time.
- Two collapsible sections with eyebrows: **التالي** and **السابق**. The list
  auto-scrolls the current row into view when opened.
- Search field pinned above the list (`/` focuses it), filtering by name and
  number.
- Shuffle lives in the queue header and only permutes the **التالي** section;
  toggling it off restores mushaf order. Repeat-one lives in the transport.
- Keyboard: `↑`/`↓` move focus, `Enter` plays, `Esc` closes the sheet.

## 5. Player

**Monument block**

- Surah name, Amiri, centred, `clamp(2rem, 6vw, 4.5rem)`, leading 1.55.
- Under it: reciter name (`--ink-secondary`, 15px) and the fidelity badge.
- **Fidelity badge**: 1px cyan hairline, 4px radius, transparent fill, text
  `P2P` or `HTTP`, 10px/700, `+0.06em`, with an Arabic `title`/`aria-label`
  explaining the source (`ند للند` / `مصدر احتياطي`).

**Scrubber**

- Track 2px `--divider`; buffered range a tonal step lighter (`#3A3A3A`);
  played range white; knob 10px → 14px while dragging.
- Timestamps tabular at both ends, 11px/600.
- Click to seek, drag to scrub, `←`/`→` seek ±5s, `Space` play/pause.

**Transport**

```
   ⏮        ▶ (64px white circle, black glyph)        ⏭
   ↺ repeat-one            1× speed (overflow)         ⤓ save offline
```

- `⏮ ⏭` move by **surah** (`السورة السابقة` / `السابقة` semantics preserved),
  matching the queue, not by seconds.
- Overflow menu holds speed (0.75 / 1 / 1.25, default 1×) and "save offline"
  (today's download action, unchanged in behaviour). Speed is deliberately out
  of the main row: altering recitation tempo is a sensitive, opt-in choice.
- Repeat-one cycles off → one. There is no repeat-all; the queue is finite and
  already loops by wrapping at the end.

**Preserved behaviour (must not regress)**

- Media Session metadata and action handlers (lock screen / hardware keys).
- Document title update when the tab is hidden — but with the surah **name**
  (currently it prints the numeric id).
- Position restore on load, per reciter.
- P2P streaming through `file.streamURL` + `file.select()`, and HTTP fallback
  via `itqanPlaylist`.

## 6. Motion and accessibility

- **Crossfade only**, 160–200ms, `ease-out`. Sheets translate on `translateY`
  (240ms). Nothing springs, bounces, or animates layout properties.
- `prefers-reduced-motion: reduce` disables sheet transitions and freezes the
  equaliser bars.
- All targets ≥44×44. Focus ring: 2px white at 2px offset, never removed.
  On light theme the ring is `--ink` (`#0A0A0A`).
- Connecting state is announced via `aria-live="polite"`.
- Contrast check: `#9A9A9A` on `#000000` = 8.4:1; `#FFFFFF` on `#000000` =
  21:1; cyan `#00FFFF` on black = 16.7:1 (light-theme cyan `#007A8A` = 4.9:1,
  used for small badges only, on white).

## 7. State architecture

Current defect: all playback state is `useState` inside `AudioPlayer`, and the
torrent lives inside the `/reciter/:id` route, so leaving the route would tear
the session down. v2 fixes this structurally.

- **`<AudioEngine>`** — mounted **once in `App`, outside `<Routes>`**. Owns the
  single `<audio>` element, Media Session registration, and attachment of the
  torrent session for the selected reciter. Playback survives navigation, which
  the mini-player and the fixed desktop player both require.
- **Jotai atoms** in `src/jotai/player.ts`, matching the existing
  `selectedReciterAtom` pattern instead of introducing a second state system:
  `currentIndexAtom`, `isPlayingAtom`, `positionAtom`, `durationAtom`,
  `bufferedAtom`, `repeatAtom`, `shuffleAtom`, `rateAtom`, `connectionAtom`.
- **Ownership rule:** the URL owns *which surah*; atoms own *where in it*.
  `⏭`/`⏮` call `navigate()`; the route writes the atom once on mount/param
  change; no other writer touches the URL.
- The existing `torrent-session.ts` singleton remains the only place a torrent
  is added or destroyed, including its `force` retry and `closeTorrentSession()`.

## 8. Data

- `Surah` extends to `{ id, name, ayahCount, juz, revelation }`. 114 static
  rows in `src/constants/surah.ts`, verified against one known Hafs table
  before commit. `name` is unchanged, so nothing that reads it breaks.
- `formatBytes(n)` added to `src/utils` for queue meta.
- `TrackType` unchanged. Size is read from the torrent file object, not stored
  in the type.
- No API change. If a reciter has no magnet but an `itqanPlaylist`, the queue
  renders links with `—` in the meta column.

## 9. Persistence and migration

- New envelope: `open-tilawa:v2` in `localStorage`, `{ version: 2, ... }`.
- On first read, if the legacy keys exist (`reciterId`, `surahIndex`,
  `position`, or the current `use-persistence` shape), map them into v2 and
  delete the old keys. A corrupt or unparseable value falls back to defaults
  silently — never throws, never blocks first paint.
- Stored: last reciter id, last position per reciter (max 10 entries), repeat,
  shuffle, rate, theme choice.
- Restoring a position only happens when the URL's reciter and surah match the
  stored pair.

## 10. Rollout

Six phases, each independently shippable on `develop`:

| # | Phase | Shippable result |
|---|---|---|
| 1 | Tokens, self-hosted fonts, light map, web `DESIGN.md` appendix | New skin, same behaviour |
| 2 | Shell: side nav + tab bar, routes, delete header/footer/dialogs | New skeleton |
| 3 | `AudioEngine` extraction, URL state, persistence v2 | Playback survives navigation |
| 4 | Queue | Real playlist |
| 5 | Now Playing, mini-player, mobile sheet | The hero |
| 6 | Dead code removal, a11y pass, PWA precache fix | Clean |

Deletions (phase 2/6): `components/header.tsx` nav + language switcher,
`components/footer.tsx`, `components/footer-link.tsx`,
`components/activity-status.tsx`, `components/under-construction.tsx`,
`components/playlist-dialog.tsx`, `components/reciter-selector-dialog.tsx`,
`components/playlist.tsx`, `components/track-info.tsx` (folded into the
monument), and the unused `Tajawal` font shim.

## 11. Testing

The web app has **no test harness today** — no test script, no spec files.

- Add `"test": "node --experimental-strip-types --test \"src/**/*.test.ts\""` using
  Node's built-in runner (Node 22 resolves the glob itself; the quote keeps the
  shell out of it). **Zero new dependencies.**
- Cover pure logic only:
  - queue ordering, shuffle permutation, wrap-around next/previous
  - URL ↔ surah index mapping, including invalid input
  - `formatBytes`, `formatTime`
  - persistence v2 read/write and legacy migration, including corrupt input
- `yarn type-check` and `yarn lint` stay green in every phase.
- Audio, gestures, layout, and reduced-motion are verified by a written manual
  checklist per phase (documented in the plan), because DOM/audio tests here
  would cost more than they catch.

## 12. Risks and constraints

1. **PWA precache omits `woff2`.** `vite.config.ts` globs
   `{js,css,html,svg,png,ico,webmanifest}`. Self-hosted fonts would be missing
   offline. Add `woff2` to `injectManifest.globPatterns`.
2. **Merged service worker.** `src/sw.js` combines the PWA worker with
   WebTorrent's streaming worker. Any cache-config change must be re-verified
   against `file.streamURL` + range requests before shipping.
3. **Torrent teardown on navigation.** Moving the engine outside `<Routes>` is
   the fix; it must be verified by starting playback, navigating to `/about`,
   and confirming the session and byte counter do not reset.
4. **Pure black on LCD.** Acceptable, but the light variant must ship in phase 1
   so daylight reading is not a regression.
5. **Arabic display leading.** Documented in §2.3; a reviewer must check that
   no diacritic is clipped at the largest clamp size.
6. **Font licensing.** IBM Plex Sans Arabic and Amiri are SIL OFL 1.1 — safe to
   self-host and to redistribute inside the PWA bundle. Attribution goes in the
   About page.

## 13. Decisions log

| Decision | Choice | Why |
|---|---|---|
| Overall direction | Night Listening Room (TIDAL + YouTube Music) | Player-first, strongest identity; chosen over Quiet Desk and Fihris |
| Hero instead of artwork | Calligraphic surah name in Amiri | No assets, no licensing, reads as a mushaf plate |
| Light theme | Kept as a tonal inversion, dark default | Daytime usability without stranding existing users |
| Navigation | Tabs (side nav / bottom bar) | Header links were mostly dead ends |
| Queue order | Fixed mushaf order, shuffle only permutes "next" | The order is the product; drag-reorder is YAGNI |
| Transport skips | By surah, not by seconds | Matches the queue's unit |
| Speed control | Shipped, in overflow, default 1× | Useful for memorisation, sensitive enough to stay opt-in |
| Language switcher | Deleted | It only flipped local state; there is no i18n |
| Duration in queue | Size (or real duration when known), never estimated | Honesty: torrents expose bytes, not time |

## 14. Implementation notes (what actually shipped)

Small deviations, all deliberate:

1. **Light is explicit only.** `prefers-color-scheme` is ignored: dark is the
   identity, so a light OS does not override it. Light comes from the sidebar
   toggle and is stored in `open-tilawa:v2`.
2. **The mobile Now Playing screen is the route**, not an overlay:
   `/reciter/:id/:surah` *is* the full player, and the browser back button is
   the collapse gesture. The queue is the bottom sheet. This is one fewer piece
   of state and makes "share what you are hearing" work for free.
3. **Surah metadata** ships `ayahCount`, `juz` and `page` (verified against the
   Quran search engine catalogue on 2026-10-26). `revelation` was dropped rather
   than guessed.
4. **`--ink-tertiary` is `#7a7a7a`** (4.9:1 on black; `#767676` on white) rather
   than the reference's `#5C5C5C`, which fails AA at 11px.
5. **The PWA update prompt was removed.** It was wired to a `window.wb` shim
   that nothing ever populated, so it could never fire. `registerType:
   'autoUpdate'` + `skipWaiting`/`clientsClaim` still delivers updates on the
   next load.
6. **Progress writes** happen every 5 seconds while playing, on seek, and on
   `pagehide`. Before a surah switch the outgoing position is parked under the
   *outgoing* surah id — writing it under the new one would resume the next
   surah at the previous surah's timestamp.
