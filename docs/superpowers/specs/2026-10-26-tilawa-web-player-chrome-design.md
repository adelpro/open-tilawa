# Tilawa web — player chrome: identity, lists and settings

Date: 2026-10-26
Supersedes the deletion list in
`2026-10-26-tilawa-web-minimal-player-design.md` where they disagree. The
player core from that spec (one column, five controls, RTL scrubber, native
`<dialog>` sheets, no router, no autoplay) stands.

## Why

The minimal screen shipped and read as anonymous: no brand, no way to see the
list without hunting, no speed control, no way to tell whether the sound is
coming from peers, and settings hidden behind nothing at all. The fix is not
density — it is *edges*. The v2 shell failed because three columns competed;
it did not fail because it had a menu, a logo or a status readout.

Success: the page has an identity and every control is discoverable, while the
player column still contains exactly the same rows as today.

## Shape: three edges

Persistent chrome is capped at **three** things:

1. a 56px top bar,
2. the untouched player column,
3. a 56px bottom bar.

Everything else is a transient layer (sheet or popover). If a fourth
persistent element is proposed, this design has failed and must be revisited.

## 1. Top bar

56px, hairline `--line` beneath, safe-area aware.

- Start (right in RTL): wordmark `تلاوة` in Amiri 600, 18px, `--ink`. It is
  text, not the PNG: the logo files are 1024px rasters with a navy tint and a
  drop shadow, which at 24px turn to mush and add a sixth colour to a
  five-value palette. The real PNG appears at 96px inside the About sheet, and
  the favicon/PWA icon is unchanged.
- End: one `⋯` button, 44×44, `--muted` → `--ink` on hover/press, opens the
  menu sheet.
- Nothing else. Theme and language live in the menu (user decision,
  2026-10-26), because three 44px targets beside a wordmark crowd the right
  edge of a 390px screen.

## 2. Player column

Unchanged from the minimal-player spec except:

- **Reciter becomes a chip**: pill, 1px `--line` border, 15px `--ink`, 8×14
  padding, 44px minimum height. Hover darkens the border to `--ink` at 40%;
  press fills with `--line`. Affordance without a toolbar.
- **Surah name returns to Amiri** 400 at 48px desktop / 42px phone, line-height
  1.35 (Amiri needs the leading), `--ink`. This is the page's identity along
  with the wordmark.
- Meta line, scrubber, transport: identical. No new rows.

## 3. Bottom bar

56px plus `env(safe-area-inset-bottom)`, hairline `--line` above.

- Start (right): `[playlist icon] {current surah name} [chevron-up]` — one
  button, 44px tall, spanning the start half. Tapping opens the surah sheet.
  The playlist icon replaces the word `السور`; the chevron is the "list
  continues upward" affordance the user missed from v2.
- End (left): `{rate}×` text button (tabular figures) and the signal button.
  Both 44×44.
- The transport row therefore keeps exactly five controls; speed and status do
  not move into it.

### Rate

`0.75 → 1 → 1.25 → 1.5 → 2 → 0.75`. Tapping the button advances one step and
the label changes immediately (`1×`, `1.5×`). Applies as
`audio.playbackRate`. Persisted. Reset to 1 when a new surah starts? No —
speed is a listener preference like theme, not a per-surah property.

### Signal states

One wifi glyph, three honest states:

| state | when | rendering |
|---|---|---|
| `connected` | torrent with `peers > 0` | glyph in `--ink` |
| `waiting` | torrent, `peers === 0` | glyph in `--muted` |
| `http` | reciter has no magnet (Itqan links) | glyph in `--muted`, 1px `--line` ring |

Clicking it opens the stream-details popover. State is exposed in
`aria-label`, so the button is not a mystery.

## 4. Stream details popover

The content is the v1 popup, not a new invention:

| row | value |
|---|---|
| المصدر | `P2P` or `HTTP` |
| الأقران | `peers` |
| التنزيل | `formatSpeed(downloadSpeed)` |
| الرفع | `formatSpeed(uploadSpeed)` |
| المُنزَّل | `formatBytes(downloaded)` |
| التقدّم | `(progress * 100).toFixed(1)%` |
| الملفات | `files.length` |

- Anchored above the signal button, right-aligned in RTL, `min(320px, 100vw -
  24px)` wide, `bg-canvas`, 1px `--line`, radius 12px, no shadow.
- For an HTTP-only reciter the torrent rows are replaced by one line: no peers
  needed, plays from the reciter host.
- Read-only, so it takes no focus trap: `role="dialog" aria-modal="false"`,
  Escape returns focus to the signal button, click-outside closes.
- Values come from `torrentAtom`, which already re-emits on every download and
  wire event; no new polling.
- Restores `utils/format-bytes.ts` (`formatBytes` + `formatSpeed`), deleted in
  the minimal-player pass.

## 5. Sheets

One component, one `useSheet` with kinds
`'surahs' | 'reciters' | 'menu' | 'about' | 'privacy' | null`. Opening a sheet
from the menu closes the menu first (sequential, never stacked).

- **Menu**: appearance row (`فاتح` / `داكن` segmented, immediate), language row
  (`العربية` selected, `English` present but disabled and marked "قريباً"),
  `عن تلاوة`, `الخصوصية`, then a 11px `--muted` version + short sha line.
- **About**: logo 96px, two sentences on what the app is, source link, licence
  line (code + fonts OFL), version.
- **Privacy**: five short honest lines — no account, no analytics, positions and
  preferences stay in local storage, the only outbound calls are the reciter
  catalogue and the torrent swarm.
### Surah rows

Rows grow from one line to two, 64px, no dividers:

- start: the number, 12px `--muted`, tabular, 32px wide;
- name, 16px `--ink`; the playing row is 600 weight with a 4px ink dot before
  the name instead of a background;
- second line, 11.5px `--muted`: `{ayahCount} آية · الجزء {juz}`;
- end: the file size when the torrent's metadata is loaded (`formatBytes`),
  otherwise nothing — never a placeholder dash.

That is enough to tell surahs apart and judge a download, and it keeps the
sheet scannable at 114 rows.

### Reciter rows

Same 64px anatomy, and the tags are the ones the data can actually support:

- name, 16px; the current reciter is 600 weight with the ink dot;
- second line, 11.5px `--muted`: `{source host} · {كامل | جزئي}` where the host
  comes from `MagnetlinkSource` and completeness from `reciter.complet`;
- end: one small bordered label, `P2P` when the reciter has a magnet, `HTTP`
  when it plays from Itqan links only. That single label is the thing a
  listener actually needs to know, so it is the only one that gets a box.

- **Contact** is a `mailto:` link inside About. The old form posted to an
  endpoint that does not exist and stays deleted.

## 6. Theme

- `[data-theme='dark']` on `<html>`, palette borrowed verbatim from v2 so the
  "night listening room" look is available without being the default:
  `--bg #000000`, `--ink #ffffff`, `--muted #9a9a9a`, `--line #262626`,
  `--invert #000000`, `color-scheme: dark`.
- Light stays the identity and the default. `prefers-color-scheme: dark`
  decides the **first** visit only; any explicit choice wins forever after.
- Stored as `theme` in `open-tilawa:v2` (optional field, no version bump, no
  migration; `loadState` stops stripping it).
- Applied before paint by a tiny inline read in `main.tsx` (no flash of light
  on a dark device).

## 7. Language

Phase 1 (this spec) ships the row and the Arabic UI only. Phase 2 (separate
spec) adds a copy table, English surah and reciter names, `dir` flipping and
the real toggle. Writing a half-translation now would be worse than a disabled
row that says so.

## 8. Files

New: `components/top-bar.tsx`, `components/bottom-bar.tsx`,
`components/details-popover.tsx`, `components/menu-sheet.tsx` (menu + about +
privacy bodies), `components/icons.tsx` (hand-drawn: playlist, wifi, chevron
up/left/right, dots, close, play, pause), `hooks/use-theme.ts`,
`utils/format-bytes.ts`, `utils/rate.ts`.

Changed: `App.tsx` (shell column), `app/player-page.tsx` (chip, Amiri, bars),
`hooks/use-player-nav.ts` (rate), `jotai/player.ts` (`rateAtom`),
`hooks/use-persistence.ts` (`theme`, `rate`), `components/audio-engine.tsx`
(`playbackRate`), `app/globals.css` (dark block, shell), `tailwind.config.ts`
(Amiri display family), `app/fonts.css` (Amiri faces restored),
`README.md`.

Restored from git: three Amiri woff2 files.

## 9. Testing

- `node:test`: `nextRate` wraps through the list; `formatBytes`/`formatSpeed`
  cover 0, sub-KB, MB and non-finite; stored state accepts and keeps
  `theme`/`rate` and still rejects `version: 1`.
- Playwright, 1440×900 and 390×844 (plus 390×600 for the tight case):
  - wordmark and `⋯` present, menu opens, About and Privacy open from it;
  - dark mode applies, persists across reload, and the text stays legible;
  - bottom bar shows the current surah, opens the list, and the current row is
    scrolled into view;
  - rate cycles `1× → 1.25× → 1.5×`, `audio.playbackRate` follows and survives
    a reload;
  - signal button opens the popover with source and peer rows; Escape closes it
    and returns focus;
  - no horizontal overflow, and the player still fits 390×600 with both bars;
  - the reciter chip is a 44px target and opens the reciter sheet.

## 10. Out of scope

English UI (phase 2), a visible queue column, a library/home screen, search,
downloads, bass/equaliser, a second accent colour, drag-to-expand gestures.
