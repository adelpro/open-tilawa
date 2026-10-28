# Open Tilawa — web UI/UX audit through Apple's design principles

Date: 2026-10-28
Scope: `apps/web` on `develop` (working tree, incl. uncommitted changes) + measurements against
the deployed build at https://tilawa.quran.us.kg (390×844 and 1280×800, light and dark).
Lens: `apple-design` skill — response, direct manipulation, interruptibility, springs, velocity
handoff, spatial consistency, materials, typography, reduced-motion, and the eight principles.

The app's own design brief ("one screen, five values, no second surface, no shadow, no accent
colour") is treated as a constraint, not a problem. Every recommendation below keeps the
monochrome five-token system.

---

## Verdict

The **visual system is disciplined and the engineering care is visible** (pre-paint theme and
locale, real `<dialog>`, tabular numerals, 44px scrubber hit area, `aria-current`, reduced-motion
baseline). What is missing is almost entirely **the physics layer**: nothing on this page can be
grabbed, nothing carries momentum, and the one gesture the layout *promises* — a bottom sheet —
cannot be dragged and disappears instantly. The other gap is **hierarchy on the phone**: the most
important information on the page (what is playing) is the smallest text, and the largest element
is a button the user may not be able to press yet.

Two of the findings are not taste, they are breakage: the **download ring is dead UI** and, in
**dark mode, the sheet is the same colour as the page** with a 30% black scrim over near-black.

---

## P0 — credibility

### 1. The download ring never fills (dead affordance)

`player-page.tsx:182` computes the per-file progress, then never passes it:

```
player-page.tsx:312  <PlayerFooter surahName=… source=… rate=… muted=… />
                     // progress prop missing
player-footer.tsx:15 progress = 0
```

Measured live: `stroke-dashoffset = 125.66` = full circumference, i.e. **0%**, and the aria-label
never includes the percentage. The 44px target in the footer corner therefore advertises a state
that never changes, which is worse than not drawing it.

Fix: pass `progress={progress}`; and while nothing has downloaded, render the track only (already
the case) so the ring reads as "not started" rather than "broken".

### 2. The sheet cannot be dragged, and it cannot leave

- The panel enters with a **12px** rise (`globals.css:169-176`), on a surface that is **760px tall**
  at 390×844. A 12px translate on a full-height panel does not read as "rising"; it reads as a pop.
- There is **no exit animation at all**: `dialog.close()` (`sheet.tsx:93`) removes it from the top
  layer synchronously. Things arrive along one path and leave through a hole in space — the exact
  asymmetry *spatial consistency* forbids.
- There is **no grabber and no drag gesture** (`hasGrabber: false`, no pointer handlers). A bottom
  sheet is a physical metaphor; a sheet that only closes by tapping a scrim or a ✕ is a modal that
  happens to be bottom-aligned.
- **Android back does not close it** (`use-sheet.ts` never touches history), so back exits the whole
  app while the sheet is up.

Fix (in order of payoff): pointer-drag-to-dismiss with 1:1 tracking, velocity handoff and momentum
projection on release; a 4px grabber inside the 52px header; open **and** close animation from the
same origin; `history.pushState` on open so back closes the sheet.

Motion values from the skill (sheet is momentum-driven once dragged):

```js
// drag: setPointerCapture, track y + velocity; on release
const projected = y + project(v);          // project(v) = (v/1000) * 0.998 / (1 - 0.998)
const target = projected > height * 0.35 ? height : 0;   // decide by velocity *and* distance
animate(el, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.3, velocity: v });
```

Non-dragged open/close: `bounce: 0`, `duration: 0.3` (critically damped — no overshoot for a menu
that was not flicked). Exit must mirror the entry, not replace it.

### 3. In dark mode the modal layer has no depth

Measured, dark theme:

| | value |
| --- | --- |
| page background | `rgb(11, 11, 12)` |
| sheet background (`bg-canvas`) | `rgb(11, 11, 12)` — identical |
| scrim | `rgba(0,0,0,.3)`, `backdrop-filter: none` |
| sheet shadow | `none` |
| ring track | `rgba(17,17,17,.14)` → **1.37:1** on the page |

A 30% black scrim over `#0b0b0c` is invisible; because the panel is also `#0b0b0c`, the only cue
that a layer opened is a 16px corner radius. In light mode the same scrim is strong (`#b3b3b3`),
so the two themes do not have the same information architecture.

The skill's remedy that fits this palette: material **weight**, not colour — one step of tint plus
blur on the scrim only (no new tokens needed, use `ink` alpha):

```css
.sheet::backdrop { background: rgba(0,0,0,.35); backdrop-filter: blur(6px) saturate(120%); }
[data-theme='dark'] .sheet {                          /* lift the surface off the page */
  background: color-mix(in oklab, var(--bg) 88%, var(--ink));
  border-top: 1px solid color-mix(in oklab, var(--line) 60%, var(--ink));
}
```

And the ring track must be a token, not a hardcoded light-mode value:

```diff
- stroke="rgba(17, 17, 17, 0.14)"
+ stroke="var(--line)"
```

### 4. The system chrome stays white in the night palette

- `index.html` `<meta name="theme-color" content="#ffffff">` and `vite.config.ts:40
  theme_color: '#ffffff'` are static; measured `theme-color` is still `#ffffff` with
  `data-theme="dark"`. Installed as a PWA (`display: standalone`) that is a white status bar on a
  black app.
- The top bar has `px-4` and no `pt-[env(safe-area-inset-top)]` (`top-bar.tsx:62`); the footer,
  player and sheet scroll bodies all handle the bottom inset. On a notched iPhone in standalone
  mode the bar sits under the status bar.

Fix: set `<meta name="theme-color">` inside `applyTheme()` (and a matching `theme-color` entry in
the manifest), add the top inset to the header.

### 5. The deployed build is serving two functional failures

Not design, but they change what the design is reviewing:

```
ERROR Access to fetch at 'https://admin-tilawa.quran.us.kg/api/public/reciters?page=1&range=10'
      from origin 'https://tilawa.quran.us.kg' has been blocked by CORS policy
ERROR WebSocket connection to 'wss://tracker.quran.us.kg/' failed: 502
```

So the live roster is the **bundled fallback** (no `nameAr`, no paging, no catalogue ordering), and
P2P peers never arrive. Also, the live desktop
top bar computes to `background: rgba(0,0,0,0)` + `backdrop-filter: none` at 1280px, i.e. the live
CSS predates `ea9c044`. Re-run this audit against the deployed artifact after the next deploy.

---

## P1 — feel

### 6. Only one control gives press feedback

`.play-button` has a real `:active` sink (`globals.css:143`) and list rows have `active:bg-line`
(`sheet.tsx:278`). Everything else is hover-only: the four transport ghosts (`transport.tsx:60`),
every chip (`sheet.tsx:282`, `settings-page.tsx:12`, `account-sheet.tsx:19`), the favourite heart,
the footer icons. On a phone `:hover` sticks after the tap, so the press produces *no* immediate
acknowledgement and then a stuck highlight.

Fix: one shared press rule, pointer-down, 100ms:

```css
.press { transition: transform 100ms ease-out, background-color 120ms ease-out; }
.press:active { transform: scale(.96); background: var(--line); }
@media (prefers-reduced-motion: reduce) { .press:active { transform: none; } }
```

### 7. The scrubber is invisible exactly where it is used most

`scrubber.tsx:46` shows the 10px thumb on `group-hover` / `group-focus-within`. Touch devices have
neither, so during a drag on a phone **there is no thumb at all** — the rail grows and that is the
only feedback. Direct manipulation wants the thing you grabbed to be visible under your finger.

Also `scrubber.tsx:56`: every `onChange` assigns `audio.currentTime`. A 60Hz drag issues ~60 seeks
per second against a torrent stream, each one a range request; the label follows but playback
stutters. Apple's idiom is 1:1 *preview* while dragging, commit on release.

Fix: show the thumb whenever the input is active (`:active` / `:focus` / `pointerdown`), keep a
local `previewSeconds` state during the drag, render the label from it, and call `onSeek` once on
`pointerup` / `change` (or throttled to ~4Hz while dragging).

### 8. Tap targets under 44px (measured on the live build)

| element | size | file |
| --- | --- | --- |
| favourite heart | **41×17** | `favorite-button.tsx:33` |
| footer surah row | 270×**28** | `player-footer.tsx:60` |
| footer reciter row | 270×**28** | `player-footer.tsx:70` |
| mute | **40×40** | `player-footer.tsx:83` |
| riwaya / sort chips (10 of them) | ×**32** | `sheet.tsx:282` |
| settings chips | ×32 | `settings-page.tsx:12` |
| top-bar ⋯ and ⌨ | 28×28 | `top-bar.tsx:123,160` (desktop only) |

The heart is the worst case: it is the only destructive-ish control in a 64px row and it is 17px
tall. Fix: `min-h-11 min-w-11` on the heart, `h-9` (36) minimum on chips inside a taller padded
container, `h-11` on the two footer rows (the footer grows to ~72px but the rows become pressable).

### 9. On desktop nothing moves

`globals.css:238` adds `padding-inline-start: 384px` to `.theatre` the instant a panel docks, and
`sheet.tsx:111` flips `hidden`/`flex` on a 360px `<aside>`. The stage therefore **teleports** to
its new centre, and the panel appears without arriving. The ⋯ popover (`top-bar.tsx:129`) also
appears at full size with no origin, no scale and no `transform-origin` on its trigger.

This is the one place where the phone is more considered than the desktop. Fix: `transition:
padding-inline-start 320ms` with the same curve as the panel, and slide the panel `translateX(±8px)
+ opacity` from 0.96 scale; for the popover, `transform-origin: top right` (RTL-aware: `inline-end`)
and a `scale(.96) → 1` at 120ms. Reduced motion: opacity only.

### 10. Typography is entirely px, so it cannot grow

97 occurrences of `text-[Npx]` and **zero** rem-based sizes. Smallest: `10.5px` (riwaya label,
`sheet.tsx:567`) and `11.5px` (meta lines, 17 uses). Consequences: iOS/Android text-size settings do
nothing, and at 390px width the meta rows are ~8pt. Body text itself is correct (16px/1.5), and the
desktop `h1` is good craft (`clamp(32px,4vw,56px)` with `-0.02em`).

Fix: convert the scale to rem on one ladder (11.5→0.75rem, 12.5→0.8125rem, 13→0.8125rem,
15→0.9375rem) and let the min sizes land at 0.75rem so a 115% user setting is applied by the
browser instead of being ignored.

Related layout bug: `.page-screen` desktop padding is `48px` (`globals.css:117`) while the fixed
top bar is `56px` tall — measured overlap of **8px** at 1280px, so `/settings`'s back link sits
under the bar *at rest*, before any scrolling. Set the padding to `calc(56px + 24px)`.

### 11. Pressing play while the torrent boots gives no answer

`ready = Boolean(track)` (`use-player-nav.ts:77`) disables the primary action at 30% opacity, and
the only explanation of *why* lives inside the stream sheet (one tap away, and the ring that would
have signalled progress is dead — see #1). Status feedback should be where the action is.

Fix: three states on one line under the transport — `جارٍ التحضير` while no file, the ring when
downloads are moving, and the existing error/retry path after. If nothing has arrived in ~10s, say
so explicitly instead of leaving a dimmed button.

### 12. Reduced motion is a kill switch, not a translation

`globals.css:178-186` sets every animation and transition to `0.001ms`. That removes the press
feedback the skill explicitly says to *keep* (it is comprehension feedback, not vestibular). And
`visualiser.tsx:157` stops reading the analyser under `reduce`, freezing the bars at the `0.08`
floor while `opacity` is 1 — a static dotted shelf that looks like a rendering bug.

Also unhandled: `prefers-reduced-transparency` (the desktop bar is `85%` + blur — should go opaque)
and `prefers-contrast: more`. And the theme flip is instant (`use-theme.ts`), i.e. a full-screen
brightness jump in the dark — the one transition the skill asks you to *ease*.

Fix: replace the `*` kill switch with a targeted rule (drop translate/scale, keep colour and
opacity); under `reduce`, draw one static waveform shape instead of frozen live bars; add the two
missing media queries; add `html { transition: background-color 240ms ease, color 240ms ease }`
guarded by reduced-motion.

### 13. One palette escape, and it fails contrast in light mode

Five `red-500` classes in the account sheet (`account-sheet.tsx:102,128,168`) against a design
system whose own comment says "no accent colour". Measured `#ef4444`: **3.76:1 on white** (fails
AA for the 11.5px sign-out warning) and 5.23:1 on the night palette. If destructive needs a colour,
add one tinted token used in both themes; otherwise use `ink` + weight, as the rest of the page does.

### 14. The visualiser reads layout styles twice per frame

`visualiser.tsx:127-128` calls `getComputedStyle(document.body).color` twice inside `draw()`, which
runs every rAF. That is two forced style resolutions per frame on the only continuously animating
element on the page — on a low-end Android that is where the jank will come from.

Fix: read it once per theme change (it already depends on `[playing, model, height]`), cache the
string in a ref, and use a `MutationObserver` on `data-theme` or pass the token in as a prop.

---

## P2 — hierarchy & wayfinding

### 15. What is playing is the smallest thing on the screen

Measured at 390×844: the `<h1>` is `sr-only` (**1×1px**), the visible surah name is a **15px** row
in the footer, and the 72px play button is the largest element on the page in a viewport with
~380px of empty middle. The design intent ("the space above the scrubber belongs to what the
speaker is doing") is sound, but *simplicity is not minimalism*: the common path should be the most
obvious thing.

Suggestion that costs no new tokens: put `surah name (24–28px, semibold)` + `reciter (13px, muted)`
directly above the scrubber on mobile, and let the footer keep only transport affordances. It fills
the dead middle, answers "where am I / what is this", and gives the play button a peer rather than
a caption.

### 16. Two competing vocabularies for the same object

The footer says `قائمة السور` / `اختيار القارئ` to assistive tech while the visible text is the
surah and reciter names, and the numbers `−15 / +15` are `dir="ltr"` inside an RTL row (correct,
but the glyphs read as a subtraction expression). Minor: `+15` implies "15 more", which is fine;
`−15` inside RTL can parse as a negative number. Consider `⟲15` / `15⟳` or an icon with the number.

### 17. The night theme has no "follow system" state

`resolveInitialTheme()` follows `prefers-color-scheme` only until the user taps a chip; after that
the stored value wins forever and `/settings` offers only light/dark (`settings-page.tsx:90`).
Given this app is used at night, a third `النظام` option (and listening to the media query while it
is selected) is the *familiarity* win.

---

## What to keep

- Pre-paint `applyLocale` / `applyTheme` in `main.tsx` — no flash of wrong direction or palette.
- Real `<dialog>` with focus trap and top layer instead of a hand-rolled scrim.
- `:focus-visible` tokens (`globals.css:53`), `aria-current`, `aria-pressed`, `overscroll-contain`.
- Tabular numerals (`.tnum`) on every time, byte and count.
- 44px scrubber hit area around a 3px rail; 64px list rows; 11/12/14 px safe-area handling.
- RTL-aware chevrons (`rtl:rotate-0 ltr:rotate-180`) and the RTL transport order with the comment
  explaining it.
- The five-value palette and the decision to express playback state with weight rather than colour.

---

## Suggested order of work

1. `progress={progress}` on the footer (#1) — 1 line, removes a lie.
2. Ring track → `var(--line)`; scrim blur + dark surface lift (#3); theme-color + top safe-area (#4).
3. Sheet: drag to dismiss + exit animation + back-button (#2). This is the single biggest "feels
   alive" change and it also fixes the knowledge that the sheet can be dismissed without hunting
   for a ✕.
4. Scrubber thumb + commit-on-release (#7); press state on ghosts and chips (#6).
5. Tap targets (#8), mobile type hierarchy (#15), 8px settings overlap (#10).
6. Reduced-motion translation + two missing media queries + eased theme flip (#12).
7. Desktop panel/popover motion (#9); visualiser style caching (#14); palette escape (#13).

## How to re-verify

- `document.querySelector('dialog[open]')` geometry and `getComputedStyle(d, '::backdrop')`.
- Ring: `document.querySelector('footer svg circle:last-child').getAttribute('stroke-dashoffset')`.
- Contrast pairs: `--muted`, `--ink`, `red-500`, ring track — against `--bg` in both themes.
- Motion: DevTools → Animations panel at 10% speed, and a slow-motion screen recording of one
  sheet open/close and one scrub; watch for the seam at release and for any layer that disappears
  without travelling.

---

## Implementation status — 2026-10-28

Items 1–4 of the work order are in the tree; item 5 is partly local infra.

### #1 Download ring

`apps/web/src/app/player-page.tsx` now passes `progress={progress}` to `PlayerFooter`. The value
was already computed from `track.file.progress` (the current file, not the whole release); it simply
never reached the ring, so `stroke-dashoffset` sat at `125.66` (0%) forever.

The track circle changed from a hardcoded `rgba(17, 17, 17, 0.14)` to `stroke="currentColor"
strokeOpacity="0.22"`, so it is ink-derived in both themes instead of invisible in dark
(measured 1.37:1 against the night palette before).

### #2 Sheet as a gesture

`src/utils/sheet-drag.ts` (new) holds the physics as pure functions, tested in
`test/sheet-drag.test.ts` (12 tests, `node --test`, no DOM):

- `project()` — Apple's exponential-decay projection, so a release decides by *where the gesture was
  going*, not by where the finger stopped.
- `shouldDismiss()` — a flick over 800px/s dismisses from anywhere; without a flick the sheet must
  travel past 40% of its height; an upward flick never dismisses.
- `rubberband()` / `dragOffset()` — 1:1 downward, progressive resistance above the open position.
- `springStep()` — semi-implicit Euler spring (response 0.3s, damping 1) that reads the live value
  *and* velocity each frame, so re-targeting mid-flight has no seam.

`src/components/sheet.tsx` wires it: pointer capture on the header (after a guard that leaves
buttons, links and inputs alone), a 120ms velocity window, a spring for both snap-back and exit, and
a scrim that dims in step with the drag (`--sheet-backdrop`). The exit animation ends in
`dialog.close()`, so the panel still leaves through the top layer instead of being unmounted
mid-flight. `onClose` is no longer bound to the dialog's `close` event — that event fires for the
programmatic close too, and forwarding it is the bug that closes the *next* sheet.

Back now closes the sheet instead of leaving the site: the sheet pushes one history entry on open
and unwinds it on close, but only if it is still the current entry (picking a route from the menu
pushes a new one first, and going back there would undo the navigation).

Verified on the built app at 390×844 with real pointer input:

| gesture | before release | after release |
|---|---|---|
| slow drag 120px | `translateY(120px)`, scrim 0.84 | springs back to 0, sheet stays |
| fast flick 150px | `translateY(150px)` | dismissed, history entry unwound |
| slow drag 400px | `translateY(400px)` | dismissed |
| upward drag 120px | `translateY(-60.7px)` (damped) | springs back to 0 |
| ✕ / Esc / backdrop | — | dismissed, history unwound |
| `prefers-reduced-motion` | — | opens and closes with no animation |

### #3 Depth

`.sheet::backdrop` is `rgba(0,0,0,.32)` plus `backdrop-filter: blur(4px) saturate(1.05)` (0.5 in
dark), with a `prefers-reduced-transparency` fallback and an `@supports` fallback for browsers
without the filter. A derived `--surface` token (`#ffffff` light, `#19191a` dark) now backs the
sheet and the docked panel: same paper in daylight, one step of lift in the dark, where panel and
page were previously the identical `#0b0b0c`. The five authored values are unchanged.

### #4 Browser chrome

`applyTheme()` reads `--bg` back after setting `data-theme` and writes it into
`<meta name="theme-color">`, so the status bar can never contradict the page (measured: `#0b0b0c`
in dark, `#ffffff` in light, from a static `#ffffff` before). The top bar takes
`padding-top: env(safe-area-inset-top)` and grows by the same amount, instead of painting under the
notch.

### #5 The deployed build — root cause was not CORS

Two separate faults, both outside the web bundle:

1. **The production stack is not running.** `open-tilawa-web`, `open-tilawa-edge` and
   `open-tilawa-tracker` are absent from `docker ps`; only staging, admin, seeder and turn are up.
   `cloudflared` answers 502 for `tilawa.quran.us.kg` and `tracker.quran.us.kg` with
   `dial tcp 127.0.0.1:8084: connect: connection refused`, and the page that "loaded" in a browser
   was the service worker's cached shell from an older build.
2. **The admin tunnel was down.** `admin-tilawa.quran.us.kg` returned 530 (no connector), because
   the hostname is served by tunnel `994be141` (`~/.cloudflared/tilawa-admin-config.yml`, the
   `tilawa-admin.service` unit, inactive) and only tunnel `6396a7c8` was connected. The browser's
   "blocked by CORS policy" was the 530 response carrying no `Access-Control-Allow-Origin` header.

The API itself was always correct: `curl -H 'Origin: https://tilawa.quran.us.kg'` against the
container returns `Access-Control-Allow-Origin: https://tilawa.quran.us.kg`. Starting the admin
tunnel restored `GET /api/public/reciters` to 200.

While there: `.env` declared `ADMIN_CORS_ORIGIN` twice (once for production, once adding staging),
and the first line wins — so staging was silently unlisted despite the "Staging" comment. Merged to
one line and recreated `admin-api`; both origins now answer with their own `Access-Control-Allow-
Origin`.

**Still to do (needs a decision, it is a deploy):** bring `web`, `edge` and `tracker` up. The build
reads the working tree, so it must be committed first, or prod ships whatever is uncommitted.
