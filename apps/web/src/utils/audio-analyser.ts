/**
 * One AudioContext for the page, created on the first play (a gesture) and never
 * torn down.
 *
 * Two ways to reach the samples, and the difference matters:
 *
 * - `captureStream()` taps what the element is already playing. It works for a
 *   cross-origin file (the Itqan-hosted reciters) and does not touch the output,
 *   so nothing can go silent.
 * - `createMediaElementSource()` is the fallback where captureStream is missing
 *   (Safari). It *takes over* the element's output, so it must be connected to
 *   the destination — and it outputs silence for a cross-origin source the
 *   browser will not share, which is why it is only used same-origin.
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

    // 1. Tap the element output. Works cross-origin, leaves playback untouched.
    const capture = (audio as HTMLAudioElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    });
    const stream = capture.captureStream?.() ?? capture.mozCaptureStream?.();
    if (stream && stream.getAudioTracks().length > 0) {
      source = ctx.createMediaStreamSource(stream);
    } else if (isSameOrigin(audio) && !elementSource) {
      // 2. Same-origin only: this replaces the element's output, so it must be
      //    connected to the destination to stay audible.
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
