/**
 * The pitch math behind the contour, with no DOM and no WebAudio, so it can be
 * unit-tested under plain node.
 *
 * Two different questions live here, and keeping them apart is the point:
 *
 * - What note is this? `acceptFrame` answers per frame, rejecting the two ways
 *   an autocorrelator lies: an octave error, and a one-frame outlier.
 * - Where is the madd? `findHolds` answers over time, and it never looks at the
 *   pitch value — only at whether a voice was present. A madd slides and
 *   carries vibrato; segmenting by pitch stability would cut one madd into
 *   three boxes.
 */

export interface Sample {
  /** The audio element's currentTime, in seconds. */
  t: number;
  /** null = no confident pitch (silence, a consonant, or a rejected frame). */
  midi: number | null;
  rms: number;
  /** Loud relative to the recitation's own peak: the strong half of the voice. */
  strong: boolean;
}

export interface Segment {
  start: number;
  end: number;
  midi: number;
}

export interface JumpState {
  pending: number | null;
  count: number;
}

export const INITIAL_JUMP: JumpState = { pending: null, count: 0 };

/** Scientific pitch, A4 = 440 Hz. */
export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** The inverse, for the axis labels. */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Latin solfège, Do = C: the labels the panel was drawn with. */
const SOLFEGE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

export function midiToName(midi: number): string {
  const m = Math.round(midi);
  return `${SOLFEGE[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/** One value out of an already-sorted array, clamped at both ends. */
export function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

/**
 * Stable stretches inside a contiguous voiced run: a note the reciter held,
 * not the whole run. A step of more than 0.6 semitone starts a new segment.
 */
export function findSegments(run: Sample[], minDur: number): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < run.length) {
    const first = run[i].midi;
    if (first == null) {
      i += 1;
      continue;
    }
    let sum = first;
    let n = 1;
    let j = i + 1;
    while (j < run.length) {
      const m = run[j].midi;
      if (m == null || Math.abs(m - sum / n) > 0.6) break;
      sum += m;
      n += 1;
      j += 1;
    }
    const start = run[i].t;
    const end = run[j - 1].t;
    if (end - start >= minDur) out.push({ start, end, midi: sum / n });
    i = Math.max(j, i + 1);
  }
  return out;
}

/** Direction changes larger than `thr` semitones: the wandering of a ghurba. */
export function countReversals(ms: number[], thr = 0.35): number {
  if (!ms.length) return 0;
  let dir = 0;
  let ext = ms[0];
  let n = 0;
  for (const m of ms) {
    if (dir === 0) {
      if (m > ext + thr) {
        dir = 1;
        ext = m;
      } else if (m < ext - thr) {
        dir = -1;
        ext = m;
      }
    } else if (dir === 1) {
      if (m > ext) ext = m;
      else if (m < ext - thr) {
        dir = -1;
        ext = m;
        n += 1;
      }
    } else if (m < ext) ext = m;
    else if (m > ext + thr) {
      dir = 1;
      ext = m;
      n += 1;
    }
  }
  return n;
}

export function median3(a: number, b: number, c: number): number {
  return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
}

/**
 * One frame of the detector, filtered.
 *
 * An octave error (the detector finding the second harmonic) is a jump of about
 * twelve semitones, and it is common on a low male voice: snap it back. Any
 * other jump larger than three semitones is either a real leap or a glitch, and
 * four agreeing frames is what tells them apart.
 */
export function acceptFrame(
  raw: number,
  last: number | null,
  state: JumpState,
): { midi: number | null; state: JumpState } {
  let value = raw;
  if (last != null) {
    const delta = value - last;
    if (Math.abs(delta) > 10.5 && Math.abs(delta) < 13.5) value -= 12 * Math.sign(delta);
    if (Math.abs(value - last) > 3) {
      const agrees = state.pending != null && Math.abs(value - state.pending) < 1;
      const count = agrees ? state.count + 1 : 1;
      if (count < 4) return { midi: null, state: { pending: value, count } };
      return { midi: value, state: { pending: null, count: 0 } };
    }
  }
  return { midi: value, state: { pending: null, count: 0 } };
}

/**
 * A discontinuity: the clock jumped, so the samples on screen belong to a
 * position that is no longer being played. Covers a seek and a new track
 * (which starts at zero) without touching the audio graph.
 */
export function shouldResetContour(lastSampleT: number | null, now: number, tolerance = 0.25): boolean {
  return lastSampleT != null && Math.abs(now - lastSampleT) > tolerance;
}
