/**
 * The spectrum has three shapes. All of them read the same analyser and draw in
 * the same blue; only the geometry differs, so switching costs no download and
 * no new dependency.
 */
export const VISUALISERS = ['bars', 'peaks', 'ribbon'] as const;

export type Visualiser = (typeof VISUALISERS)[number];

export const VISUALISER_LABELS: Record<Visualiser, string> = {
  bars: 'أعمدة',
  peaks: 'قِمم',
  ribbon: 'موجات',
};

/** Unknown values — including the retired dots and waterfall — fall back to waves. */
export function normaliseVisualiser(value: unknown): Visualiser {
  return VISUALISERS.includes(value as Visualiser) ? (value as Visualiser) : 'ribbon';
}

/** Squash `bins` into `columns` buckets by peak, used by the bars. */
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

/**
 * Peak magnitude (0..1) of a byte time-domain buffer, either polarity. Over a
 * 1024-sample read (21 ms at 48 kHz) it covers at least two periods of any
 * voice above ~100 Hz, so it follows loudness and not the phase the snapshot
 * happened to land on. Smoothing the signed samples instead aliased against the
 * read rate and made the height follow the reciter's pitch.
 */
export function peakMagnitude(time: Uint8Array): number {
  let peak = 0;
  for (let i = 0; i < time.length; i += 1) {
    const magnitude = Math.abs(time[i] - 128);
    if (magnitude > peak) peak = magnitude;
  }
  return peak / 128;
}

/**
 * Automatic gain for the wave. A time-domain peak of a voice sits around
 * 0.05–0.2 of full scale, so a fixed gain either draws a ripple on the floor or
 * clips the loud reciters. The gain lifts a quiet recording toward the block,
 * never attenuates a loud one, and stays at 1 for true silence so a pause is not
 * amplified into noise.
 */
const AUTO_TARGET = 0.9;
const AUTO_FLOOR = 0.08;
const AUTO_MAX = 3;
const AUTO_SILENCE = 0.02;

export function autoGain(envelope: number): number {
  if (!Number.isFinite(envelope) || envelope < AUTO_SILENCE) return 1;
  return Math.max(1, Math.min(AUTO_MAX, AUTO_TARGET / Math.max(envelope, AUTO_FLOOR)));
}

/** `#abc` and `#aabbcc` both, because the tokens are hand-edited. */
function parseHex(value: string): [number, number, number] {
  const raw = value.trim().replace(/^#/, '');
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return [0, 0, 0];
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * One step along the line from `from` to `to`. The spectrum's layers need four
 * blues that differ in *colour*, not only in alpha: at alpha 0.2 the fourth
 * trace was a ghost when it was ink, and a ghost tint is no tint at all.
 */
export function mixHex(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const clamped = Math.min(1, Math.max(0, t));
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * clamped)
    .toString(16)
    .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** Front to back: the four tints the ribbon's layers are filled with. */
export function waveTints(front: string, back: string): string[] {
  return [0, 1 / 3, 2 / 3, 1].map((t) => mixHex(front, back, t));
}
