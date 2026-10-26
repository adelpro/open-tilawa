# Implementation plan — player chrome (top bar, bottom bar, sheets)

Spec: `docs/superpowers/specs/2026-10-26-tilawa-web-player-chrome-design.md`
Branch: `feat/web-player-chrome` (off `feat/web-minimal-player`)

Invariant for every task: the player column keeps exactly the rows it has
today, and no fourth persistent element appears.

---

## Task 1 — Theme: tokens, storage, application

1. `src/app/globals.css`: keep `:root` as light; add

```css
[data-theme='dark'] {
  --bg: #000000;
  --ink: #ffffff;
  --muted: #9a9a9a;
  --line: #262626;
  --invert: #000000;
  color-scheme: dark;
}
```

2. `src/hooks/use-persistence.ts`: add `theme?: 'light' | 'dark'` and
   `rate?: number` to `StoredState`; keep them in `loadState()`'s field pick;
   `isStoredState` still keys on `version === 2`.
3. `src/hooks/use-theme.ts`:

```ts
export type Theme = 'light' | 'dark';
export function resolveInitialTheme(): Theme;      // stored → prefers-color-scheme → 'light'
export function applyTheme(theme: Theme): void;    // sets data-theme on <html>
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void };
```

4. `src/main.tsx`: call `applyTheme(resolveInitialTheme())` before `render`.
5. `test/theme.test.ts`: `resolveInitialTheme` prefers stored over the media
   query, and the media query over the default. Needs a `window`/`matchMedia`
   stub — write the smallest one that makes the function testable (no jsdom).

Verify: `npm test`, `npx tsc --noEmit`; toggling `data-theme` in devtools flips
the page without touching anything else.

## Task 2 — Rate: one pure function, one atom, one effect

1. `src/utils/rate.ts`:

```ts
export const RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export function nextRate(current: number): number; // wraps, unknown → 1
export function formatRate(rate: number): string;  // "1x" | "1.5x"
```

2. `test/rate.test.ts` first (red), including unknown input and wrap-around.
3. `src/jotai/player.ts`: `rateAtom` seeded from stored rate.
4. `src/components/audio-engine.tsx`: effect `audio.playbackRate = rate` on
   `[rate, surahId]`; persist via `patchState({ rate })` from the page, not the
   engine.
5. `src/hooks/use-player-nav.ts`: expose `rate`, `cycleRate()`.

Verify: tests green; in the browser `document.querySelector('audio').playbackRate`
follows the label.

## Task 3 — Amiri back, one icon module

1. Restore `J7aRnpd8CGxBHpUrtLMA7w.woff2`, `J7aRnpd8CGxBHpUgtLMA7w.woff2`,
   `J7aRnpd8CGxBHpUutLM.woff2` from `feat/web-v2-night-room` and the three
   Arabic/Latin `@font-face` blocks to `src/app/fonts.css`.
2. `tailwind.config.ts`: `fontFamily.display = ['Amiri', '"IBM Plex Sans Arabic"', 'serif']`.
3. `src/components/icons.tsx`: `Icon` with `name: 'playlist' | 'wifi' |
   'chevron-up' | 'chevron-left' | 'chevron-right' | 'dots' | 'close' | 'play'
   | 'pause'`, one 24px path each, `currentColor`, `aria-hidden`.
4. `transport.tsx` and `sheet.tsx` stop carrying their own SVGs.

Verify: `tsc`; Playwright `document.fonts.check('48px Amiri')` is true.

## Task 4 — Shell and top bar

1. `src/app/globals.css`: `.app-shell { display:flex; flex-direction:column;
   min-height:100dvh }`; `.player-screen` becomes `flex:1` with `24px` block
   padding (currently `min-height:100dvh` + 48px).
2. `src/components/top-bar.tsx`: 56px, `padding-inline: 16px`, wordmark
   `<span className="font-display text-[18px] font-semibold">تلاوة</span>` at the
   start, `Icon dots` button (44×44, `aria-label="القائمة"`) at the end.
3. `App.tsx`: `<div className="app-shell"><TopBar onMenu={…} /><PlayerPage … />
   <BottomBar … /></div>`; `AudioEngine` stays outside the shell.
4. Menu state lifts to `App`? No — keep `useSheet` in `PlayerPage` and pass
   `openMenu` down; `AudioEngine` still mounts beside the shell.

Verify: bars render at both widths, page still centres, no overflow.

## Task 5 — Bottom bar

1. `src/components/bottom-bar.tsx`:

```tsx
type Props = {
  surahName: string;
  rate: number;
  source: 'connected' | 'waiting' | 'http';
  onOpenList: () => void;
  onCycleRate: () => void;
  onOpenDetails: () => void;
  detailsOpen: boolean;
};
```

2. Start half: one button (`aria-label="قائمة السور"`) with `Icon playlist`,
   the surah name (truncate), `Icon chevron-up`. 44px tall.
3. End half: `formatRate(rate)` button (`aria-label="سرعة التشغيل"`), signal
   button (`aria-label` from `source`, `aria-expanded={detailsOpen}`).
4. `PlayerPage` derives `source` from `torrentAtom`: no magnet → `http`;
   `peers > 0` → `connected`; else `waiting`.

Verify: bar opens the surah sheet; rate label cycles; signal button toggles the
popover state (popover lands in Task 6).

## Task 6 — Stream details popover

1. `src/utils/format-bytes.ts` (restored, the de-duplicated version):

```ts
export function formatBytes(bytes: number | null | undefined): string;
export function formatSpeed(bytesPerSecond: number | null | undefined): string;
```

2. `test/format-bytes.test.ts`: `0 → '0 B'`, `1536 → '1.5 KB'`, `5 * 1024 ** 2
   → '5.0 MB'`, `null → '—'`, speed `0 → '0 B/s'`.
3. `src/components/details-popover.tsx`: `role="dialog" aria-modal="false"`,
   absolute above the signal button, 1px `--line`, radius 12px, rows from the
   spec, one HTTP line instead of torrent rows when `source === 'http'`.
4. Close on outside `pointerdown`, on Escape (return focus to the signal
   button), and when the sheet opens.

Verify: numbers change while a torrent plays; Escape closes and focuses back.

## Task 7 — Menu, About, Privacy, and the page wiring

1. `src/components/menu-sheet.tsx`: rows as in spec §5; appearance segmented
   control writes `theme` and applies immediately; language row shows
   `العربية` selected and `English` disabled + "قريباً"; `عن تلاوة` and
   `الخصوصية` switch the sheet kind.
2. `useSheet` kinds extended: `'menu' | 'about' | 'privacy'`; opening one closes
   the previous.
3. About: `next/image`-free `<img src="/images/logo.png" width={96} height={96}>`
   with `alt="تلاوة"`, three short lines, `mailto:` contact, licence, version.
4. Privacy: five lines, no legal theatre.
5. `sheet.tsx` `SurahSheet` rows: 64px two-line rows — number, name (+ ink dot
   when playing), `{ayahCount} آية · الجزء {juz}`, and `formatBytes(file.length)`
   at the end when the track has a file. Accept an optional
   `sizes: Record<number, number>` prop from `PlayerPage` (`torrentAtom.files`).
6. `sheet.tsx` `ReciterSheet` rows: same 64px anatomy — name, second line
   `{source host} · {كامل|جزئي}`, and a bordered `P2P` / `HTTP` label at the end.
7. `player-page.tsx`: reciter becomes the bordered chip; surah name uses
   `font-display`; keep every other row identical.

Verify: menu → About → back works with one sheet at a time; theme survives a
reload; `⋯` and the bar both close on Escape.

## Task 8 — Tests, browser pass, docs

1. `npm test`, `npx tsc --noEmit`, `npm run build`.
2. Placeholder grep: no `TBD`, no `react-router`, no dead imports.
3. Playwright at 1440×900, 390×844, 390×600: the nine checks in spec §9.
   Screenshots: light desktop, dark desktop, menu open, details open, phone.
4. `README.md`: replace "The player screen" section's control list with the
   three edges, and document `theme`/`rate` in storage.

## Task 9 — Ship

1. Commit per task, conventional messages.
2. `docker compose build web && docker compose up -d web`.
3. Live check on `https://tilawa.quran.us.kg`: bars present, one P2P play with
   the popover showing peers, dark mode persists, one 206 on seek.

## Rollback

`git checkout feat/web-minimal-player && docker compose build web && docker
compose up -d web` restores the chrome-less player.

---

## Execution ledger (2026-10-26)

1. **Bars are edge-to-edge dividers with 520px content.** The first build let the
   wordmark sit in the far corner and `⋯` in the other, which read as a website
   header. The hairlines still span the viewport; the contents align with the
   player column.
2. **The reciter chip is filled, not merely outlined.** A 1px `--line` border on
   white is invisible at a glance; `bg-line` is what makes it read as a control.
3. **Surah name 52px, not 48.** Amiri's x-height is smaller than IBM Plex at the
   same size, so 48 lost the hierarchy against the 15px chip.
4. **The global `:focus-visible` no longer sets `border-radius: 2px`.** It was
   squaring off every round button on keyboard focus; the outline follows the
   element's own radius now.
5. **`ayahCountLabel`** (`utils/arabic-count.ts`): `{n} آية` is wrong for 7; the
   rows say `7 آيات`, `286 آية`, `آيتان`.
6. **`nextRate` returns 1 for non-finite input** (snapping an unknown value onto
   the ladder then stepping would produce 1.25 out of nowhere).
7. **No copy module.** Phase 1 has one language; the strings table belongs to the
   English spec, where it can be verified by a second locale.
8. **Details popover** also closes on outside `pointerdown`, and Escape returns
   focus to the signal button.

### Verification evidence

- `npm test` 17/17, `npx tsc --noEmit` clean, `npm run build` clean.
- Production build on `vite preview`, 1440×900 / 390×844 / 390×600, service
  worker cleared first:
  - bars present, wordmark `تلاوة`, `⋯` opens `الإعدادات`;
  - 114 surah rows at 64px, `7 آيات · الجزء 1`, current row scrolled into view;
  - 11 reciter rows, `mp3quran.net · كامل` and a `P2P` label;
  - rate `1x → 1.25x → 1.5x → 2x`, `audio.playbackRate` follows and the value
    survives a reload;
  - dark mode applies immediately, persists across reload, `#000` canvas;
  - details popover shows the HTTP line for an Itqan reciter, Escape closes it
    and returns focus, outside click closes it;
  - no horizontal overflow at any of the three sizes; both bars stay visible at
    390×600.
- The seven-row P2P variant of the popover needs a real swarm to fill; verified
  on the live host in the ship step.

### Correction after container verification (2026-10-26)

- **Sheet-to-sheet navigation closed both.** `dialog.close()` fires the same
  `close` event as a dismissal, and the sheet forwarded it to `onClose`, so
  opening About from the menu closed About immediately. The `close` handler is
  gone; Escape is handled by `onCancel` (prevented) and the backdrop click.
- **About shows the wordmark as type, not the PNG.** `logo.png` is a transparent
  navy raster: fine on white, a dark mark on black. The wordmark in Amiri adapts
  to both themes and matches the top bar; the PNG stays the favicon/social asset.
- **The Docker build needed `npm ci --ignore-scripts`.** WebTorrent's browser
  bundle is vendored in `public/`, so nothing from `node_modules` is shipped, but
  `node-datachannel` has no musl prebuild and tried to compile in the Alpine
  build stage. It also had a stale `# syntax=docker/dockerfile:1` that forced a
  registry round-trip; removed.
