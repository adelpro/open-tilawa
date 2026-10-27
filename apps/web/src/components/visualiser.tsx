import { useEffect, useRef } from 'react';

import { getAnalyser } from '@/utils/audio-analyser';
import { downsample, type Visualiser as Model } from '@/utils/visualiser-models';

const BARS = 28;
const GAP = 3;
/** Points across the width for the wave layers, not raw analyser samples. */
const WAVE_POINTS = 240;
/**
 * Four waves, front to back. Each one reads the same time-domain signal with its
 * own smoothing and gain, so they breathe at different speeds and never collapse
 * into a single line: the quiet ones stay visible, the loud one reaches the top.
 */
const WAVES = [
  { gain: 2.6, alpha: 0.95, lineWidth: 1.6, follow: 0.13, shift: 0 },
  { gain: 2.1, alpha: 0.5, lineWidth: 1.3, follow: 0.09, shift: 37 },
  { gain: 1.7, alpha: 0.32, lineWidth: 1.1, follow: 0.065, shift: 83 },
  { gain: 1.35, alpha: 0.2, lineWidth: 1, follow: 0.045, shift: 131 },
];
/**
 * The analyser is read every other frame, not every frame: at 30 Hz with the
 * smoothing above the waves breathe instead of twitching, and no one can hear
 * the difference.
 */
const DATA_EVERY = 2;

/**
 * The spectrum, in three shapes: bars, peaks and waves.
 *
 * Waves is the one that reads as a waveform: four layered traces of the same
 * signal, different smoothing and amplitude, mirrored around the floor and drawn
 * in ink. Paused, the block is empty: the canvas keeps its height so the
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
    const inkNow = () => getComputedStyle(document.body).color || '#111111';

    let width = 0;
    let barWidth = 2;

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

    const drawWaves = () => {
      const amplitude = height - 10;
      const step = width / (WAVE_POINTS - 1);

      // Back to front, so the brightest line is always the nearest one.
      for (let layer = WAVES.length - 1; layer >= 0; layer -= 1) {
        const style = WAVES[layer];
        const samples = waves.current[layer];
        ctx.globalAlpha = style.alpha;
        ctx.lineWidth = style.lineWidth;
        ctx.beginPath();
        for (let i = 0; i < samples.length; i += 1) {
          const value = Math.min(1, Math.abs((samples[i] - 128) / 128) * style.gain);
          const x = width - i * step;
          const y = height - Math.max(1.5, Math.pow(value, 0.85) * amplitude);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      // A hairline along the baseline keeps the block from floating.
      ctx.fillRect(0, height - 1, width, 1);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = inkNow();
      ctx.strokeStyle = inkNow();
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

    if (!playing) {
      // Nothing is playing, so nothing is drawn — not even the old shape.
      ctx.clearRect(0, 0, width, height);
      return () => observer.disconnect();
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
