# A theme system that is only paper and ink

**Shipped:** web 1.13.38, admin 1.34.0 (13 Nov 2026)
**Surfaces:** the player (`tilawah.cc/settings`) and the console (`console.tilawah.cc` → Account → التفضيلات)

## The problem

Tilawah had two fixed looks: a white page and a black one. That covers night
reading, and it covers nothing else. A listener who reads on a phone in a warm
room, or who wants the page to feel like a printed mushaf rather than a
streaming app, had no answer.

The risk was obvious. A "theme" usually means a palette of decorative colours,
and this app is built on the opposite idea: one colour on the page, and every
filled action is ink. Adding five accents would have turned a reading surface
into a skin. So the brief was narrow: **more papers, not more personality.**

## The decision

A theme is **a stock and the ink it is printed with**, and it is orthogonal to
the mode. Light and dark stayed exactly where they were, and `data-palette` on
`<html>` sits beside `data-theme`. An absent attribute means the original white
page, so no device needed migrating.

| Stock | Paper | Ink (the primary) | Ink contrast |
|---|---|---|---|
| White | `#ffffff` | `#111111` | 18.9:1 |
| Light ivory | `#fdfbf7` | `#111111` | 18.3:1 |
| Ivory | `#f7f2e8` | `#111111` | 16.9:1 |
| Sage | `#eef0e6` | `#1f2a22` | 12.9:1 |
| Slate | `#edf1f5` | `#16202b` | 14.5:1 |
| Clay | `#f5e9df` | `#2a1c15` | 13.8:1 |
| Rose | `#f7e9ea` | `#2b1520` | 14.5:1 |

The insight that made it cheap: **the player has no accent, so the ink is the
primary.** The play button, the selected chip and every filled action read
`--ink`, so tinting the ink gives a stock a voice without inventing a second
colour. Sage prints green-black, slate blue-black, clay umber, rose plum.

The console already had an accent, so the same idea maps onto it directly: the
paper paints the surfaces, and the accent follows the stock — the house blue on
the three neutrals, the stock's own hue on the four coloured ones. Status
colours and the shadow system never move; a warning is the same amber on any
paper.

## The rules that kept it minimal

1. **A paper moves surfaces and ink. Nothing else.** Not `--danger`, not the
   layout, not the type scale, not a status colour.
2. **Never red.** The refusal colour is `#b3261e` on every stock, so an ink that
   leaned red — the first rose candidate did — would have made the play button
   and "this failed" the same family. The rose ink is aubergine for exactly this
   reason.
3. **Measured, not chosen by eye.** Every ink clears 12:1 on its own paper, the
   muted 4.5:1, the spectrum 7:1. The numbers live in a test, not in a comment.
4. **The two ivories stay as a controlled comparison.** Same ink, same spectrum
   as white, so the paper is the only variable. If one of them turns out to be
   invisible next to white, it is the one to cut.

## The control

Both pickers are hand-built listboxes, because a native `<select>` cannot do the
job: the spec only lets an `<option>` render text, and the swatch is the one
thing that says "this is a paper". The trigger shows the current stock as paper
over ink; the list paints all seven and marks the chosen one.

Keyboard is not an afterthought: arrows walk without wrapping, Home/End jump,
Enter/Space choose, Escape closes and returns focus to the trigger. The walk is
a pure function with its own test, so the DOM behaviour and the logic are
verified separately.

## What it costs

Seven stocks × two modes is fourteen looks per app, and every future token
change is fourteen contrast checks. That is the honest price of a catalogue. The
cap was five; it is seven by the founder's call, and the guard moved from a
count to a uniqueness-and-legibility test — a count was never the design
decision.

## Proof

- 314 tests green (5 for the keyboard walk, 7 for the palette contract: full
  token set in both modes, no status recolouring, cascade order, contrast bars,
  swatch/CSS drift, list integrity).
- Docker builds green for both apps (tsc, prerender, ESLint for the console).
- On prod: the bundle reports 1.13.38, the console `/health` reports 1.34.0 at
  the release sha, `[data-palette=rose]` is in both stylesheets, and the console
  applies its paper before paint through `theme-boot.js` — a file rather than an
  inline script, because the console's CSP is `script-src 'self'`.
- The console's Account screen needs a real login, so the picker was verified on
  a throwaway harness build. It is the one surface a machine could not prove.
