export const RATES = [0.75, 1, 1.25, 1.5, 2] as const;

export const DEFAULT_RATE = 1;

/** One step forward through the ladder, wrapping at the top. */
export function nextRate(current: number): number {
  if (!Number.isFinite(current)) return DEFAULT_RATE;
  const at = RATES.indexOf(nearerRate(current) as (typeof RATES)[number]);
  return RATES[(at + 1) % RATES.length];
}

/**
 * Snap an arbitrary stored value onto the ladder. A value written by an older
 * build (or a fraction from a media key) must not put the player in a state the
 * button cannot step out of.
 */
export function nearerRate(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_RATE;
  let best = RATES[0] as number;
  for (const rate of RATES) {
    if (Math.abs(rate - value) < Math.abs(best - value)) best = rate;
  }
  return best;
}

/** `1x`, `1.5x` — no trailing zeros, because the label is 3 characters wide. */
export function formatRate(rate: number): string {
  return `${Number(nearerRate(rate).toFixed(2))}x`;
}
