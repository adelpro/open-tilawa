/**
 * Queue ordering. Pure functions only, so `node --test` can cover them without
 * a DOM (see design doc §11).
 */

/** Fisher–Yates. `rng` is injectable so the test can be deterministic. */
export function permute(length: number, rng: () => number = Math.random): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** The order to walk: identity when shuffle is off, the stored permutation when on. */
export function playOrder(length: number, shuffle: boolean, order: number[]): number[] {
  if (!shuffle) return Array.from({ length }, (_, i) => i);
  if (order.length === length) return order;
  return permute(length);
}

/** Wrap-around next. Never returns -1 for a non-empty list. */
export function nextIndex(current: number, order: number[]): number {
  if (order.length === 0) return 0;
  const at = order.indexOf(current);
  if (at === -1) return order[0];
  return order[(at + 1) % order.length];
}

/** Wrap-around previous. */
export function previousIndex(current: number, order: number[]): number {
  if (order.length === 0) return 0;
  const at = order.indexOf(current);
  if (at === -1) return order[order.length - 1];
  return order[(at - 1 + order.length) % order.length];
}

/**
 * The two halves of the queue, from the listener's point of view.
 * `previous` is newest-first so the row you just left sits at the top.
 */
export function splitQueue(order: number[], current: number): {
  upcoming: number[];
  previous: number[];
} {
  const at = order.indexOf(current);
  if (at === -1) return { upcoming: order, previous: [] };
  return {
    upcoming: order.slice(at + 1),
    previous: order.slice(0, at).reverse(),
  };
}
