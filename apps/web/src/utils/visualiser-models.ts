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
 * One step of a rise-fast, fall-slow follower. Both shapes use it — the bars on
 * each column, the ribbon on each band of each layer — so a syllable lifts a
 * band at once and the silence after it sinks slowly instead of snapping back.
 */
export function follow(current: number, target: number, attack: number, release: number): number {
  return current + (target - current) * (target > current ? attack : release);
}

/** The band a recitation lives in. Below 70 Hz is rumble; above 16 kHz is air. */
const LOG_MIN_HZ = 90;
const LOG_MAX_HZ = 16000;

/**
 * Peak level of each log-spaced band, bass first.
 *
 * The bars' buckets are nearly linear in frequency, and over 28 columns that is
 * fine. The ribbon is one continuous silhouette, and on a linear axis the top
 * octave takes as much of the width as the four below it — where a recitation
 * has nothing, so the strip ended in a long flat tail that read as a wave which
 * stopped short of the edge. A log axis spends the width the way the ear does:
 * two thirds of the silhouette on the band that carries the voice, and only the
 * last few columns fading out.
 */
export function logBands(
  bins: Uint8Array,
  columns: number,
  sampleRate: number,
  minHz = LOG_MIN_HZ,
  maxHz = LOG_MAX_HZ,
): number[] {
  const binHz = sampleRate / 2 / bins.length;
  const octaves = maxHz / minHz;
  const out: number[] = [];
  for (let i = 0; i < columns; i += 1) {
    const low = (minHz * Math.pow(octaves, i / columns)) / binHz;
    const high = (minHz * Math.pow(octaves, (i + 1) / columns)) / binHz;
    // Bin 0 is DC. It carries no audio, and reading it leaves a notch in the
    // first column — a gap at the very edge of the strip.
    const start = Math.max(1, Math.floor(low));
    const end = Math.min(bins.length, Math.max(start + 1, Math.ceil(high)));
    let peak = 0;
    for (let j = start; j < end; j += 1) if (bins[j] > peak) peak = bins[j];
    out.push(peak / 255);
  }
  return out;
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
