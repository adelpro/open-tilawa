import { useEffect, useRef } from 'react';

import { getAnalyser } from '@/utils/audio-analyser';
import {
  downsample,
  follow,
  logBands,
  waveTints,
  type Visualiser as Model,
} from '@/utils/visualiser-models';

const BARS = 28;
const GAP = 3;
/**
 * Columns across the ribbon: twice the bars, because the silhouette is read as
 * one curve and 28 points would show their corners.
 */
const RIBBON_POINTS = 56;
/**
 * Four waves, front to back. Each layer is the same spectrum, band by band,
 * held by its own rise/fall follower: the front one snaps to each syllable, the
 * back ones trail it. Nothing scrolls — x is frequency, so a band lives where it
 * is and only the heights move.
 */
const WAVES = [
  { gain: 1, attack: 0.5, release: 0.14 },
  { gain: 0.8, attack: 0.37, release: 0.12 },
  { gain: 0.62, attack: 0.27, release: 0.1 },
  { gain: 0.46, attack: 0.19, release: 0.08 },
];
/**
 * How opaque each filled layer is, front to back. Alpha is not the only depth
 * cue — the tint does that — but four layers at a flat 0.6 turn the ribbon into
 * one slab, so the ladder stays wide: the front wash is solid enough to read as
 * the near silhouette, the back one is a haze.
 */
const WAVE_ALPHA = [0.72, 0.55, 0.42, 0.3];
/**
 * How much of the block the silhouettes fill. Bars and peaks are hairlines
 * against air, so they use the whole height; four filled layers at full height
 * read as a slab lying on the transport. The block itself keeps its height, so
 * switching shape never moves the controls under the thumb.
 */
const RIBBON_FILL = 0.72;
/**
 * The analyser is read every other frame, not every frame: 30 Hz is plenty for
 * a spectrum, and no one can hear the difference.
 */
const DATA_EVERY = 2;

/**
 * The spectrum, in three shapes: bars, peaks and waves.
 *
 * Waves is four filled silhouettes of the same spectrum — one per layer, each
 * held at its own speed and tinted its own blue, stacked front to back. x is
 * frequency, so the shape stands where it is and only the heights move with the
 * recitation. Paused, the block is empty: the canvas keeps its height so the
 * controls never jump.
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
    // Magnitudes in 0..1, so silence is the floor, not the 128 centre line.
    WAVES.map(() => new Float32Array(RIBBON_POINTS)),
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
    // One scratch column of y values, reused by every layer on every paint.
    const ys = new Float32Array(RIBBON_POINTS);

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
      // Shorter than the block it lives in, so the loudest silhouette stops
      // short of the top edge instead of filling it edge to edge.
      const amplitude = (height - 6) * RIBBON_FILL;
      const step = width / (RIBBON_POINTS - 1);
      const floor = height;
      // Silence is the floor itself: no stub, so a gap between ayat does not
      // leave a sliver hovering above the bottom. The gamma lifts an ordinary
      // recitation off the floor, the same way it does for the bars.
      const yFor = (level: number) => height - Math.pow(Math.min(1, level), 0.7) * amplitude;

      // Back to front, so the deepest tint is the nearest silhouette.
      for (let layer = WAVES.length - 1; layer >= 0; layer -= 1) {
        const samples = waves.current[layer];
        for (let i = 0; i < samples.length; i += 1) ys[i] = yFor(samples[i]);
        ctx.fillStyle = tokens.tints[layer];
        ctx.globalAlpha = WAVE_ALPHA[layer];
        ctx.beginPath();
        // Index 0 is the low end, at the right edge like the bars. Every point
        // after it is one step further left.
        ctx.moveTo(width, ys[0]);
        // A quadratic through each midpoint: one curve, not a staircase.
        for (let i = 1; i < samples.length - 1; i += 1) {
          const x = width - i * step;
          ctx.quadraticCurveTo(x, ys[i], x - step / 2, (ys[i] + ys[i + 1]) / 2);
        }
        ctx.lineTo(0, ys[RIBBON_POINTS - 1]);
        ctx.lineTo(0, floor);
        ctx.lineTo(width, floor);
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
    let frame = 0;

    const tick = () => {
      const analyser = getAnalyser();
      const fresh = Boolean(analyser) && !reduced && frame % DATA_EVERY === 0;
      if (analyser && fresh) {
        analyser.getByteFrequencyData(bins);
        if (model === 'ribbon') {
          // Log-spaced bands, not the bars' nearly-linear buckets: the top
          // octave of a recitation is empty, and on a linear axis it would take
          // half the strip and leave the wave looking cut off.
          const target = logBands(bins, RIBBON_POINTS, analyser.context.sampleRate);
          WAVES.forEach((style, layer) => {
            const samples = waves.current[layer];
            for (let i = 0; i < samples.length; i += 1) {
              samples[i] = follow(samples[i], target[i] * style.gain, style.attack, style.release);
            }
          });
        } else {
          downsample(bins, BARS).forEach((target, index) => {
            levels.current[index] = follow(levels.current[index], target, 0.5, 0.14);
            // A peak is a ceiling, so it can only fall as the bar sinks.
            peaks.current[index] = Math.max(levels.current[index], peaks.current[index] - 0.008);
          });
        }
      }

      // The shape only changes when data arrives, so neither model needs a
      // repaint on every frame.
      if (fresh || frame === 0) draw();
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
