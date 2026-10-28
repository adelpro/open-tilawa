# Admin Console Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 17 findings in `docs/superpowers/reviews/2026-10-28-admin-console-audit.md`, in the order the audit argues for, so the console behaves like one product rather than six screens that share a token file.

**Architecture:** Five batches. Each batch is independently shippable and verifiable; within a batch, the dialog and the input controls are repaired before anything is migrated into them. Nothing here invents a new visual language: every change either adds a missing rule to an existing component, or replaces a hand-rolled instance with the shared one.

**Tech Stack:** React 19 + Vite, plain CSS (`tokens.css` + `components.css`), node:test source-level suites (`apps/admin/apps/web/test`), the fixture API on :8899 for measurement.

**Spec:** `docs/superpowers/reviews/2026-10-28-admin-console-audit.md`

## Global Constraints

- Every colour, radius, shadow and space is a token from `tokens.css`; no raw hex, no new palette entry.
- Arabic and English are equal citizens: a string lives in both catalogues, a layout is checked in both directions.
- A control that exists in the design system is used, not re-styled: `.field__input`, `.field__select`, `.btn`, `.row__actions`.
- Tests are pure `node:test` source/DOM-free units; component behaviour is asserted from source (the house pattern in `test/a11y.test.mjs`).
- Re-verify with the fixture server, not by eye: `/tmp/opencode/adminpreview/server.py`, `apps/admin/apps/web/dist` on :8899.
- A destructive action confirms; the confirm button never shares its verb with the cancel button.

## Review Focus

- **Touch targets on dense rows** — the 44px floor must survive `.btn--sm`, in every table, at 390px.
- **The page behind a dialog** — must not scroll; the scrollbar's removal must not shift the layout sideways.
- **Arabic enum labels** — `super_admin`/`active` must never reach the screen; the filter options and the chips agree.
- **A select in a field** — reads as the same control height and border as an input beside it.
- **Dark elevation** — a card must be lighter than the page it sits on, in both themes.

---

## Batch A — make the dialog and the controls trustworthy (P0-1…4)

**Files:** `src/components/Modal.tsx`, `src/styles/components.css`, `src/routes/AdminConsole.tsx`, `src/routes/Account.tsx`, `src/lib/i18n/ar.ts`, `src/lib/i18n/en.ts`, `test/console-audit.test.mjs` (new).

### Task A1: the document does not scroll behind a dialog

- [ ] Add a failing assertion in `test/console-audit.test.mjs`: `Modal.tsx` sets `body.style.overflow = 'hidden'` and restores it in the effect cleanup.
- [ ] Run it, watch it fail (`npm test` → subtest fails).
- [ ] Implement in `Modal.tsx`: one mount effect that stores the scrollbar gap (`window.innerWidth - documentElement.clientWidth`), sets `body { overflow: hidden }` plus that gap as `padding-inline-end`, and restores both on cleanup.
- [ ] Measure on :8899 with a tall list: `scrollY` must stay 0 under a wheel with the dialog open.
- [ ] Commit.

### Task A2: the coarse-pointer floor reaches small buttons

- [ ] Extend the test: inside `@media (pointer: coarse)`, `.btn--sm` declares `min-height: 44px`.
- [ ] Add the rule inside the existing coarse block (`components.css:224-228`) — do not reorder the file; an order-dependent fix will regress the next time someone appends a modifier.
- [ ] Measure at 390 with touch emulation: every row action ≥ 44.
- [ ] Commit.

### Task A3: the console speaks Arabic

- [ ] Add catalogue keys (both files): `admin.all`, `admin.roleUser`, `admin.roleAdmin`, `admin.roleSuper`, `admin.statusActive`, `admin.statusDisabled`.
- [ ] Replace the four literals (`Role`, `Status`, `All` ×2) with `t()`; the chips render the label for `entry.role` / `entry.status` instead of the raw enum.
- [ ] Test: the route source contains no `>Role<`, `>Status<` or `>All<`, and both chip cells call a label helper.
- [ ] Measure: at AR 1440 the users table shows Arabic in every cell.
- [ ] Commit.

### Task A4: one select, in every field

- [ ] Point the console's two filters and the account language control at `className="field__select"`; delete nothing else.
- [ ] Test: no route passes `className="input"` to a `<select>`.
- [ ] Measure: both controls ≥ 40px tall next to the search input.
- [ ] Commit.

---

## Batch B — tokens (P0-5, P1-9)

### Task B1: dark elevation rises

- **Files:** `src/styles/tokens.css`.
- [x] Give dark `--canvas` a lighter value than `--canvas-parchment` (the page); keep light mode untouched.
- [x] Test: parse both theme blocks; in each, the card token must be lighter than the page token.
- [x] Re-shoot seeders/account in dark; card must read as raised.

### Task B2: the Arabic display tier

- **Files:** `src/styles/tokens.css`.
- [x] Arabic `--display-lg` at least the Latin size, leading ≈ 1.25 (Latin 1.15, Arabic body stays 1.6).
- [x] Test: the AR display size ≥ EN display size, and its leading < the AR body leading.

---

## Batch C — one action column, one confirm (P1-6, P1-7, P1-8)

### Task C1: `.row__actions` in the three remaining tables

- **Files:** `Turns.tsx:393`, `AdminConsole.tsx:253`, `Torrents.tsx:494`.
- [x] Swap `cluster cluster--end` for `row__actions`; keep `stopPropagation`.
- [x] Test: no table route still contains `cluster cluster--end` inside a `<td>`.
- [x] Measure: header-content edge minus first-button edge ≤ 0 for each table, and one button row in EN.

### Task C2: `ConfirmModal`, and the three actions that lack one

- **Files:** `src/components/ConfirmModal.tsx` (new), `Turns.tsx`, `Status.tsx`, `Torrents.tsx`, `Reciters.tsx`, `src/lib/i18n/*`.
- [x] Extract the five hand-rolled confirms into `ConfirmModal { title, body, confirmLabel, tone, busy, onConfirm, onClose }`.
- [x] Add confirms for TURN unlink, service remove, torrent remove.
- [x] Reuse `seeders.unlinkHint` phrasing so no confirm button repeats the cancel verb.

---

## Batch D — forms become dialogs (the original request)

### Task D1: `FormModal`

- **Files:** `src/components/FormModal.tsx` (new), `Modal.tsx` (initial-focus prop).
- [x] ~~`Modal` gains `initialFocus`~~ — done in `FormModal` instead: the form focuses its own first field one frame after mount, so a question keeps the panel's focus. One less prop, one fewer thing to get wrong at a call site.
- [x] `FormModal` = `Modal` + `<form onSubmit>` + footer (`extra` destructive slot, cancel, submit that names its verb).
- [x] Test: `FormModal` renders a `<form>`, submits on Enter, and passes `initialFocus` to its first field.

### Task D2–D4: migrate the eight forms

- Seeders add/edit, Turns add/edit, Reciters add/edit, Status add, Torrents add.
- [x] Each migration deletes its inline `<Panel>` and makes the page-head button an opener, not a toggle.
- [x] Measure per screen: the list does not move when the form opens.

### Task D5: the row stops being a link that contains buttons

- [x] `role="link"` rows in Seeders/Turns move their action buttons out of the link's name, or the row stops being a link and the name becomes the anchor.

---

## Batch E — P2 hygiene

- [ ] Page titles: one punctuation rule across all nine.
- [ ] `.group-title` gets a device that exists in Arabic (not case).
- [ ] Account: drop the `الملف` eyebrow that repeats the tab.
- [ ] Status timeline: state what the strip spans.
- [ ] Console: label the actions column.
- [ ] Correct the two stale notes about the type scale (`tokens.css:141`, old audit status table).
