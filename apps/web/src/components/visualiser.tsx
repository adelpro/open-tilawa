import { useEffect, useRef } from 'react';

import { getAnalyser } from '@/utils/audio-analyser';
import {
  autoGain,
  downsample,
  peakMagnitude,
  waveTints,
  type Visualiser as Model,
} from '@/utils/visualiser-models';

const BARS = 28;
const GAP = 3;
/** History points across the width: each one is a pushed envelope value. */
const WAVE_POINTS = 240;
/**
 * How fast the ribbon scrolls. 1 pushes one new point every 60 ms, so a syllable
 * crosses the whole strip in about 14 s. 0.5 is twice as slow, 2 twice as fast.
 * It changes the speed only: the shape of each layer does not depend on it.
 */
const TEMPO = 1;
const PUSH_MS = 60 / TEMPO;
/**
 * Four waves, front to back. The strip is a history, newest at the right edge,
 * scrolling left. Each layer is the same loudness envelope with its own
 * smoothing, so the front one traces the syllables and the back one is a haze.
 * `rise` and `fall` are the fraction of the gap closed per pushed point: a layer
 * lifts quickly on a syllable and sinks slowly in the silence after it.
 */
const WAVES = [
  { gain: 1, rise: 0.7, fall: 0.35 },
  { gain: 0.8, rise: 0.45, fall: 0.2 },
  { gain: 0.62, rise: 0.28, fall: 0.12 },
  { gain: 0.46, rise: 0.18, fall: 0.07 },
];
/**
 * How opaque each filled layer is, front to back. Alpha is not the only depth
 * cue — the tint does that — but four layers at a flat 0.6 turn the ribbon into
 * one slab, so the ladder stays wide: the front wash is solid enough to read as
 * the near silhouette, the back one is a haze.
 */
const WAVE_ALPHA = [0.72, 0.55, 0.42, 0.3];
/**
 * The analyser is read every other frame, not every frame: 30 Hz is plenty for
 * a loudness envelope, and no one can hear the difference.
 */
const DATA_EVERY = 2;
/**
 * The envelope and the gain it produces are both low-passed. Snapping the gain
 * to each frame's peak made the whole strip flicker on every transient: the
 * attack alone is a quarter of the way per read, and the second stage takes
 * about a third of a second. Long enough to breathe, not to lag the recitation.
 */
const ENVELOPE_ATTACK = 0.25;
const ENVELOPE_RELEASE = 0.06;
const AUTO_SMOOTH = 0.1;

/**
 * The spectrum, in three shapes: bars, peaks and waves.
 *
 * Waves is the one that reads as a waveform: four filled silhouettes of the same
 * signal, different smoothing, amplitude and blue, stacked front to back. Paused,
 * the block is empty: the canvas keeps its height so the controls never jump.
 */
export default function Visualiser({
  playing,
  model,
  height = 64,
}: {
  playing: boolean;
  model: Model;
  /** CSS pixels; the theatre layout asks for a taller horizon. */
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  // A bar starts at the floor: silence is zero height, not a stub.
  const levels = useRef<number[]>(new Array(BARS).fill(0));
  const peaks = useRef<number[]>(new Array(BARS).fill(0));
  const waves = useRef<Float32Array[]>(
    // Magnitudes in 0..1, so silence is zero, not the 128 centre line.
    WAVES.map(() => new Float32Array(WAVE_POINTS)),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    /**
     * The palette, read once per theme instead of twice per frame: `draw` used to
     * ask for the body's colour on every tick, which forces layout 60 times a
     * second for a value that only changes when the theme does.
     */
    const readTokens = () => {
      const styles = getComputedStyle(document.documentElement);
      const pick = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback;
      return {
        tints: waveTints(pick('--wave-front', '#1c4d78'), pick('--wave-back', '#5d97c9')),
        line: pick('--line', '#e8e8e8'),
      };
    };

    let tokens = readTokens();

    let width = 0;
    let barWidth = 2;
    // The wave's automatic gain and the envelope it follows, both updated in
    // `tick` and read by `drawWaves`.
    let auto = 1;
    let envelope = 0;
    // The ribbon's clock: when the last point was pushed, and the loudest read
    // since, so a syllable shorter than one push is not lost.
    let lastPush = performance.now();
    let runningPeak = 0;
    const acc = new Float32Array(WAVES.length);

    const measure = () => {
      width = canvas.clientWidth || 260;
      barWidth = Math.max(2, (width - GAP * (BARS - 1)) / BARS);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** Index 0 at the right edge, so the voice starts where the eye starts. */
    const xFor = (index: number, step = barWidth + GAP) => width - barWidth - index * step;

    /**
     * A quiet passage still has to be legible: the level is lifted by a gamma
     * before it becomes pixels, so an ordinary voice reads at half height instead
     * of a hairline, while true silence stays at the floor — zero, not a stub.
     */
    const barHeightFor = (level: number) => Math.pow(level, 0.65) * height;

    const drawBars = () => {
      ctx.fillStyle = tokens.tints[0];
      levels.current.forEach((level, index) => {
        const barHeight = barHeightFor(level);
        ctx.fillRect(xFor(index), height - barHeight, barWidth, barHeight);
      });
    };

    const drawPeaks = () => {
      drawBars();
      peaks.current.forEach((level, index) => {
        // A peak at zero is nothing; drawing it would leave a bar floating
        // above the floor on silence.
        if (level <= 0) return;
        const y = height - barHeightFor(level);
        ctx.fillRect(xFor(index), y - 2, barWidth, 1.5);
      });
    };

    /**
     * Each layer is a closed silhouette: the trace, then the floor, filled in its
     * own tint. Where four of them overlap the colour deepens, so the stack shows
     * its depth without any layer having to be drawn as a hairline.
     */
    const drawWaves = () => {
      // The strip uses the whole block: only the top pixels are left empty so
      // the loudest silhouette does not sit flush against the edge.
      const amplitude = height - 6;
      const step = width / (WAVE_POINTS - 1);
      const floor = height;
      // The points slide left between pushes, so the strip moves continuously
      // instead of stepping once per push.
      const phase = Math.min(1, (performance.now() - lastPush) / PUSH_MS);
      // Silence is the floor itself: no 1.5px stub, so a paused strip or a gap
      // between ayat does not leave a bar hovering above the bottom.
      const yFor = (sample: number, gain: number) =>
        height - Math.pow(Math.min(1, sample * auto * gain), 0.7) * amplitude;

      // Back to front, so the deepest tint is the nearest silhouette.
      for (let layer = WAVES.length - 1; layer >= 0; layer -= 1) {
        const style = WAVES[layer];
        const samples = waves.current[layer];
        ctx.fillStyle = tokens.tints[layer];
        ctx.globalAlpha = WAVE_ALPHA[layer];
        ctx.beginPath();
        ctx.moveTo(width, floor);
        // The newest point is still travelling in: hold its level to the edge.
        ctx.lineTo(width, yFor(samples[0], style.gain));
        for (let i = 0; i < samples.length; i += 1) {
          ctx.lineTo(width - (i + phase) * step, yFor(samples[i], style.gain));
        }
        ctx.lineTo(width - (samples.length - 1 + phase) * step, floor);
        ctx.closePath();
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      // The fill sits on the floor, so the floor itself only needs a hairline for
      // the quiet passages where the silhouettes are a sliver.
      ctx.fillStyle = tokens.line;
      ctx.fillRect(0, height - 1, width, 1);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      // Paused and idle are the same picture: nothing at all, not even the floor
      // line. Clearing here rather than in a separate branch matters because the
      // ResizeObserver also calls `draw`, and it used to paint the floor back
      // after the paused state had cleared the canvas.
      if (!playing) return;
      if (model === 'peaks') drawPeaks();
      else if (model === 'ribbon') drawWaves();
      else drawBars();
      ctx.globalAlpha = 1;
    };

    measure();
    draw();

    const observer = new ResizeObserver(() => {
      measure();
      draw();
    });
    observer.observe(canvas);

    // The theme lives on <html> as `data-theme`, so the tints have to be re-read
    // when it flips — during a playing track, without remounting the canvas.
    const theme = new MutationObserver(() => {
      tokens = readTokens();
      draw();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    if (!playing) {
      return () => {
        observer.disconnect();
        theme.disconnect();
      };
    }

    const bins = new Uint8Array(512);
    const time = new Uint8Array(1024);
    let frame = 0;

    const tick = () => {
      const analyser = getAnalyser();
      const fresh = Boolean(analyser) && !reduced && frame % DATA_EVERY === 0;
      if (analyser && fresh) {
        if (model !== 'ribbon') {
          analyser.getByteFrequencyData(bins);
          downsample(bins, BARS).forEach((target, index) => {
            const level = target;
            const current = levels.current[index];
            // Rise quickly, fall slowly: the same shape with less flicker.
            levels.current[index] += (level - current) * (level > current ? 0.5 : 0.14);
            peaks.current[index] = Math.max(levels.current[index], peaks.current[index] - 0.008);
          });
        } else {
          analyser.getByteTimeDomainData(time);
          const peak = peakMagnitude(time);
          runningPeak = Math.max(runningPeak, peak);
          // One envelope for the whole strip: the four layers share a signal,
          // so a per-layer gain would flatten the ladder, not extend it.
          envelope += (peak - envelope) * (peak > envelope ? ENVELOPE_ATTACK : ENVELOPE_RELEASE);
          auto += (autoGain(envelope) - auto) * AUTO_SMOOTH;
        }
      }

      if (model === 'ribbon' && analyser && !reduced) {
        const now = performance.now();
        const due = Math.floor((now - lastPush) / PUSH_MS);
        if (due > 0) {
          // A hidden tab stops the frame loop; do not replay seconds of history
          // when it comes back.
          lastPush = due > 4 ? now : lastPush + due * PUSH_MS;
          for (let n = 0; n < Math.min(due, 4); n += 1) {
            WAVES.forEach((style, layer) => {
              const level = n === 0 ? runningPeak : 0;
              const rate = level > acc[layer] ? style.rise : style.fall;
              acc[layer] += (level - acc[layer]) * rate;
              const history = waves.current[layer];
              history.copyWithin(1, 0, history.length - 1);
              history[0] = acc[layer];
            });
          }
          runningPeak = 0;
        }
      }

      // The bars only change when data arrives; the ribbon also scrolls, so it
      // paints every frame.
      if (model === 'ribbon' || fresh || frame === 0) draw();
      frame += 1;
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      theme.disconnect();
    };
  }, [playing, model, height]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="block w-full transition-opacity duration-300"
      style={{ height, opacity: playing ? 1 : 0 }}
    />
  );
}
