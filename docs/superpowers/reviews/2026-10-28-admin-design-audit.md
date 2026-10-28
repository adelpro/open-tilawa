# Tilawa Admin — UI/UX audit through Apple's design principles

Date: 2026-10-28
Scope: `apps/admin/apps/web` — landing, sign-in, about/legal, mobile drawer, both themes,
en/ar. Built from source (`vite build` + `prerender.mjs`), measured at 1280×900 and 390×844.
Lens: `apple-design` — response, direct manipulation, spatial consistency, materials,
typography, reduced motion — plus WCAG 2.2 AA where the effect is measurable.

The dashboard itself (`/dashboard/*` behind auth) could not be reached without credentials;
findings there are read from source and CSS, and are marked *(source)*.

---

## Verdict

This is a **better-governed codebase than the public web app**, and the difference shows in
the measurements: an axe run on the landing page returns **zero** violations, reduced motion
is translated (five targeted `prefers-reduced-motion` blocks, not a `*` kill switch), and
`@media (pointer: coarse)` is used to grow controls on touch without changing how they look
on a mouse. The token file documents contrast per colour rather than hoping.

What is missing is **finish on the edges**: the header broke because one class never got a
desktop rule, the drawer is a full-screen layer that is not a dialog, and every size in the
product is a `px` literal, so a user who raises their browser font size gets nothing.

---

## P0 — breakage

### 1. The landing header overflowed its own bar  (fixed in this pass)

Measured at 1280px:

| | value |
| --- | --- |
| `.landing__nav` | 56px tall |
| `.landing__nav-right` | **116px** tall, top `-30`, bottom `86` |
| `.landing__nav-right-extra` | `display: block`, 116px tall |

Three controls — theme toggle (36), sign-in (40), CTA (40) — were stacking vertically inside
a 56px bar and hanging 30px above and below it, the CTA sitting over the hero.

Two causes, both in `components.css`:

- `.landing__nav-right-extra` only ever appears as `display: none` **inside**
  `@media (max-width: 1024px)`. There was no base rule, so on desktop it was a block.
- `.landing__lang` carried `align-self: start` — a **grid** placement written for the phone
  layout — which in the desktop flex row pins the switch to the top of the line instead of
  its centre. It also inherited the account block's `margin-bottom: 12px` and `padding: 0 12px`.

Fixed by giving the wrapper a row rule and resetting the switch in the nav. The bar now
measures one 40px line centred at 28, and the CTA lives inside the 56px header.

### 2. The mobile drawer was not a modal  (fixed in this pass)

`.landing__nav-center--open` is a `position: fixed; height: 100dvh` layer. It was a plain
`<div>`, so:

- **no Escape key** — `Landing.tsx` had no `keydown` listener at all (only `menuOpen` state);
- **no scroll lock** — the page underneath scrolled behind the open drawer;
- **no focus trap and no `aria-modal`** — Tab walked out of the drawer into the page behind it,
  and a screen reader still read that page;
- closing it returned focus to the page, not to the button that opened it.

It now carries `role="dialog" aria-modal="true"` while open, locks the body, moves focus to the
first item, cycles Tab inside the layer, closes on Escape, and returns focus to the toggle. A
`matchMedia('(min-width: 1025px)')` listener closes it if the viewport crosses the breakpoint,
so a tablet rotation cannot leave the body locked behind a drawer CSS has already hidden.

Verified at 390×844: focus lands on "About", 14 Tab presses never leave the layer, Escape
closes and the toggle is focused again, `body.style.overflow` returns to empty.

### 3. The auth and legal pages had no landmarks  (fixed in this pass)

axe (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice), run against the built app:

| page | before | after |
| --- | --- | --- |
| landing | none | none |
| about | `landmark-one-main`, `region` (1 node) | **none** |
| privacy | — | **none** |
| sign-in | `landmark-one-main`, `region` (6 nodes) | **none** |

Measured directly, `/dashboard/signin` had 0 `<main>`, 0 `<nav>`, 0 `<header>`. The nine auth
screens each rendered `<div className="auth">` and the legal page rendered
`<article className="legal__article">`; both are now `<main>`, which is why one class change
per route fixed all of them without touching layout (the styles are class-based).

---

## P1 — feel and reach

### 4. Every size is a `px` literal, so text cannot grow

The token file defines the scale in pixels (`--body: 400 17px/1.47`, `--caption: 400 14px/1.43`,
`--fine-print: 400 13px/1.45`, …). Measured consequence: setting the root font size to `24px`
leaves the page at its original size — nothing on the screen moves.

A user who sets *Settings → Appearance → Font size* in the browser, or who uses the OS text
size on a tablet, gets the design at exactly the size the designer picked. The scale itself is
sound — nine sizes, disciplined steps — it just needs to be expressed in `rem`
(13→0.8125, 14→0.875, 17→1.0625, 21→1.3125, 28→1.75, 34→2.125, 36→2.25, 64→4) so the
browser can apply the preference it was given.

### 5. The auth card has no edge in either theme

`.auth__card` is `background: var(--canvas)`, `border-radius: 18px`, and **no border and no
box-shadow**. Contrast between card and page:

| theme | card | page | ratio |
| --- | --- | --- | --- |
| light | `#ffffff` | `#f5f5f7` | **1.09:1** |
| dark | `#000000` | `#1c1c1e` | **1.23:1** |

Two separate problems. In light, 1.09:1 is below the threshold where an edge reads as an
edge — the card is a rounding. In dark it is worse in kind, not degree: the card is *darker*
than the page, so it reads as a recess rather than a raised surface, which is the opposite of
what elevation means everywhere else in the product.

The fix the token system already supports: one hairline (`border: 1px solid var(--hairline)`)
in light, and in dark lift the surface one step (`#1c1c1e` card on `#000` page) instead of
sinking it.

### 6. `--ink-secondary` is documented against the wrong background

`tokens.css` says `--ink-secondary: #6e6e73; /* 5.07:1, AA */`. That is measured against
white. The app's body is `--canvas-parchment` (`#f5f5f7`), where it measures **4.66:1** — still
AA for body text, but with 0.16 of headroom instead of 0.57, and any future tint of the page
will push it under. The number in the comment should be the number on the surface it is used on.

### 7. Controls under 44px that `pointer: coarse` does not cover

| element | size | file |
| --- | --- | --- |
| locale switch trigger | 58×**32** | `LocaleSwitch` (`.locale-switch__trigger`) |
| theme toggle | **36×36** | `ThemeToggle` |
| password reveal | **34×34** | `PasswordInput.tsx:65` |
| footer links (6) | ×**35** | `.landing__footer` |

`.btn` and `.locale-switch__option` already grow under `@media (pointer: coarse)` — the
mechanism exists and works; these four simply are not in it.

### 8. The service worker does **not** ship stale builds in production

*(Correction — this was originally reported as a deploy bug and it was not one.)*

During the work I rebuilt the admin web app and a plain reload kept loading the previous
build's stylesheet from a service worker, which made a CSS fix invisible. That reproduced
only under `python3 -m http.server`: with no `Cache-Control` on `index.html`, the browser
applies heuristic freshness, and the worker's navigation `fetch()` — which is otherwise
correctly network-first — was answered from the HTTP cache.

Production is not affected. `apps/admin/apps/web/templates/default.conf.template` sets
`expires -1` on `/index.html`, `/` and every SPA route, so the worker's `fetch()` revalidates
on every navigation and a deploy reaches the client on the next load. The worker itself is
`network-first` for navigations and cache-first only for hashed assets, which is the right
split.

One real (minor) consequence remains: the install-time precache of `/` and `/index.html` is
never refreshed, so the *offline* fallback can reference assets from the build that installed
the worker. Harmless online, stale offline after several releases.

**Verification note:** because of the localhost behaviour above, every audit pass after a
rebuild must use a fresh origin (a new port) or clear the worker registration and caches, or
the browser will happily show the previous build.

---

## P2 — hygiene

### 8b. `.fine-print` faded the link inside it below AA  (fixed in this pass)

Found while re-scanning in *light* mode, which is why the first pass missed it (that run
happened to be dark, where the ratio passes):

```
<a class="link" href="/dashboard/signup">Create one</a>
→ #3e85a2 on #ffffff, 13px normal = 4.13:1  (AA needs 4.5)
```

`tokens.css` said `.fine-print { color: var(--ink); opacity: 0.78 }`. Opacity is inherited by
children, so the 78% that was meant to soften the sentence also softened the link — `#086288`
at 78% over white is `#3e85a2`. It is now a token colour (`--ink-secondary`) instead of an
opacity, so the sentence still reads as secondary and the link keeps its own contrast. Both
themes re-scan clean.

### 8c. The locale switch failed WCAG 2.5.3  (fixed; axe still reports it, and axe is wrong)

The trigger's accessible name was `"Language"` while its visible text is `"EN"` — label in
name requires the visible text to appear in the name. It now announces `"English (EN)"`.

axe's `label-content-name-mismatch` still flags it, **including on a synthetic control**:

```js
const probe = document.createElement('button');
probe.setAttribute('aria-label', 'English (EN)');
probe.textContent = 'EN';          // → still reported
```

So the rule is failing on a two-letter all-caps label rather than on this element. Worth
knowing before someone "fixes" it by deleting the accessible name to silence the report.

### 9. `src/styles/theme.css` is dead, and ships a second palette

It is imported by nothing (`main.tsx` imports `tokens.css` and `components.css` only), yet it
declares `--color-primary: #0a63c2`, `--color-secondary: #f9c741`, `--color-error: #b00` and a
competing `.btn` (`border-radius: 4px`, `padding: 8px 16px`, `font-size: 16px`). `components.css`
redefines `.btn` as a pill on tokens, so today the old one loses — but it is a loaded gun for
the next person who imports the file to get `.btn--sm`, and it contradicts the rule at the top
of `tokens.css`: *"No component may invent a colour."*  Delete it.

### 10. `PasswordField` never passed `name`  (fixed in this pass)

`fields.tsx` opens with a promise: *"Every field … carries the attributes the browser, the
password manager and the screen reader need: `type`, `inputMode`, `autoComplete`, `name`,
`spellCheck`. A screen that composes from the kit cannot forget one of them."* The password
control rendered `name=""` — `PasswordField` did not pass `name` to `PasswordInput` at all.
`EmailField` did. `PasswordInput` now defaults `name="password"`, which is what the promise
said all along.

### 11. Links did not get the token focus ring  (fixed in this pass)

`button:focus-visible` and `.btn:focus-visible` drew `2px solid var(--primary)` with a 2px
offset; `.field__input:focus-visible` drew the same. Links fell back to the UA outline, so two
different focus treatments coexisted on one screen. `a:focus-visible` is now in the same
group.

---

## What to keep

- **Tokens with measured contrast**, per colour, in the file where they are defined.
- **Three durations, three jobs, one curve** (`--motion-press 100ms`, `--motion-ui 160ms`,
  `--motion-enter 180ms cubic-bezier(.2,.8,.2,1)`). Nothing looks imported from another app.
- **`@media (pointer: coarse)` growth** — the right pattern, just not applied everywhere yet.
- **Reduced motion translated, not killed** — animations are removed where they are decoration
  and kept where they are feedback.
- **`Notice` = `role="alert"` for failure, `role="status"` for confirmation.** The comment
  records why: *"'Saved.' was silent before this line existed."*
- **`Button` keeps its label while busy** and swaps only the icon, so the control never resizes
  under the cursor. `aria-busy` is set; a second click is impossible.
- **Self-hosted fonts with `font-display: swap`**, Arabic-first stack (`--font-arabic`), so
  Arabic never falls back to a serif that merely happens to exist.
- **Logical properties throughout** (`inset-inline-start`, `border-inline-end`): the RTL
  landing page mirrors cleanly — measured `dir=rtl`, `overflowX 0`, brand at the reading edge,
  CTA and controls at the other, icons on the correct side of their labels.
- **axe-clean landing page.**

---

## Suggested order of work

1. Header overflow — **done** (#1).
2. Make the drawer a dialog — **done** (#2).
3. Wrap the auth and legal screens in `<main>` — **done** (#3).
4. `.fine-print` opacity — **done** (#8b); locale switch label — **done** (#8c).
5. Card edge: hairline in light, lift instead of sink in dark (#5).
6. Type scale to `rem` (#4) — the largest reach fix, mechanical to do.
7. Tap targets under `pointer: coarse` (#7); delete `theme.css` (#9).

## Implementation status — 2026-10-28

| item | state |
| --- | --- |
| #1 header overflow | fixed, verified at 1280 (one 40px line, mid 28) |
| #2 drawer as a dialog | fixed, verified at 390 (trap, Escape, scroll lock, focus return) |
| #3 landmarks | fixed, axe clean on about / privacy / sign-in in both themes |
| #8b fine-print opacity | fixed, axe clean (was 4.13:1) |
| #8c locale label | fixed; axe still reports — proven false positive |
| #10 password `name` | fixed |
| #11 link focus ring | fixed |
| #4 px type scale | open |
| #5 card edge | open |
| #7 tap targets | open |
| #9 dead `theme.css` | open |

No axe violations remain on landing, about, privacy or sign-in other than the #8c false
positive, in light or dark. The dashboard behind auth is still unmeasured — no credentials.

## How to re-verify

- Header: every child of `.landing__nav` should share one mid-line, and nothing may have
  `top < 0` or `bottom > 56` at 1280px.
- Drawer: Tab to the end of the drawer and confirm focus does not reach the page behind;
  Escape closes; the body does not scroll while it is open.
- Landmarks: `document.querySelectorAll('main, nav, header').length` on each route.
- Type: set `document.documentElement.style.fontSize = '24px'` and confirm the body text
  actually grew.
- Depth: `getComputedStyle(card).backgroundColor` against the page, and confirm the ratio
  direction matches the theme (raised, not recessed).
- **After every rebuild, scan a fresh origin** (a different port) or unregister the service
  worker and delete its caches — otherwise the browser serves the previous build and the
  measurements are of code that no longer exists.
