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
  let prev = 0;

  for (const sample of samples) {
    const sounding = sample.midi != null;
    if (start == null) {
      if (sounding) {
        start = sample.t;
        end = sample.t;
        prev = sample.t;
      }
      continue;
    }
    if (!sounding || sample.t - prev > gapSec) {
      if (end - start >= minSec) out.push({ start, end });
      start = sounding ? sample.t : null;
      end = sample.t;
      prev = sample.t;
      continue;
    }
    end = sample.t;
    prev = sample.t;
  }

  if (start != null && end - start >= minSec) out.push({ start, end });
  return out;
}
