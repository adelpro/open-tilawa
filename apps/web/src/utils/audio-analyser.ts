/**
 * One AudioContext for the page, created on the first play (a gesture) and never
 * torn down.
 *
 * One way, and it is same-origin only. Both alternatives were measured:
 *
 * - `captureStream()` throws `SecurityError: Cannot capture from element with
 *   cross-origin data` for a file served from another host without CORS.
 * - `createMediaElementSource()` accepts it, but then outputs zeroes — the
 *   browser will not hand out samples it cannot share, and the graph takes the
 *   element's output, so the reciter would play silent.
 *
 * So a spectrum is only possible when the audio comes through our own origin —
 * which it now does: the service-worker stream, and the `/media` web seed that
 * feeds it. Cross-origin hosts would play with a flat shelf, which is honest:
 * there is no data to draw.
 *
 * Everything is wrapped: a refused or suspended context must leave the player
 * audible and the visualiser flat, not break the stream.
 */
type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
/**
 * The pitch contour needs a longer window than the spectrum: 1024 samples is
 * ~23 ms at 48 kHz, too short to see a male fundamental (~85-180 Hz). Both
 * nodes tap the same source, so the ribbon's frequency mapping is untouched.
 */
let pitchAnalyser: AnalyserNode | null = null;
let pitchSource: { analyser: AnalyserNode; element: HTMLAudioElement } | null = null;
let elementSource: MediaElementAudioSourceNode | null = null;
let outputGain: GainNode | null = null;
let desiredGain = 1;

/**
 * iOS Safari (and WKWebView) implements `HTMLMediaElement.volume` as read-only:
 * the assignment is ignored and the element always plays at 1. A probe is the
 * only honest test; on every other platform we leave the element's own volume
 * alone and keep the graph at unity so the two do not multiply.
 */
export function canSetElementVolume(): boolean {
  try {
    const probe = document.createElement('audio');
    probe.volume = 0.5;
    return Math.abs(probe.volume - 0.5) < 0.01;
  } catch {
    return true;
  }
}

/** The output gain of the same-origin graph, used where `volume` is read-only. */
export function setOutputGain(value: number): void {
  desiredGain = Math.min(1, Math.max(0, value));
  if (outputGain) outputGain.gain.value = desiredGain;
}

function isSameOrigin(audio: HTMLAudioElement): boolean {
  const src = audio.currentSrc || audio.src;
  if (!src) return false;
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function ensureContext(): AudioContext | null {
  if (context) return context;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

export function ensureAnalyser(audio: HTMLAudioElement): AnalyserNode | null {
  if (analyser) {
    void context?.resume?.();
    return analyser;
  }

  try {
    const ctx = ensureContext();
    if (!ctx) return null;

    const node = ctx.createAnalyser();
    node.fftSize = 1024;
    node.smoothingTimeConstant = 0.75;

    let source: AudioNode | null = null;

    // Same-origin only. This replaces the element's output, so it must stay
    // connected to the destination to remain audible.
    if (isSameOrigin(audio) && !elementSource) {
      elementSource = ctx.createMediaElementSource(audio);
      // The analyser taps the full signal; the gain is what the listener hears.
      // Keeping them separate means a quiet gauge does not flatten the spectrum.
      outputGain = ctx.createGain();
      outputGain.gain.value = desiredGain;
      elementSource.connect(outputGain);
      outputGain.connect(ctx.destination);

      // A tap, not a second output: connecting this to the destination would
      // double the signal. 2048 samples is ~43 ms — long enough for a low
      // fundamental, and the node costs one more pass over the same buffer.
      pitchAnalyser = ctx.createAnalyser();
      pitchAnalyser.fftSize = 2048;
      elementSource.connect(pitchAnalyser);
      pitchSource = { analyser: pitchAnalyser, element: audio };

      source = elementSource;
      (window as unknown as { __outputGain?: GainNode }).__outputGain = outputGain;
    }

    if (!source) return null;

    source.connect(node);
    analyser = node;
    void ctx.resume?.();
    (window as unknown as { __analyser?: AnalyserNode }).__analyser = node;
    return node;
  } catch (error) {
    console.warn('analyser unavailable', error);
    return null;
  }
}

export function getAnalyser(): AnalyserNode | null {
  return analyser;
}

/**
 * The pitch tap and the element it belongs to, or null when the graph could not
 * be built (a cross-origin source, a refused context). The element is part of
 * the answer because the contour's x axis is `currentTime`.
 */
export function getPitchSource(): { analyser: AnalyserNode; element: HTMLAudioElement } | null {
  return pitchSource;
}
