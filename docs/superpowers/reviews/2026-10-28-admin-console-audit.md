# Tilawa Admin Console — UI/UX audit through Apple's design principles

Date: 2026-10-28
Scope: `apps/admin/apps/web` — the authenticated console: seeders, turns, torrents + node,
reciters, status, account, super-admin console, tools. AR and EN, 1440×900 and 390×844,
light and dark, in both reading directions.
Lens: `apple-design` — response, direct manipulation, spatial consistency, materials and
depth, typography, reduced motion — plus WCAG-derived checks where the effect is measurable.
Companion to `2026-10-28-admin-design-audit.md` (same lens, public surface only).

## Method

The previous audit could not reach the dashboard: *"the dashboard itself (`/dashboard/*`
behind auth) could not be reached without credentials; findings there are read from source
and CSS, and are marked (source)."* That limitation is gone.

- Built from source: `npm run build` (`tsc -b && vite build && prerender.mjs`).
- Served with a fixture API (`/tmp/opencode/adminpreview/server.py`) that answers `/api/me`,
  `/api/seeders`, `/api/seeders/:id/torrents`, `/api/reciters`, `/api/turns`, `/api/status`,
  `/api/admin/users`, `/api/admin/audit` and `/api/tokens` with realistic rows, so every
  screen renders with the mixed states an operator actually sees (online + offline node,
  published + draft + legacy reciter, failing service, stale device).
- Measured with a real browser at 1440×900 and 390×844, `en`/`ar`, `prefers-color-scheme`
  light/dark, `prefers-reduced-motion`, and CDP touch emulation for `(pointer: coarse)`.
- Empty states exercised by intercepting the list endpoints and returning `[]`.

Anything below without a "(source)" marker was measured in that browser. Numbers are CSS
pixels at a 16px root unless stated otherwise.

**Not done, and why:** axe could not run — the accessibility MCP's browser cannot launch in
this sandbox (`No usable sandbox!`), and `axe-core` is not a dependency of this app. The
accessibility statements below come from the DOM, computed styles and the repo's own
source-level suite (`test/a11y.test.mjs`), not from an automated WCAG pass. Treat them as
narrower than the previous audit's axe run.

---

## Verdict

The console is **internally coherent and unusually well governed** — one token file, one
component vocabulary (`Panel`, `Chip`, `Notice`, `Field`), rem-based type that really does
follow the browser's text size, reduced motion translated rather than disabled, and empty
states that name the next action. A dense admin UI with no horizontal overflow at 390px in
RTL is not an accident.

Of seventeen findings, five are breakage, six are feel, six are hygiene. What is left is **the layer above the tokens**: rules that exist in one file and not in the
other five, and three visual surfaces that were never styled at all. The forms problem you
spotted is a symptom, not a cause: the console has no shared "edit one object" primitive, so
each screen invented its own placement, and the one dialog primitive it *does* have is
missing two behaviours a dialog must not miss.

---

## P0 — breakage

### 1. The page scrolls behind an open dialog

Measured with a 2,145px-tall list and the delete-confirm open:

| reading | value |
| --- | --- |
| `window.scrollY` before the wheel | 0 |
| `window.scrollY` after one wheel while the dialog was open | **900** |
| `getComputedStyle(body).overflow` | `visible` |
| `getComputedStyle(html).overflow` | `visible` |

`Modal` traps focus, restores it to the trigger (`components/Modal.tsx:63`) and focuses its own panel (`:68`, trap at `:87-90`), but nothing locks the
document. On a laptop the background slides under the scrim; on a phone a drag with the
dialog open moves the page instead of the dialog. For a confirmation this is untidy; for the
four-field forms you want to move into modals it is unusable.

### 2. Small buttons never grow on touch — the rule is declared, then defeated

`components.css:224-228` says, in a comment, *"Coarse pointers get roomier targets per the
touch-target guidance"* and sets `.btn { min-height: 48px }`. Then, 21 lines later,
`components.css:245-248` sets `.btn--sm { min-height: 30px }`. Same specificity, later in the
file, so the small size wins on every pointer.

Measured at 390×844 with `(pointer: coarse)` true:

| control | height |
| --- | --- |
| page-head primary button | 50 |
| row action — فحص / التورنت / تعديل | **34** |
| same at 1440 with a mouse | 30 |

The dense row actions — the ones a thumb actually aims at — are the only controls the
guidance never reaches. This affects every table in the console (seeders, turns, reciters,
torrents, console), because every row action is `.btn--sm`.

### 3. Native `<select>`s were never styled — two wear a class that does not exist

| screen | control | measured | class |
| --- | --- | --- | --- |
| Super admin | Role filter | 277×**19** | `className="input"` on a `<select>` |
| Super admin | Status filter | 277×**19** | `className="input"` |
| Account → Preferences | Language | 66×**19** | none |
| Turns (for contrast) | Transport | 44 tall | `field__select` |

19px is the browser's own control height. Two of them sit inside a `.field` with a label and
look plausible at a glance, which is worse than looking broken. The cause is a class that
does not exist: `className="input"` matches **no rule** in `components.css` — the text input
is `.field__input` (`Field.tsx:47`), the select helper is `.field__select`. So these three
controls are styled by the browser, and the console's filter row is the one place in the
product where controls do not belong to the design system at all.

### 4. English strings and raw enum values inside the Arabic screen

Super admin, Arabic locale, measured text:

- Field labels **`Role`** and **`Status`** — literals in `AdminConsole.tsx:173` and `:186`;
- both filter options read **`All`** — `AdminConsole.tsx:179`, `:192`;
- every role chip reads `super_admin` / `admin` / `user` and every status chip reads
  `active` / `disabled` — the raw database values.

The catalogue already carries `admin.role` → `الدور` (`ar.ts:696`), and `seeders.statusOnline`
style keys exist for the other enums. This is not a missing translation; it is a screen that
did not use the catalogue it has. It is also the one finding that a native Arabic reader sees
before any of the craft items above.

---

### 5. Dark mode inverts elevation

| theme | page (`body`) | card (`.panel`) | reads as |
| --- | --- | --- | --- |
| light | `#f5f5f7` (`--canvas-parchment`) | `#ffffff` (`--canvas`) | raised ✔ |
| dark | `#1c1c1e` (`--canvas-parchment`) | `#000000` (`--canvas`) | **recessed** |

`tokens.css:207-213` sets `--canvas: #000000` for dark while `body` keeps
`--canvas-parchment` (`tokens.css:245-249`), so every card, dialog and panel is *darker* than
the page it sits on. In light mode the same two tokens produce the correct direction. Raised
surfaces are supposed to gain luminance in the dark, which is what makes an elevated layer
read as elevated; here the page's paper is lighter than its cards. One token swap fixes it,
and it changes every screen at once.

## P1 — feel and reach

### 6. Row actions still anchor to the cell edge, not to their column header

The seeders fix (`.row__actions`) aligned the action column to its `th`. The same table
pattern elsewhere still uses `cluster cluster--end`, and the numbers show it: in RTL
`flex-end` is the *left* edge, while `th` is `text-align: start` (the right edge).

| table | header content right | first button right | delta |
| --- | --- | --- | --- |
| Seeders | 419 | 419 | **0** ✔ |
| Turns | 399 | 389 | **10** |
| Reciters | 317 | 311 | **6** |

Ten pixels is enough to see: the actions sit slightly further from the reader than the label
above them. Same cause as the original complaint, four screens still unreached
(`Turns.tsx:393`, `AdminConsole.tsx:253`, `Torrents.tsx:494`).

### 7. The reciters action cell wraps to two lines in English

Measured at 1440 EN: `Reciters` first row has **2** distinct button tops — "Edit" and
"Remove" stack. AR shows one line. This is the seeders bug in its original form: five columns
of content plus a wrapping flex row. It only appears in EN because the labels are longer.

### 8. Three destructive actions are still one click

| action | source | confirm |
| --- | --- | --- |
| Remove TURN server | `Turns.tsx:420` | none |
| Remove service (status card) | `Status.tsx:220` | none |
| Remove torrent from node | `Torrents.tsx:498` | none |
| Delete reciter | `Reciters.tsx:786` | dialog |
| Unlink seeder | `Torrents.tsx:658` | dialog |
| Purge untracked torrents | `Torrents.tsx:620` | dialog |

Half the destructive actions confirm and half do not, with no rule distinguishing them. The
unconfirmed three are also the ones that sit *inside a row or card*, so they are the easiest
to hit by accident. (Apple's own guidance is the opposite direction: confirm genuinely
destructive, irreversible actions, and be sparing — but be consistent about which ones
qualify.)

### 9. Arabic display type is smaller and 35% looser than Latin

| locale | token | measured `h1` |
| --- | --- | --- |
| EN | `--display-lg: 600 2.125rem/1.15` (`tokens.css:146`) | 34px / 39.1 |
| AR | `--display-lg: 600 2rem/1.55` (`tokens.css:415`) | 32px / 49.6 |

Two things move in the wrong direction. Leading 1.55 on a 32px display heading is paragraph
leading, not heading leading — large text wants it *tighter*, and 49.6px line boxes are why
the AR page heads look airy next to their EN twins. And Arabic is set *smaller* than Latin
while Arabic glyphs read smaller at the same size, so the AR display tier should be at or
above the Latin one, not 2px below it. (The higher leading is correct for Arabic *body* text;
the AR caption tokens do the same 1.43 → 1.65 shift, which is the right instinct applied at
the wrong scale.)

### 10. A row that is a link contains buttons

`Seeders.tsx:357` and `Turns.tsx:371` put `<button>`s inside `<tr role="link">` with a click
handler and `Enter`/`Space` navigation. Visually and for a mouse this works; for assistive
technology it is a link whose name contains other interactive controls, which is not a valid
role composition and makes the row's own action ambiguous to announce. The seeders row now
carries three buttons inside that link.

### 11. A dialog opens without deciding where focus goes

Measured: after opening, `document.activeElement` is the `.modal` panel itself, not the first
field or the confirm button. Focus is *contained* (good) but not *placed*, so the first Tab
lands on the panel's own focus ring, and a screen reader announces the dialog container rather
than its question. One line in `Modal` (`panel.current?.focus()` already happens; a
`initialFocus` ref would fix it).

---

## P2 — hygiene

### 12. Three page titles end with a full stop, six do not

`حسابك.` (`ar.ts:609`), `الإدارة.` (`:680`), `الإدارة العليا.` (`:705`) versus `خوادم التوزيع`,
`ملفات التورنت`, `القرّاء`, `الحالة`, `أدوات`. The period is a deliberate voice choice
somewhere; it just never reached the other six headings. Pick one.

### 13. The group label depends on uppercase, which Arabic does not have

`.group-title` (`components.css:2130-2137`) is a 14px label whose distinctiveness comes from
`text-transform: uppercase` plus 0.04em tracking. In Arabic the transform is a no-op, so the
same element renders as ordinary 14px muted text — visible in the account screen, where
`الملف` reads as a stray line rather than a region label. Latin keeps a device Arabic loses;
Arabic needs its own (colour alone, or a rule, or slightly stronger weight).

### 14. The account screen says "profile" twice

Active tab `الملف الشخصي`, then an eyebrow `الملف`, then a panel titled `التفضيلات`. Two
labels for the same region before the first field, and the eyebrow duplicates the tab.

### 15. The 24-hour timeline has no reference

Every status card draws 24 coloured bars (one per hour over 24h, `Status.tsx:349`) with no
axis, no
legend and no time label on the card; the `24h` heading exists only in the TURN table further
down. The strip is legible as "history" and unreadable as "when". Apple's test — does the
element carry information or decoration — lands on decoration until it says what it spans.

### 16. Two notes claim the type scale is broken; it is not

`tokens.css:141-143` justifies `rem` sizes and then ends *"measured: a 24px root changed
nothing on this page"* — true of the previous `px` scale, false of this file. The previous
audit's status table (`2026-10-28-admin-design-audit.md:279`) still carries `#4 px type scale
| open`. Both should say fixed, with the measurement above, or the next reader will "fix" a
scale that already works.

### 17. The console's actions column has no header

Every other table labels its action column (`إجراءات`); the super-admin table's last `th` is
empty, so its buttons have no column name and its two rows with no actions (owner, self) read
as an empty column.

---

## What to keep

These are load-bearing and should survive any redesign:

- **Empty states name the next action.** All three list screens render the same shape — a
  panel holding one muted line: `لا خوادم توزيع بعد. أضف واحدًا لتبدأ التوزيع.` — and the line
  tells you what to do next. Measured on seeders, turns and reciters with `[]` fixtures.
- **Type now follows the browser's text size.** Root 16px → 24px produced h1 32 → 48, row
  label 17 → 25.5, button 46 → 57, body 17 → 25.5, with no horizontal overflow on seeders,
  account, status or console, and the only clipped element being the sidebar email that is
  `.truncate` on purpose. The previous audit still lists this as **open** ("#4 px type scale")
  and `tokens.css:141-143` still ends with *"measured: a 24px root changed nothing on this
  page"* — both describe the old px scale and are now wrong about the code. The scale is
  fixed; the two notes about it are stale (see P2-16).
- **Reduced motion is translated, not deleted.** With `prefers-reduced-motion: reduce` the
  dialog uses `reduced-fade-in` (0.18s, `transform: none`) instead of the scale — feedback
  preserved, vestibular trigger removed.
- **Focus is visible.** First Tab reaches the skip link with a 2px `#086288` outline; the
  focus token is applied to links, buttons and rows.
- **No horizontal overflow in RTL at 390px** on any of the eight screens (`scrollWidth ===
  innerWidth`), including the two 7-column tables.
- **One accent, and shadows used as material, not decoration.** `--shadow-premium` is a
  four-layer shadow (two insets + two casts) and it is applied to `.panel` and the account
  block — a raised card on a parchment page, in both themes. Hairlines carry the separators
  instead, so the shadow only marks elevation. Radii stay at 8/18/pill.

---

## What this means for the pending redesign

The question on the table was *"should every edit form become a modal?"*. The audit answers
it with evidence rather than taste:

1. **Yes, but the dialog must be finished first.** Moving eight forms into a dialog that does
   not lock the page scroll (P0-1) and does not place focus (P1-11) would spread two bugs
   across the console. Both are small: a scroll-lock effect in `Modal`, an `initialFocus` ref.
2. **The inline panels are not just inconsistent, they cost the page.** A form above the list
   turns the header's primary button into a Cancel toggle and pushes the list down by the
   form's height; the list is the reason the operator is on the screen.
3. **The form host is not the whole problem.** P0-3 (native selects), P1-8 (three one-click
   destructives) and P1-6/7 (row actions) are in the same blast radius, and a redesign that
   moves forms but leaves them will have unified the packaging and not the product.
4. **Dark mode needs a fix regardless.** P0-5 inverts the depth cue on every screen; it is
   a token swap, but it belongs in the same pass because it re-shoots every screen.

## Suggested order of work

1. **P0-1, P0-2, P0-4** — scroll lock + `initialFocus` in `Modal`; make the coarse-pointer
   rule win over `.btn--sm` (`components.css:224-228` vs `:245-248`); translate the three
   hardcoded console strings and the role/status chips.
2. **P0-3** — one `.select` rule (or `.field__select` everywhere) and stop passing `input` to
   a `<select>`.
3. **P1-6, P1-7, P1-8** — `.row__actions` in the three remaining tables, then one
   `ConfirmModal` for the three unconfirmed destructives.
4. **The forms migration** — `FormModal` + the eight forms, now that the dialog is trustworthy.
5. **P1-9, P0-5** — the Arabic display tier and the dark elevation token; both are one-line
   token changes with screen-wide effect, so do them together and re-shoot every screen.
6. **P2** — title punctuation, the Arabic group-label device, the account eyebrow, the
   timeline scale, the console action header.

## Implementation status — 2026-10-28

Batch A of `docs/superpowers/plans/2026-10-28-admin-console-audit-fixes.md` is applied and
re-measured on the same fixture:

| item | state | evidence |
| --- | --- | --- |
| #1 the page scrolls behind the dialog | **fixed** | 2,145px list, wheel 900px with the dialog open → `scrollY` **0** (was 900); `body` overflow `hidden`, both restored on close |
| #2 small buttons on touch | **fixed** | `.btn.btn--sm` inside the coarse block (two classes, so source order cannot win); row actions **44px** at 390 touch (was 34) |
| #3 unstyled selects | **fixed** | `.field__select` on both console filters and the account language control, `.field__select--auto` so a one-choice select does not span the panel; **49px** (was 19) |
| #4 English in the Arabic console | **fixed** | labels, options and every chip through the catalogue; the raw enum is the chip's `title`; measured chips: مشرف أعلى / المالك / نشط / مدير / مستخدم / معطّل |
| #5 dark elevation, #6–#11, #12–#17 | queued | batches B–E of the plan |

## How to re-verify

```bash
cd apps/admin/apps/web && npm run build
python3 /tmp/opencode/adminpreview/server.py &     # fixture API + dist on :8899
# then, per screen × {ar,en} × {1440,390} × {light,dark}:
#   document.scrollWidth vs innerWidth, control heights, action-column delta,
#   root font-size 16 → 24 (Dynamic Type), reduced-motion animation name
cd apps/admin/apps/web && PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH" npm test
```

Screenshots for each state used here: `.playwright-mcp/audit-<screen>-<variant>.png`
(untracked; `rm -rf .playwright-mcp` when done).
