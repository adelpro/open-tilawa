/**
 * The spectrum has five shapes. All of them read the same analyser and draw in
 * one colour; only the geometry differs, so switching costs no download and no
 * new dependency.
 */
export const VISUALISERS = ['bars', 'peaks', 'ribbon', 'dots', 'waterfall'] as const;

export type Visualiser = (typeof VISUALISERS)[number];

export const VISUALISER_LABELS: Record<Visualiser, string> = {
  bars: 'أعمدة',
  peaks: 'قِمم',
  ribbon: 'شريط',
  dots: 'نقاط',
  waterfall: 'شلّال',
};

/** Unknown values (an older stored choice) fall back rather than blank the block. */
export function normaliseVisualiser(value: unknown): Visualiser {
  return VISUALISERS.includes(value as Visualiser) ? (value as Visualiser) : 'bars';
}

/** Squash `bins` into `columns` buckets by peak, used by the waterfall. */
export function downsample(bins: Uint8Array, columns: number): number[] {
  const usable = Math.floor(bins.length * 0.6);
  const out: number[] = [];
  for (let i = 0; i < columns; i += 1) {
    const start = Math.floor(((i / columns) ** 1.4) * usable);
    const end = Math.max(start + 1, Math.floor((((i + 1) / columns) ** 1.4) * usable));
    let peak = 0;
    for (let j = start; j < end && j < bins.length; j += 1) peak = Math.max(peak, bins[j]);
    out.push(peak / 255);
  }
  return out;
}
