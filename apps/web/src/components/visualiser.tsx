import { useEffect, useRef } from 'react';

import { getAnalyser } from '@/utils/audio-analyser';

const BARS = 28;
const HEIGHT = 64;
const GAP = 3;

/**
 * The analyser draws what the speaker is doing: bars rising from the baseline,
 * band 0 at the reading edge (right) because the page is RTL.
 *
 * When playback pauses the bars keep their last shape at a quarter opacity —
 * the layout does not jump, and the difference between listening and not is
 * visible without a label. With no analyser (a browser that refused the graph,
 * or before the first play) it draws a flat shelf, so the block never collapses.
 */
export default function Visualiser({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const levels = useRef<number[]>(new Array(BARS).fill(0.08));

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

    const draw = () => {
      ctx.clearRect(0, 0, width, HEIGHT);
      ctx.fillStyle = ink;
      levels.current.forEach((level, index) => {
        const height = Math.max(2, level * HEIGHT);
        const x = width - barWidth - index * (barWidth + GAP);
        ctx.fillRect(x, HEIGHT - height, barWidth, height);
      });
    };

    measure();
    draw();

    // The column is fluid (phone, rotation, desktop), so the canvas re-measures
    // instead of baking in the width from the first paint.
    const observer = new ResizeObserver(() => {
      measure();
      draw();
    });
    observer.observe(canvas);

    if (!playing) {
      return () => observer.disconnect();
    }

    // The engine creates the analyser in its own play effect; this one may run
    // first, so the loop starts regardless and picks it up when it exists.
    const bins = new Uint8Array(128);
    const tick = () => {
      const analyser = getAnalyser();
      if (analyser && !reduced) {
        analyser.getByteFrequencyData(bins);
        const usable = Math.floor(bins.length * 0.6);
        for (let i = 0; i < BARS; i += 1) {
          const start = Math.floor(((i / BARS) ** 1.4) * usable);
          const end = Math.max(start + 1, Math.floor((((i + 1) / BARS) ** 1.4) * usable));
          let peak = 0;
          for (let j = start; j < end && j < bins.length; j += 1) peak = Math.max(peak, bins[j]);
          const target = Math.max(0.06, peak / 255);
          levels.current[i] += (target - levels.current[i]) * 0.35;
        }
      }
      draw();
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
    };
  }, [playing]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="block h-16 w-full transition-opacity duration-300"
      style={{ opacity: playing ? 1 : 0.25 }}
    />
  );
}
