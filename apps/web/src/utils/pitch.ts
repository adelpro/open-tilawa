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
}

export interface Hold {
  start: number;
  end: number;
}

export interface JumpState {
  pending: number | null;
  count: number;
}

export const INITIAL_JUMP: JumpState = { pending: null, count: 0 };

/** Solfège, Do = C. Sharps as the symbol, not a word, so a label stays short. */
const SOLFEGE = [
  'دو',
  'دو♯',
  'ري',
  'ري♯',
  'مي',
  'فا',
  'فا♯',
  'صول',
  'صول♯',
  'لا',
  'لا♯',
  'سي',
];

/** Scientific pitch, A4 = 440 Hz. */
export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** MIDI number to `صول♯3`. */
export function midiToName(midi: number): string {
  const m = Math.round(midi);
  return `${SOLFEGE[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
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

/**
 * Runs of continuous sound: a voice present, and no gap longer than `gapSec`.
 *
 * Pitch is deliberately not read here. A madd may drift a whole tone and still
 * be one madd, and a box that splits is worse than no box: it teaches a pause
 * the reciter did not make.
 */
export function findHolds(samples: Sample[], minSec: number, gapSec = 0.08): Hold[] {
  const out: Hold[] = [];
  let start: number | null = null;
  let end = 0;
  let lastSounding = 0;

  for (const sample of samples) {
    // An unvoiced frame is not a gap by itself: clarity dips for a frame all
    // the time, and a 33 ms dip must not cut a madd in two.
    if (sample.midi == null) {
      if (start != null && sample.t - lastSounding > gapSec) {
        if (end - start >= minSec) out.push({ start, end });
        start = null;
      }
      continue;
    }
    if (start == null) {
      start = sample.t;
      end = sample.t;
      lastSounding = sample.t;
      continue;
    }
    if (sample.t - lastSounding > gapSec) {
      if (end - start >= minSec) out.push({ start, end });
      start = sample.t;
      end = sample.t;
      lastSounding = sample.t;
      continue;
    }
    end = sample.t;
    lastSounding = sample.t;
  }

  if (start != null && end - start >= minSec) out.push({ start, end });
  return out;
}
