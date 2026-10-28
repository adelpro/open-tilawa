# Tilawa web — the page is the player

Date: 2026-10-26
Branch: `feat/web-minimal-player` (off `feat/web-v2-night-room`)
Supersedes: the v2 "night listening room" shell

## 1. Why this exists

The v2 redesign shipped decoration instead of a player: an equaliser, a cyan
P2P/HTTP fidelity badge, peer and throughput telemetry, per-row file sizes, a
calligraphic Amiri hero, three tabs, a desktop rail, a queue column, a mobile
sheet, a resume card, and a speed menu tucked into an overflow. For a site whose
entire job is "play the surah I chose", every one of those is a cost with no
payback.

This spec replaces that shell with one screen. Reference: **Apple Music's
full-screen Now Playing** — the viewport is the player, and the list of things
you can play is a sheet you pull up when you want it.

## 2. Goal

Open the site, see what you were listening to, press play.

Success: one route, no navigation model, no decorative telemetry, white canvas,
and the surah name readable from a metre away.

Non-goals: artwork, social features, downloads UI, filters, search, dark mode,
shuffle, repeat, speed, offline management.

## 3. Frame

- Single route: `/`. No router-level state, no `/reciter/:id/:surah`.
- One centred column, `max-width: 520px`, on white. Vertically centred when the
  viewport is tall enough; below ~620px it top-aligns with 48px padding and the
  page scrolls.
- Desktop and phone render the same column. There is no second layout.
- Both sheets are bottom sheets on every viewport (they are modal, not columns).

```
                 سعد الغامدي            ← text button → reciter sheet

                    الكهف               ← 44px / 600
                  سورة ١٨ من ١١٤          ← 13px, --muted

      0:42 ────────────●──────────── 23:12

                 ◀   −15   ●   +15   ▶

                    السور               ← text button → surah sheet
```

## 4. Controls

| Element | Behaviour |
|---|---|
| `◀` / `▶` | Previous / next **surah**. Clamped at 1 and 114, no wrap. |
| `−15` / `+15` | Seek within the surah by 15 seconds, clamped to `[0, duration]`. |
| `●` | Play / pause. 72px black circle, white glyph. Disabled until the file is ready. |
| Scrubber | 3px `--line` track, `--ink` fill, 44px touch target, no buffered layer, no visible thumb at rest. |
| Reciter name | Opens the reciter sheet. |
| `السور` | Opens the surah sheet. |

Anything else (repeat, shuffle, speed, download) is out of scope. If one comes
back it gets its own decision.

## 5. Cold start

- First paint shows the last reciter and last surah, **paused**, at the saved
  position. Restoration uses the same rule as today: only seek if the stored
  position is for the same surah and is `> 3s`.
- First visit ever: first reciter in the catalogue, الفاتحة, `0:00`, paused.
- Nothing starts by itself on load or reload. The only thing that starts audio
  is a tap: the play button, or a row picked in the surah sheet.

## 6. Sheets

Both use the same component: white panel, hairline top border, `90dvh`,
`border-radius: 16px 16px 0 0`, a 52px drag/close area, scrollable body.
Escape, backdrop tap, and drag-down all close. Focus is trapped while open and
returns to the trigger on close.

- **السور** — 114 rows, 56px tall: number (`--muted`, tabular, 3 digits), name
  (`--ink`). The playing row is `font-weight: 600`. Picking a row closes the
  sheet and starts that surah. No search, no sections, no sizes, no equaliser.
- **القرّاء** — one 56px row per reciter, current one bold. Picking one closes
  the sheet, loads that torrent, and lands on الفاتحة, paused.

The surah sheet opens scrolled to the current surah.

## 7. State

- `open-tilawa:v2` (localStorage) stays the store: `reciterId`, `positions`,
  `theme` (ignored), `repeat`/`rate`/`shuffle` (ignored, kept for compatibility).
  No migration work; existing users keep their positions.
- In-memory: `reciter`, `index`, `isPlaying`, `position`, `duration`, sheet
  (`'surahs' | 'reciters' | null`).
- URL stays `/`. Nothing is encoded in it. The tab title reads
  `«سورة» — Open Tilawa`, and Media Session metadata/keys stay wired so a locked
  phone shows the surah and its transport.

## 8. Tokens and type

Five values, no theme system:

```
--bg:     #ffffff
--ink:    #111111
--muted:  #6b6b6b
--line:   #e8e8e8
--invert: #ffffff   (glyph inside the black play button)
```

- **One typeface**: IBM Plex Sans Arabic, already self-hosted (`public/fonts`),
  weights 400 / 600. Amiri and its faces are deleted.
- Sizes: surah 44px/1.2, reciter label 15px, metadata 13px, timestamps 12px
  (tabular), list rows 16px.
- No shadows, no cards, no gradient, no accent colour. Playback state is
  expressed by weight and the play glyph only.

### 8.1 Amendment — the spectrum is blue (2026-10-28)

The one exception, added after the spectrum was drawn as a single ink line: four
waves at one colour could only be told apart by opacity, and the two back layers
(`0.32`, `0.2`) were near-invisible. The waves are now filled silhouettes, each
in its own tint, and two values joined the palette:

```
--wave-front: #1c4d78   (deepest; #a6c9ec at night)
--wave-back:  #5d97c9   (palest;  #3d6b96 at night)
```

The two tints between them are mixed in code (`waveTints`), so the ramp is four
steps of one hue and never drifts toward the cyan the v2 shell was retired for.
Everything else stands: no shadows, no cards, no second surface, no colour
anywhere in the UI outside the canvas. Bars and peaks use `--wave-front` flat.

## 9. Files

Survive: `audio-engine.tsx` (minus queue/mini-player coupling), `hooks/use-torrent.ts`,
`utils/torrent-session.ts`, `hooks/use-persistence.ts`, `utils/format-time.ts`,
`constants/surah.ts`, `constants/reciters.ts`, the webtorrent client + service
worker.

Deleted: `components/nav.tsx`, `mini-player.tsx`, `queue.tsx`, `queue-sheet.tsx`,
`now-playing.tsx`, `player-bits.tsx`, `icons.tsx` (replaced by ~6 inline paths),
`app/page.tsx` (library), `app/reciter/**`, `hooks/use-player-nav.ts`,
`hooks/use-theme.ts`, `jotai/ui.ts`, `utils/queue.ts` + `test/queue.test.ts`,
`utils/format-bytes.ts`, `utils/reciter-meta.ts`, the Amiri `@font-face` block
and its woff2 files, and the react-router dependency.

The `about`, `contact` and `privacy` pages go too: with no navigation there is no
way to reach them, and the contact form already posts to `api/send-feedback`, an
endpoint that does not exist in the static build. Their one durable obligation —
font licensing — moves to `public/fonts/OFL.txt`.

Added: `app/player-page.tsx` (the column), `components/sheets.tsx` (both
sheets), `components/transport.tsx`, `components/scrubber.tsx` (trimmed),
`public/fonts/OFL.txt` (IBM Plex Sans Arabic licence, as OFL requires when the
files are redistributed).

## 10. Accessibility

- Every control has an Arabic `aria-label`; the play button states the action it
  will perform ("تشغيل" / "إيقاف مؤقت").
- Visible focus ring: 2px `--ink` at 2px offset, keyboard-only.
- Touch targets ≥ 44px; the scrubber's input is invisible but 44px tall.
- `prefers-reduced-motion` removes the sheet transition.
- Contrast: `--ink` on `--bg` 18.9:1, `--muted` on `--bg` 5.4:1.

## 11. Verification

- `npx tsc --noEmit`, `npm run build`.
- `npm test` — keep `migrateLegacy` coverage, add `formatTime` cases; delete the
  queue tests.
- Playwright, desktop 1440×900 and phone 390×844: cold start renders the saved
  surah paused; play advances `currentTime`; `+15` seeks 15s; next/prev change
  surah and clamp at the ends; both sheets open, list the right counts (114/20),
  close on Escape and backdrop; no horizontal overflow; no console errors except
  the known catalogue CORS failure on `localhost`.
- Deploy check on `https://tilawa.quran.us.kg` with one real P2P play.

## 12. Rollback

The container is built from the working tree. Rollback = check out
`feat/web-v2-night-room` (or `develop` for v1), then
`docker compose build web && docker compose up -d web` in `~/code/open-tilawa`.
