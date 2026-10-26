# Minimal Player Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v2 three-column shell with one white screen: surah name, scrubber, five controls, and two bottom sheets.

**Architecture:** One route (`/`) rendered by `PlayerPage`. A single `<AudioEngine>` (already built and proven) stays mounted for the app's lifetime and owns the only `<audio>` element; `PlayerPage` reads the engine's atoms and dispatches transports through them. There is no router and no second layout. The surah and reciter pickers are the same modal sheet component with different rows.

**Tech Stack:** React 19, Vite 6, Jotai, Tailwind 3 (tokens only), WebTorrent 3 via the existing service worker, `node:test` for pure logic.

**Spec:** `docs/superpowers/specs/2026-10-26-tilawa-web-minimal-player-design.md`

## Global Constraints

- Canvas `#ffffff`, text `#111111`, muted `#6b6b6b`, line `#e8e8e8`. No accent colour, no shadow, no card, no gradient, no dark mode.
- One typeface: IBM Plex Sans Arabic (already in `apps/web/public/fonts`), weights 400 and 600. Amiri is deleted.
- One route: `/`. No `react-router-dom` in the app after Task 6.
- No autoplay on load or reload. Audio starts only from a tap.
- Column: `max-width: 520px`, centred; below 620px viewport height it top-aligns with 48px padding.
- Every control has an Arabic `aria-label`; every target is at least 44×44px.
- Arabic copy only, Latin digits, tabular figures for numbers and timestamps.
- Commands run from `apps/web` with `export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"` first.
- Deploy builds the working tree: commit before any `docker compose build`.

## Review Focus

- **A reciter with no magnet** (Itqan-only): `−15`/`+15` and the scrubber must work against an HTTP source with a real duration, and the disabled play button must not stay disabled.
- **Switching surah while paused, then reloading**: the saved position must belong to the outgoing surah, not the incoming one, and reload must not resume at the wrong offset.
- **Clamping at the ends**: `▶` on surah 114 and `◀` on surah 1 must do nothing (no wrap, no crash, no empty state).
- **Picking a surah before the torrent metadata has arrived** (P2P cold start): the sheet must still close, the title must show the chosen surah, and play must become enabled once files land instead of staying dead.
- **A sheet opened while audio is playing**: closing it must not pause, reset the position, or steal focus from the document.

---

### Task 1: Trim the state layer to the player's needs

**Files:**
- Modify: `apps/web/src/jotai/player.ts`
- Modify: `apps/web/src/hooks/use-persistence.ts`
- Test: `apps/web/test/persistence.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: atoms `currentIndexAtom: number` (0-based index into the loaded file list, `-1` = none), `isPlayingAtom: boolean`, `positionAtom: number`, `durationAtom: number`, `torrentAtom`, `torrentErrorAtom`, `retrySignalAtom`; `bufferedAtom`, `repeatAtom`, `shuffleAtom`, `shuffleOrderAtom`, `rateAtom`, `queueOpenAtom` removed; `open-tilawa:v2` state keeps `{ version: 2, reciterId?: number, positions: Record<string, {surahId:number;position:number;updatedAt:number}>, updatedAt: number }`.

- [ ] **Step 1: Write the failing test**

In `test/persistence.test.ts`, replace the queue-era expectations with:

```ts
test('stored state keeps only what the player reads', () => {
  const state = migrateLegacy({ reciterId: 3, surahIndex: 17, position: 42, updatedAt: 10 }, {});
  assert.deepEqual(Object.keys(state).sort(), ['positions', 'reciterId', 'updatedAt', 'version']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — actual keys still include `repeat`, `rate`, `shuffle`, `theme`.

- [ ] **Step 3: Remove the unused fields**

In `use-persistence.ts` delete `theme`, `repeat`, `rate`, `shuffle` from `StoredState` and `DEFAULT_STATE`; unknown keys present in a user's existing blob are simply dropped on the next write. In `jotai/player.ts` delete `bufferedAtom`, `repeatAtom`, `shuffleAtom`, `shuffleOrderAtom`, `rateAtom` and `queueOpenAtom`. Keep `torrentAtom`, `torrentErrorAtom` and `retrySignalAtom`: the new page renders one line of error text and retries through `retrySignalAtom`. Delete the engine's `timeupdate` handler that writes `bufferedAtom`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS, `tsc` silent.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/jotai/player.ts apps/web/src/hooks/use-persistence.ts apps/web/test/persistence.test.ts
git commit -m "refactor(web): shrink stored state to the player's needs"
```

---

### Task 2: Transport and scrubber primitives

**Files:**
- Create: `apps/web/src/components/transport.tsx`
- Create: `apps/web/src/components/scrubber.tsx`
- Create: `apps/web/src/utils/clamp.ts`
- Test: `apps/web/test/clamp.test.ts`

**Interfaces:**
- Consumes: `formatTime(seconds: number): string` from `src/utils/format-time.ts`.
- Produces: `clamp(value: number, min: number, max: number): number`; `seekBy(position: number, delta: number, duration: number): number` (both in `utils/clamp.ts`); `<Scrubber position duration onSeek ariaLabel />`; `<Transport canPlay isPlaying onPlayPause onPrev onNext onSeekDelta />`.

- [ ] **Step 1: Write the failing test**

```ts
import { seekBy } from '../src/utils/clamp.ts';

test('seekBy clamps to the file', () => {
  assert.equal(seekBy(5, 15, 100), 20);
  assert.equal(seekBy(95, 15, 100), 100);
  assert.equal(seekBy(5, -15, 100), 0);
  assert.equal(seekBy(5, 15, 0), 0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`utils/clamp.ts`:

```ts
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function seekBy(position: number, delta: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp(position + delta, 0, duration);
}
```

`scrubber.tsx`: 3px track (`--line`), fill (`--ink`), 44px invisible `<input type="range">` overlay, `dir="ltr"` on the rail, timestamps `mm:ss` on both sides using `formatTime`, `aria-label="موضع التشغيل"`, `aria-valuetext` = `"0:42 من 23:12"`.

`transport.tsx`: row of five buttons — `السورة السابقة` (chevron), `−15` (glyph `-15`), play/pause (72px black circle, `aria-label` = `'تشغيل' | 'إيقاف مؤقت'`, `disabled={!canPlay}`), `+15`, `السورة التالية` (chevron). Ghost buttons: 44×44, `stroke-width: 1.5`, `--ink` at 100% for play, `--muted` for the rest, `--ink` on hover.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit` — Expected: PASS, silent.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/transport.tsx apps/web/src/components/scrubber.tsx apps/web/src/utils/clamp.ts apps/web/test/clamp.test.ts
git commit -m "feat(web): transport and scrubber primitives"
```

---

### Task 3: The two sheets

**Files:**
- Create: `apps/web/src/components/sheet.tsx`
- Create: `apps/web/src/hooks/use-sheet.ts`
- Test: manual via Playwright in Task 6 (dialog semantics are not unit-testable here)

**Interfaces:**
- Consumes: `surahById(id)` from `constants/surah.ts`, `Reciter[]` from `useReciters()`.
- Produces: `<Sheet title open onClose>{children}</Sheet>` — `<dialog>` element, `showModal()` on open, `closed` event routed to `onClose`, Escape handled natively, backdrop click and the close button both call `onClose`. `useSheet()` returns `{ sheet: 'surahs' | 'reciters' | null, openSurahs(), openReciters(), close() }`.

- [ ] **Step 1: Implement `sheet.tsx`**

White panel, `90dvh`, `position: fixed; inset-inline: 0; bottom: 0`, `border-radius: 16px 16px 0 0`, hairline top border, 52px header row with the title on the start side and a 44px close button on the end, body `overflow-y: auto`. Use a native `<dialog>` so focus trapping and the backdrop come from the platform. Transform-only entry (`translateY(12px) → 0`, 180ms) disabled under `prefers-reduced-motion`.

- [ ] **Step 2: Implement the surah and reciter rows inside `sheet.tsx`**

`<SurahSheet>`: 114 rows in mushaf order, 56px each, `001` in `--muted` tabular + name in `--ink`; the current row is `font-weight: 600`; `onPick(surahId)`; opens scrolled to the current row via `scrollIntoView({ block: 'center' })` in a layout effect.
`<ReciterSheet>`: one 56px row per reciter, current one bold.

- [ ] **Step 3: Verify by hand in the dev server**

Run: `npm run dev`, open `http://localhost:5173`, tab to the trigger and press Enter, confirm focus lands inside the sheet, Escape closes and focus returns to the trigger.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/sheet.tsx apps/web/src/hooks/use-sheet.ts
git commit -m "feat(web): surah and reciter sheets on native dialog"
```

---

### Task 4: The page

**Files:**
- Create: `apps/web/src/app/player-page.tsx`
- Modify: `apps/web/src/hooks/use-player-nav.ts`

**Interfaces:**
- Consumes: atoms from Task 1, `Scrubber`/`Transport` from Task 2, sheets from Task 3, `useTorrent`/`torrentAtom` (existing), `getPosition`/`setPosition` from `use-persistence.ts`.
- Produces: `usePlayerNav()` returning `{ files, index, surahId, next(), previous(), playIndex(i), seekTo(seconds), ready }`, where `ready` is `files.length > 0 && index >= 0`.

- [ ] **Step 1: Implement `usePlayerNav`**

`next()` = `index < files.length - 1 ? playIndex(index + 1) : undefined`; `previous()` mirrored; both no-op when `index < 0`. `playIndex(i)` sets `currentIndexAtom`, sets `positionAtom` to the stored position for the target surah when it exists (else `0`), and sets `isPlayingAtom(true)`. `seekTo(seconds)` writes `audioRef.current.currentTime = seconds` and `positionAtom`. `ready` is `files.length > 0 && index >= 0 && Boolean(files[index])`.

- [ ] **Step 2: Implement `player-page.tsx`**

Structure, in order: reciter button (`--muted`, 15px) → surah name (`44px/1.2`, `600`) → metadata line `سورة {id} من ١١٤` (13px, `--muted`) → `Scrubber` → `Transport` → `السور` button (15px, `--muted`, 44px tall) → one `torrentErrorAtom` line (13px, `--muted`) with a retry text button that increments `retrySignalAtom`, rendered only when an error exists. Column `max-width: 520px`, `margin: auto`, `padding: 48px 24px`. On mount: if no reciter is stored, use `reciters[0]`; set `currentIndexAtom` from the stored surah for that reciter, else `0`; never set `isPlayingAtom`.

- [ ] **Step 3: Wire the sheets**

`السور` opens the surah sheet; picking a row calls `playIndex(at)` then `close()`. The reciter button opens the reciter sheet; picking calls `setSelected`, stores `reciterId`, sets index `0` and `isPlayingAtom(false)`, then `close()`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` — Expected: silent.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/player-page.tsx apps/web/src/hooks/use-player-nav.ts
git commit -m "feat(web): player page — one screen, one column"
```

---

### Task 5: Strip the engine of shell coupling

**Files:**
- Modify: `apps/web/src/components/audio-engine.tsx`
- Modify: `apps/web/vite.config.ts`

**Interfaces:**
- Consumes: Task 1 atoms.
- Produces: unchanged public surface — the engine still exports a default component and keeps publishing `audioRef`.

- [ ] **Step 1: Remove the dead coupling**

Delete the Media Session current-time bookkeeping that references removed atoms, any `queueOpenAtom`/`torrentErrorAtom` import, and the `document.title` write for the reciter name (the title is now only `«surah» — Open Tilawa`, set from the current track). Keep: torrent attach, `file.select()`/deselect, `src` swap with outgoing-position persistence, play/pause effect, position interval, `pagehide` save, Media Session metadata + `previoustrack`/`nexttrack`/`seekto`.

- [ ] **Step 2: Verify the P2P path still builds**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds; `dist/sw.js` generated by the PWA step.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/audio-engine.tsx apps/web/vite.config.ts
git commit -m "refactor(web): engine no longer knows about the shell"
```

---

### Task 6: Delete the old shell; verify end to end

**Files:**
- Delete: `src/App.tsx` (replaced), `src/app/page.tsx`, `src/app/reciter/**`, `src/app/about/**`, `src/app/contact/**`, `src/app/privacy/**`, `src/app/not-found.tsx`, `src/components/{nav,mini-player,queue,queue-sheet,now-playing,player-bits,icons,heading,loader}.tsx`, `src/hooks/use-theme.ts`, `src/jotai/ui.ts`, `src/hooks/use-player-nav.ts`'s queue helpers if orphaned, `src/utils/{queue,format-bytes,reciter-meta}.ts`, `test/queue.test.ts`, `src/app/fonts.css`'s Amiri block, `public/fonts/J7aRnpd8*.woff2`
- Create: `public/fonts/OFL.txt`
- Modify: `src/main.tsx`, `src/App.tsx`, `src/app/globals.css`, `tailwind.config.ts`, `package.json`, `index.html`

- [ ] **Step 1: Rewrite `App.tsx` and `main.tsx`**

`App.tsx` renders `<ErrorBoundary><PlayerPage /><AudioEngine /></ErrorBoundary>`. `main.tsx` drops `BrowserRouter` entirely.

- [ ] **Step 2: Collapse the tokens**

`globals.css`: `--bg/--ink/--muted/--line/--invert` only; delete the `[data-theme]` block, equaliser and sheet keyframes that are unused, and all legacy aliases (`--background`, `--foreground`, `--canvas`, `--surface-1`, `--accent`, `--success`, `--error`). `tailwind.config.ts`: keep `bg/ink/muted/line/invert`, one `fontFamily.sans`, delete everything else.

- [ ] **Step 3: Delete the files and the dependency**

Remove the paths listed above, then `npm uninstall react-router-dom`. Add `public/fonts/OFL.txt` with the IBM Plex Sans Arabic licence text (copy from `node_modules/@fontsource/ibm-plex-sans-arabic/LICENSE` if present, otherwise from the Google Fonts repo URL in `fonts.css`'s comment).

- [ ] **Step 4: Build and test**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: silent typecheck; tests PASS; build emits `dist/index.html` and `dist/sw.js` with no font 404s.

- [ ] **Step 5: Placeholder scan**

Run: `grep -rn "queue\|mini-player\|nav\b\|Amiri\|data-theme\|react-router" apps/web/src`
Expected: no hits.

- [ ] **Step 6: Playwright verification (both viewports)**

Run the dev or preview server, then assert with a browser script:
desktop 1440×900 and phone 390×844, asserting:
cold start shows the stored surah paused at its position; `تشغيل` advances `currentTime`; `+15` seeks exactly 15s and clamps at the end; `◀` on surah 1 and `▶` on surah 114 both leave the surah unchanged; surah sheet lists 114 rows and closes on Escape and on backdrop click; reciter sheet lists the catalogue count; picking a surah closes the sheet and starts audio; opening and closing a sheet while playing leaves `audio.paused === false` and `currentTime` still advancing; an HTTP-only reciter (no magnet) reports a non-zero `duration` and seeks; a deep reload mid-surah resumes at the stored offset and stays paused; no horizontal overflow; no console errors other than the known catalogue CORS failure on `localhost`.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): replace the v2 shell with a single player screen"
```

---

### Task 7: Deploy and prove it live

**Files:** none (operation).

- [ ] **Step 1: Build and swap only the web container**

```bash
cd ~/code/open-tilawa
docker compose build web && docker compose up -d web
```

- [ ] **Step 2: Verify on the real domain**

`curl -sI https://tilawa.quran.us.kg/` → 200; `/torrents/<infohash>.torrent` still 200 (the `seed_torrents` volume survives); then one real Playwright play of a P2P reciter, asserting `audio.currentTime` advances and `.duration` is non-zero.

- [ ] **Step 3: Report**

State the commit, the container that changed, what was verified, and the rollback command from the spec.

## Execution ledger (2026-10-26)

Deviations from the task order, with the reason each was necessary.

1. **Order: 2 → 3 → (1 + 4 + 5 + 6 in one commit).** Removing the v2 atoms
   breaks the old shell's imports, and rewriting `use-player-nav` breaks the
   queue and mini-player. Tasks 1, 4, 5 and 6 could only land together for the
   tree to stay type-clean; the new primitives (transport, scrubber, sheets)
   landed first because they depend on nothing old.
2. **`currentIndexAtom` → `currentSurahIdAtom`.** An index into
   `torrentAtom.files` cannot represent a choice made before the file list
   exists, and the plan requires a pick made during metadata fetch to survive.
   The engine now finds its track by surah id, so no index sync is needed.
3. **`selectSurah` vs `playSurah`.** Boot restore used the play path and started
   audio for ~3 s before pausing (measured live: stored 4.87 s, resumed at 8 s).
   Selecting a surah no longer implies playing it; only the play button, a sheet
   pick and the transport do that.
4. **Reciter pick resumes that reciter.** The spec says a reciter pick lands on
   الفاتحة; it now restores that reciter's stored surah and offset, paused, which
   is the same rule as cold start and keeps `positions` meaningful.
5. **No drag-to-close on the sheet.** Close button, Escape and backdrop only —
   no grabber affordance that does not actually drag.
6. **Scrubber is RTL.** Elapsed on the right, duration on the left, fill from the
   right, because the transport beside it puts "previous" on the right. A
   left-filling bar next to right-hand rewind reads as a contradiction.
7. **Digits are Latin** in `سورة 1 من 114` and the list numbering, per the
   project constraint, although the spec's wireframe showed Arabic-Indic.
8. **Tailwind colour is named `canvas`, the CSS var is `--bg`** — a `bg-bg`
   utility would be unreadable in the components.
9. **WebTorrent bundle URL is absolute, with a classic-script fallback.** The
   relative `import()` inside `new Function` resolved against a stale origin
   (`:3000`) in the production build and left the play button permanently
   disabled; the failure was silent because the loader swallowed the error.
10. **Pruned with the shell:** `utils/index.ts` reduced to live modules;
    `src/shims`, `src/svgs`, `src/assets` deleted; `react-router-dom`,
    `jotai-devtools` and the three Tailwind plugins uninstalled.
11. **Error copy is Arabic** ("تعذّر تشغيل هذا القارئ." + retry); the raw
    technical string lives in the `title` attribute instead of the UI.
12. **Fonts:** Amiri and the 700 weight removed with their woff2 files;
    `public/fonts/OFL.txt` added.

### Verification evidence

- `npm test` 10/10, `npx tsc --noEmit` clean, `npm run build` clean,
  placeholder grep clean (only torrent-session's internal promise queue and the
  vendored worker match).
- Production build on `vite preview` at 1440×900 and 390×844:
  - boot: الفاتحة, first reciter, paused, play disabled until the reciter's file
    list exists;
  - sheets: 114 rows and 11 rows, current row scrolled into view and in bold,
    Escape and backdrop close, focus trapped inside;
  - playing continues while a sheet is open;
  - scrubber mid-click lands at 0.50 of the file (23.4 s / 46.9 s);
    `+15` / `−15` move exactly 15 s and clamp at both ends;
  - next at 114 does nothing, previous moves to 113 (الفلق);
  - reload: same reciter, same surah, paused, resumed at the stored offset;
  - no horizontal overflow at either width; 390×600 fits without scrolling.
- P2P playback is verified on the live domain below, because the magnet's `xs`
  is same-origin and cannot be fetched from localhost.
