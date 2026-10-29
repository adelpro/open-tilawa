# One tap, two counters

![One tap, two counters](08-favourites-and-views.png)

## The heart

1. **The list on this device is the source of truth.** localStorage, written
   immediately on every tap, so favourites work signed out and survive a reload.
2. **If you are signed in**, the same tap writes `favorites/<id>` into your graph.
   That is a sync layer, not a second list: signing in merges, it never replaces.
3. **The public counter moves only on a real transition** — favouriting, not
   re-favouriting. A per-identity set in localStorage remembers what this person
   already counted, so two linked devices bump `favorite-counts` once, not twice.

## The view

Opening a reciter bumps `view-counts` **once per tab session**, gatekept by
`sessionStorage`. The sheet rows never count — the hook is mounted next to the
player, so scrolling a list is free.

## Why the counter is a read-modify-write

Each bump reads `count`, adds one and writes it back, and bumps for the same id
are chained through a promise. Without the chain, two quick taps tie on Gun's
millisecond clock: the relay keeps the newer value while the tab keeps the older
one until a reload. The chain removes the tie, and the value we actually wrote is
published to the UI without waiting for an echo.

The code: `apps/web/src/hooks/use-favorites.ts`, `apps/web/src/gun/counts.ts`.
