/**
 * One AudioContext for the page, created on the first play (a gesture) and never
 * torn down.
 *
 * One way, and it is same-origin only. Both alternatives were measured:
 *
 * - `captureStream()` throws `SecurityError: Cannot capture from element with
 *   cross-origin data` for a host-served file (the Itqan reciters).
 * - `createMediaElementSource()` accepts it, but then outputs zeroes — the
 *   browser will not hand out samples it cannot share, and the graph takes the
 *   element's output, so the reciter would play silent.
 *
 * So a spectrum for a cross-origin reciter is only possible if the audio comes
 * through our own origin (an nginx proxy). Until then those reciters play with a
 * flat shelf, which is honest: there is no data to draw.
 *
 * Everything is wrapped: a refused or suspended context must leave the player
 * audible and the visualiser flat, not break the stream.
 */
type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let elementSource: MediaElementAudioSourceNode | null = null;

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
      elementSource.connect(ctx.destination);
      source = elementSource;
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
