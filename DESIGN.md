# DESIGN.md — Open Tilawa v2

## Overview

Open Tilawa is a Quran recitation player. The interface is a reading surface,
not a console: warm paper, single blue accent, hairline separators, and
restrained motion. The register is "quiet desk" — closer to a printed mushaf
than to a streaming app.

Base system: **Uslub** (paper/hairlines, single accent, premium shadows).
Borrowed from **Open Tarteel**: fixed 52px status slot, spectrum bars, RTL
logical properties.

## Colors

### Light theme (default)
| Token | Value | Role |
|---|---|---|
| `--canvas` | #ffffff | panels, fields, modals, landing bar |
| `--canvas-parchment` | #f5f5f7 | page shell, hover wash, footer |
| `--surface-pearl` | #fafafc | secondary button fill, code background |
| `--canvas-cream` | #ffefc4 | key reveal, notice, warning wash |
| `--ink` | #1d1d1f | primary text on every light surface |
| `--ink-secondary` | #6e6e73 | captions, hints, inactive nav, meta |
| `--primary` | #086288 | fills, links, active nav, focus ring |
| `--primary-hover` | #065273 | hover state of a primary fill |
| `--support` | #4d8dba | graphics and 18px semibold only |
| `--hairline` | #e0e0e0 | every divider and control border |
| `--error` | #d70015 | error text and destructive actions |
| `--success` | #0f7b3f | success states |

### Dark theme
| Token | Value | Role |
|---|---|---|
| `--canvas` | #000000 | page background |
| `--canvas-parchment` | #1c1c1e | page shell, hover wash |
| `--surface-pearl` | #272729 | secondary surfaces |
| `--ink` | #f5f5f7 | primary text |
| `--ink-secondary` | #8e8e93 | secondary text |
| `--primary` | #97d7ff | fills, links, active nav (9.57:1 on #272729) |
| `--primary-hover` | #b8e2ff | hover state |
| `--hairline` | #2c2c2e | dividers |

### Rules
- One interactive accent. `--primary` is the only colour that signals "click me".
  Support colours are graphics and tints only.
- A tint is always a wash behind a word, never the word itself.
- Never hard-code `#fff` or `#000` where `--canvas` and `--ink` exist.
- `--support` (3.60:1) is never used for body text on a light surface.

## Typography

- **Arabic headings:** letter-spacing 0, taller Arabic leading (1.6–1.8)
- **Latin body:** system font stack, 14–16px, weight 400–500
- **Captions/meta:** `--ink-secondary`, 12–13px
- **No negative tracking on Arabic.** Latin headings may use -0.01em.

## Spacing & Radii

- **Radii:** 8px (`--radius-sm`), 18px (`--radius-lg`), pill. Nothing between.
- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64px.
- **Prose cap:** 68ch max width. Tables keep full column width.

## Components

### Header / Nav (Cal.com style)
- Height: 64px. Sticky on scroll with subtle shadow increase.
- Bottom border: 1px `--hairline`. No glass/backdrop-filter — solid surfaces only.
- Logo: circle dot (8px, `--primary`) + text. No illustrated logos in app UI.
- Links: 14px, weight 500, `--ink-secondary`. Hover: `--ink` + `--canvas-parchment` bg, 6px radius.
- Language switch: globe icon trigger + dropdown (EN/AR). RTL-safe (`inset-inline-end: 0`).
- Theme switch: icon trigger + dropdown (Light/Dark/System). Default: system.
- Mobile (≤1024px): "Menu"/"✕" text toggle opens full-width dropdown with ALL items.
- Close menu on navigation (`setMenuOpen(false)` in every onClick).

### Reciter cards
- `rounded-2xl` (18px), premium 4-layer shadow, hover lift 1–2px.
- Press: `scale(0.97)` over `--motion-press` (160ms).
- Single accent: `--primary` for active state, `--tint-selected` (24% accent) for selected row.

### Player panel
- `rounded-md` (8px), fixed `min-h-[52px]` status slot (no resize during downloads).
- Spectrum bars: `#0191e2` (or `--primary` in dark mode).
- Controls: play/pause, seek, volume — all icon buttons with `aria-label`.

### Buttons & icons
- Primary: `--primary` fill, white text, `rounded-md`, hover `--primary-hover`. One per
  region: the page's main verb. Anything inside a card, row or table is secondary.
- Secondary: `--surface-pearl` fill, `--ink` text, `--hairline` border.
- `tertiary` is a word, not a button: edits and other quiet verbs. `destructive` is for
  irreversible verbs only — never for "close".
- `small` inside cards and table rows; full size in `page-head`, modals and the first
  screen of a flow.
- Icons come from `components/icons.tsx` (Phosphor, 16px, `regular`) and reach a button
  through `icon=`, which swaps to the spinner while busy so the label never moves.
- Icon + label on page-level verbs; label alone inside a card. Icon-only requires
  `aria-label`, and the glyph is never the accessible name.
- The name → glyph map is the only place a glyph is chosen, so a glyph is replaced once
  for the whole app. Never import Phosphor at a call site.

### Node cards (seeders, TURN, relay)
- The unit for a machine you own: `.node-card` on `--canvas`, 18px radius,
  `--shadow-premium`, 24px padding (16px ≤560px). No border — depth is the shadow.
- Grid: `.node-grid` = `repeat(auto-fill, minmax(340px, 1fr))`, 16px gap, one column
  ≤560px. Never a table for a fleet: a row that re-flows into a card on mobile is two
  designs to keep in step.
- Header: name (16px `--body-strong`, wraps, never truncated) + status chip, then the URL
  on `--code` 12px, `direction: ltr; unicode-bidi: isolate`, ellipsised with `title`.
  A badge (pinned, WebSocket) sits beside the status chip.
- Pinned ("this server") is `--canvas-parchment` plus a badge. Never a coloured bar: the
  `inset 3px 0` marker drew itself on the left in an RTL page.
- Metrics: a 2×2 `dl`, label `--fine-print` `--ink-secondary`, value 14px `tabular-nums`.
  Four metrics maximum; anything else belongs on the node's own screen.
- Capacity is the only meter: used over quota, 4px track `--hairline`, fill `--primary`,
  `--support` from 90%. Unlimited quota shows the used value and the words for "no cap" —
  never the size of the disk dressed up as a quota.
- Actions: a footer above a `--hairline`, `small` buttons, quiet verbs last. The name is
  the only link; the card is not one giant click target, because nested buttons then lie
  to the keyboard and to assistive tech.

### Time strips (24h)
- Bars are equal height; colour is the verdict (`--success`, `--warning`, `--error`,
  `--hairline` for no data). Height carries no value, so a taller "now" bar lies about
  nothing.
- The current hour is the tallest bar: 26px against an 18px strip, standing on the
  same baseline so it rises above the row instead of floating in the middle. Only the
  oldest end is captioned («قبل 24 ساعة», inline-start); the raised bar is the other
  end. The label, not the direction, is what makes the reading order unambiguous — RTL
  flips the newest bucket to the left edge.

### Dividers
- `--hairline` (#e0e0e0) wherever content is separated.
- `--divider-soft` (4% black) for inset rings.

## Motion

- **Hover transitions:** 160ms or less. No `transition: all`.
- **Press:** `scale(0.97)` over `--motion-press`.
- **Entrance:** ≤500ms. No layout property animation (width/height).
- **No:** springs, parallax, scroll-triggered animation, loops beyond spinner/skeleton.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables all transforms.

## Premium depth (4-layer shadow)

```
--shadow-premium:
  inset 0 1px 0 0 rgba(255,255,255,0.12),   /* top inner highlight */
  inset 0 -1px 0 0 rgba(0,0,0,0.06),        /* bottom inner depth */
  0 1px 2px 0 rgba(0,0,0,0.06),             /* near contact shadow */
  0 4px 12px -2px rgba(0,0,0,0.12);         /* far diffuse elevation */
```

- Layer order: inset highlights first, then contact, then far elevation.
- Inner highlight is the key — without it, even 4 shadows look flat.
- Press: intensify inset shadows, reduce far shadow.
- Hover: grow far shadow + translate Y 1–2px. Animate at 150ms ease-out.
- Dark mode: lighter inner highlight (0.06 vs 0.12), heavier outer (0.24/0.32 vs 0.06/0.12).
- Limit to interactive surfaces (buttons, cards, modals) — not every div.

## RTL / Arabic

- Use logical properties: `inset-inline-start`, `border-inline-end`, `padding-inline`.
- A physical side is a bug in an RTL page: `left`, `right` and `inset 3px 0` draw the
  marker on the wrong edge. Pinned bars, accents and dividers are `inline-start`/`end`.
- Code blocks, URLs and identifiers stay LTR even in an RTL page (`.code-line` sets
  `direction: ltr`), otherwise a scrolling block opens on the tail of the command.
- Arabic heading: `letter-spacing: 0`, taller leading (1.6–1.8).
- No negative tracking on Arabic.
- `html[lang='ar']` overrides `--font-sans` with `--font-arabic`.

## Accessibility

- Every icon-only button has `aria-label`.
- Focus ring: 2px `--primary` at 2px offset.
- Contrast: all text ≥4.5:1 (AA). `--support` (3.60:1) is graphics/large semibold only.
- `prefers-reduced-motion`: disable transforms.
- `prefers-reduced-transparency`: solid backgrounds (no blur).

## Do's

- Take every colour from a token; the accent is `--primary` and there is exactly one.
- Put content on `--canvas`, page shell on `--canvas-parchment`.
- Reach for `--canvas-cream` only for the key reveal, notices and warning wash.
- Separate surfaces with `--hairline` or `--shadow-premium`, in that order.
- Use `--radius-sm` (8px), `--radius-lg` (18px) or pill — nothing between.
- Write direction-agnostic CSS with logical properties.
- Pair Arabic heading sizes with `letter-spacing: 0` and taller Arabic leading.
- Cap prose at 68ch; let tables keep full column width.

## Don'ts

- Don't introduce a second accent, gradient, or coloured surface beyond cream/tints/status washes.
- Don't put `--support` on body text.
- Don't use `transition: all`, hover >200ms, spring physics, parallax, or loops beyond spinner/skeleton.
- Don't animate transforms when `prefers-reduced-motion: reduce` is set.
- Don't invent radii outside 8px, 18px, pill. Don't invent shadows outside the token set.
- Don't centre-align long Arabic or Latin prose. Don't apply Latin negative tracking to Arabic.
- Don't hard-code `#fff`/`#000` where `--canvas` and `--ink` exist.
- Don't use glass/backdrop-filter. Solid surfaces only.

## Known gaps

- No dark-mode-specific spectrum bar colour (uses `--primary` in both themes).
- Mobile dropdown animation not yet implemented (instant show/hide).
- Font loading: system fonts only; self-hosted Arabic font (e.g. Noto Naskh Arabic) not yet wired.

## Version

DESIGN.md v2 — 2026-10-25. Base: Uslub. Borrowed: Open Tarteel (status slot, spectrum bars, RTL).