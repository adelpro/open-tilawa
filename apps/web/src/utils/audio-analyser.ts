/**
 * One AudioContext for the page, created on the first play (a gesture) and
 * never torn down: `createMediaElementSource` may only be called once per
 * element, and a source that is not connected silences playback.
 *
 * Everything is wrapped: a refused or suspended context must leave the player
 * audible and the visualiser flat, not break the stream.
 */
type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let wired = false;

/**
 * A cross-origin media element routed through Web Audio outputs silence (the
 * browser will not hand us samples it cannot share), and the element's own
 * output is taken over by the graph — so a reciter served by a host without
 * CORS headers would go quiet. Only same-origin streams (our service-worker
 * torrent stream) are safe to analyse.
 */
function isSameOrigin(audio: HTMLAudioElement): boolean {
  const src = audio.currentSrc || audio.src;
  if (!src) return false;
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function ensureAnalyser(audio: HTMLAudioElement): AnalyserNode | null {
  if (!isSameOrigin(audio)) return null;

  try {
    if (analyser) {
      void context?.resume?.();
      return analyser;
    }

    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return null;

    context = new Ctor();
    if (wired) return null;

    const source = context.createMediaElementSource(audio);
    analyser = context.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    analyser.connect(context.destination);
    wired = true;
    void context.resume?.();
    // debugging hook: lets a browser check whether the graph exists
    (window as unknown as { __analyser?: AnalyserNode }).__analyser = analyser;
    return analyser;
  } catch (error) {
    console.warn('analyser unavailable', error);
    return null;
  }
}

export function getAnalyser(): AnalyserNode | null {
  return analyser;
}
