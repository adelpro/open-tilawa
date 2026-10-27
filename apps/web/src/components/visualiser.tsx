import { useEffect, useRef } from 'react';

import { getAnalyser } from '@/utils/audio-analyser';
import { downsample, type Visualiser as Model } from '@/utils/visualiser-models';

const BARS = 28;
const HEIGHT = 64;
const GAP = 3;
/** Waterfall history: one column per frame bucket, newest at the reading edge. */
const HISTORY = 56;

/**
 * The spectrum, in five shapes. Everything is ink on transparent, bottom-anchored,
 * and mirrored so band 0 sits at the reading edge (right) in this RTL page.
 *
 * Paused, the last shape stays at a quarter opacity: the block does not jump and
 * "not listening" is legible without a label.
 */
export default function Visualiser({ playing, model }: { playing: boolean; model: Model }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const levels = useRef<number[]>(new Array(BARS).fill(0.08));
  const peaks = useRef<number[]>(new Array(BARS).fill(0.08));
  const history = useRef<number[][]>([]);
  // 128 is silence in the byte time-domain format; zeroes would draw a full block.
  const wave = useRef<Float32Array>(new Float32Array(BARS * 4).fill(128));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const ink = getComputedStyle(document.body).color || '#111111';

    let width = 0;
    let barWidth = 2;

    const measure = () => {
      width = canvas.clientWidth || 260;
      barWidth = Math.max(2, (width - GAP * (BARS - 1)) / BARS);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** Index 0 at the right edge, so the voice starts where the eye starts. */
    const xFor = (index: number, step = barWidth + GAP) => width - barWidth - index * step;

    const drawBars = () => {
      levels.current.forEach((level, index) => {
        const height = Math.max(2, level * HEIGHT);
        ctx.fillRect(xFor(index), HEIGHT - height, barWidth, height);
      });
    };

    const drawPeaks = () => {
      drawBars();
      peaks.current.forEach((level, index) => {
        const y = HEIGHT - Math.max(3, level * HEIGHT);
        ctx.fillRect(xFor(index), y - 2, barWidth, 1.5);
      });
    };

    const drawDots = () => {
      const step = width / BARS;
      levels.current.forEach((level, index) => {
        const radius = 1.2 + level * 6;
        const x = width - step / 2 - index * step;
        ctx.beginPath();
        ctx.arc(x, HEIGHT - 8, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const drawRibbon = () => {
      const data = wave.current;
      const points = data.length;
      const step = width / points;
      ctx.beginPath();
      ctx.moveTo(width, HEIGHT);
      for (let i = 0; i < points; i += 1) {
        const value = Math.abs((data[i] - 128) / 128);
        const x = width - i * step;
        // A silent time-domain buffer is flat, which collapses the polygon to
        // nothing; the floor keeps a hairline the way the bars keep 2px.
        ctx.lineTo(x, HEIGHT - Math.max(1.5, value * (HEIGHT - 6)));
      }
      ctx.lineTo(0, HEIGHT);
      ctx.closePath();
      ctx.fill();
    };

    const drawWaterfall = () => {
      const columns = history.current;
      if (columns.length === 0) {
        // Nothing has been heard yet: a hairline, not an empty rectangle.
        ctx.fillRect(0, HEIGHT - 1.5, width, 1.5);
        return;
      }
      const step = width / HISTORY;
      columns.forEach((column, age) => {
        const x = width - (age + 1) * step;
        if (x < -step) return;
        column.forEach((level, band) => {
          const height = Math.max(1, level * HEIGHT);
          const y = HEIGHT - height;
          const bandHeight = (HEIGHT / column.length) * 1.1;
          ctx.fillRect(x, y, step - 1, Math.min(bandHeight, height));
        });
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, HEIGHT);
      ctx.fillStyle = ink;
      if (model === 'peaks') drawPeaks();
      else if (model === 'dots') drawDots();
      else if (model === 'ribbon') drawRibbon();
      else if (model === 'waterfall') drawWaterfall();
      else drawBars();
    };

    measure();
    draw();

    const observer = new ResizeObserver(() => {
      measure();
      draw();
    });
    observer.observe(canvas);

    if (!playing) {
      return () => observer.disconnect();
    }

    const bins = new Uint8Array(128);
    const time = new Uint8Array(128);
    let frame = 0;

    const tick = () => {
      const analyser = getAnalyser();
      if (analyser && !reduced) {
        analyser.getByteFrequencyData(bins);
        const bands = downsample(bins, BARS);
        bands.forEach((target, index) => {
          levels.current[index] += (Math.max(0.06, target) - levels.current[index]) * 0.35;
          peaks.current[index] = Math.max(levels.current[index], peaks.current[index] - 0.008);
        });

        if (model === 'ribbon') {
          analyser.getByteTimeDomainData(time);
          wave.current = new Float32Array(time);
        }

        if (model === 'waterfall' && frame % 2 === 0) {
          history.current.unshift(downsample(bins, 10));
          history.current.length = Math.min(history.current.length, HISTORY);
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
  }, [playing, model]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="block h-16 w-full transition-opacity duration-300"
      style={{ opacity: playing ? 1 : 0.25 }}
    />
  );
}
