import { useEffect, useRef } from 'react';

import { getAnalyser } from '@/utils/audio-analyser';
import { downsample, type Visualiser as Model } from '@/utils/visualiser-models';

const BARS = 28;
const GAP = 3;
/** Ribbon resolution: points across the width, not raw analyser samples. */
const RIBBON_POINTS = 220;
/** How many past frames the ribbon keeps as fading echoes. */
const TRAILS = 3;

/**
 * The spectrum, in three shapes: bars, peaks and a ribbon.
 *
 * The ribbon is deliberately slow and layered — each frame moves a fraction of
 * the way to the new waveform, and three older snapshots stay behind it as
 * fading lines, so it reads as a moving trace rather than a jittering edge.
 *
 * Everything is ink on transparent, bottom-anchored, mirrored so band 0 sits at
 * the reading edge (right) in this RTL page. Paused, the block is empty: the
 * canvas keeps its height so the controls never jump.
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
  const smoothed = useRef<Float32Array>(new Float32Array(RIBBON_POINTS).fill(128));
  const trails = useRef<Float32Array[]>([]);
  /** Smoothed recent peak: fast to rise, slow to fall, so the shape never jitters. */
  const loudness = useRef(0.12);

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

    const tracePath = (samples: Float32Array, amplitude: number, gain: number) => {
      const step = width / (samples.length - 1);
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 1) {
        const value = Math.min(1, Math.abs((samples[i] - 128) / 128) * gain);
        const x = width - i * step;
        ctx.lineTo(x, height - Math.max(1.5, value * amplitude));
      }
      ctx.lineTo(0, height);
    };

    const drawRibbon = () => {
      const amplitude = height - 10;
      // A quiet passage would otherwise be a flat line at the bottom. The gain
      // follows the recent peak with a slow release, which is the "throttle": the
      // trace keeps a readable height at any level without twitching per frame.
      let peak = 0;
      for (let i = 0; i < smoothed.current.length; i += 1) {
        peak = Math.max(peak, Math.abs((smoothed.current[i] - 128) / 128));
      }
      const target = Math.max(0.12, peak);
      loudness.current +=
        (target - loudness.current) * (target > loudness.current ? 0.25 : 0.05);
      const gain = Math.min(5.5, 1.1 / loudness.current);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Oldest first, faintest last: the current line is always the solid one.
      trails.current.forEach((snapshot, index) => {
        const age = trails.current.length - index;
        ctx.globalAlpha = 0.1 + (1 - age / (TRAILS + 1)) * 0.22;
        ctx.lineWidth = 1;
        tracePath(snapshot, amplitude * 0.92, gain);
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.4;
      tracePath(smoothed.current, amplitude, gain);
      ctx.stroke();
      // A hairline along the baseline keeps the block from floating.
      ctx.fillRect(0, height - 1, width, 1);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = inkNow();
      ctx.strokeStyle = inkNow();
      ctx.globalAlpha = 1;
      if (model === 'peaks') drawPeaks();
      else if (model === 'ribbon') drawRibbon();
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
      if (analyser && !reduced) {
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
          // Slower than the bars on purpose — but the buffer starts at silence,
          // so the first second catches up quickly before it settles at 0.07.
          const follow = frame < 45 ? 0.3 : 0.07;
          for (let i = 0; i < RIBBON_POINTS; i += 1) {
            const raw = time[Math.floor((i / RIBBON_POINTS) * time.length)];
            smoothed.current[i] += (raw - smoothed.current[i]) * follow;
          }
          if (frame % 8 === 0) {
            trails.current.push(new Float32Array(smoothed.current));
            trails.current = trails.current.slice(-TRAILS);
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
