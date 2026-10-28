import { useEffect, useRef } from 'react';

import { getAnalyser } from '@/utils/audio-analyser';
import {
  autoGain,
  downsample,
  waveTints,
  type Visualiser as Model,
} from '@/utils/visualiser-models';

const BARS = 28;
const GAP = 3;
/** Points across the width for the wave layers, not raw analyser samples. */
const WAVE_POINTS = 240;
/**
 * Four waves, front to back. Each one reads the same time-domain signal with its
 * own smoothing and gain, so they breathe at different speeds and never collapse
 * into a single shape: the quiet ones stay visible, the loud one reaches the top.
 * The front layer is drawn last, so it is the one you read first.
 */
const WAVES = [
  { gain: 2.6, follow: 0.1, shift: 0 },
  { gain: 2.1, follow: 0.07, shift: 37 },
  { gain: 1.7, follow: 0.05, shift: 83 },
  { gain: 1.35, follow: 0.035, shift: 131 },
];
/**
 * How opaque each filled layer is, front to back. Alpha is not the only depth
 * cue — the tint does that — but four layers at a flat 0.6 turn the ribbon into
 * one slab, so the ladder stays wide: the front wash is solid enough to read as
 * the near silhouette, the back one is a haze.
 */
const WAVE_ALPHA = [0.72, 0.55, 0.42, 0.3];
/**
 * A filled layer that saturates covers the three behind it, so the ribbon reads
 * its gain down: the front silhouette still reaches most of the way up, and the
 * stack keeps four edges instead of collapsing into one block on a loud passage.
 */
const FILL_GAIN = 0.65;
/**
 * The analyser is read every other frame, not every frame: at 30 Hz with the
 * smoothing above the waves breathe instead of twitching, and no one can hear
 * the difference.
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
  const levels = useRef<number[]>(new Array(BARS).fill(0.08));
  const peaks = useRef<number[]>(new Array(BARS).fill(0.08));
  const waves = useRef<Float32Array[]>(
    WAVES.map(() => new Float32Array(WAVE_POINTS).fill(128)),
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
     * of a hairline, while true silence stays at the floor.
     */
    const barHeightFor = (level: number) => Math.max(3, Math.pow(level, 0.65) * height);

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
      const amplitude = height - 12;
      const step = width / (WAVE_POINTS - 1);
      const floor = height - 1;

      // Back to front, so the deepest tint is the nearest silhouette.
      for (let layer = WAVES.length - 1; layer >= 0; layer -= 1) {
        const style = WAVES[layer];
        const samples = waves.current[layer];
        ctx.fillStyle = tokens.tints[layer];
        ctx.globalAlpha = WAVE_ALPHA[layer];
        ctx.beginPath();
        ctx.moveTo(width, floor);
        for (let i = 0; i < samples.length; i += 1) {
          const value = Math.min(
            1,
            Math.abs((samples[i] - 128) / 128) * auto * style.gain * FILL_GAIN,
          );
          const x = width - i * step;
          const y = height - Math.max(1.5, Math.pow(value, 0.7) * amplitude);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(0, floor);
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
      // Nothing is playing, so nothing is drawn — not even the old shape.
      ctx.clearRect(0, 0, width, height);
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
      if (analyser && !reduced && frame % DATA_EVERY === 0) {
        analyser.getByteFrequencyData(bins);
        downsample(bins, BARS).forEach((target, index) => {
          const level = Math.max(0.06, target);
          const current = levels.current[index];
          // Rise quickly, fall slowly: the same shape with less flicker.
          levels.current[index] += (level - current) * (level > current ? 0.5 : 0.14);
          peaks.current[index] = Math.max(levels.current[index], peaks.current[index] - 0.008);
        });

        if (model === 'ribbon') {
          analyser.getByteTimeDomainData(time);
          // One envelope for the whole strip: the four layers share a signal,
          // so a per-layer gain would flatten the ladder, not extend it.
          let peak = 0;
          for (let i = 0; i < time.length; i += 1) {
            peak = Math.max(peak, Math.abs(time[i] - 128) / 128);
          }
          envelope += (peak - envelope) * (peak > envelope ? ENVELOPE_ATTACK : ENVELOPE_RELEASE);
          auto += (autoGain(envelope) - auto) * AUTO_SMOOTH;
          for (let layer = 0; layer < WAVES.length; layer += 1) {
            const style = WAVES[layer];
            const samples = waves.current[layer];
            for (let i = 0; i < WAVE_POINTS; i += 1) {
              const raw = time[(i + style.shift) % time.length];
              samples[i] += (raw - samples[i]) * style.follow;
            }
          }
        }
      }
      draw();
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
