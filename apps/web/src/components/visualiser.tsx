import { useEffect, useRef } from 'react';

import { getAnalyser } from '@/utils/audio-analyser';

const BARS = 28;
const HEIGHT = 64;

/**
 * The analyser draws what the speaker is doing. When playback pauses the bars
 * keep their last shape at a quarter opacity: the layout does not jump, and the
 * difference between listening and not listening is visible without a label.
 *
 * With no analyser (a browser that refused the graph, or before the first play)
 * it draws a flat shelf, so the block never collapses.
 */
export default function Visualiser({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const levels = useRef<number[]>(new Array(BARS).fill(0.08));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || 260;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const ink = getComputedStyle(document.body).color || '#111111';
    const gap = 3;
    const barWidth = Math.max(2, (width - gap * (BARS - 1)) / BARS);

    const draw = () => {
      ctx.clearRect(0, 0, width, HEIGHT);
      ctx.fillStyle = ink;
      levels.current.forEach((level, index) => {
        const height = Math.max(2, level * HEIGHT);
        const x = index * (barWidth + gap);
        // Bottom-anchored: these are levels rising from the floor, not a
        // symmetric shape around a centre line.
        const y = HEIGHT - height;
        ctx.fillRect(x, y, barWidth, height);
      });
    };

    draw();
    if (!playing) return;

    // The engine creates the analyser in its own play effect; this one may run
    // first. So the loop starts regardless and picks the analyser up when it
    // exists, instead of drawing a flat shelf for the whole session.
    const bins = new Uint8Array(128);
    const tick = () => {
      const analyser = getAnalyser();
      if (!analyser || reduced) {
        draw();
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      analyser.getByteFrequencyData(bins);
      // Low bins carry the voice; skip the top of the spectrum, which is hiss.
      const usable = Math.floor(bins.length * 0.6);
      for (let i = 0; i < BARS; i += 1) {
        const start = Math.floor((i / BARS) ** 1.4 * usable);
        const end = Math.max(start + 1, Math.floor(((i + 1) / BARS) ** 1.4 * usable));
        let peak = 0;
        for (let j = start; j < end && j < bins.length; j += 1) peak = Math.max(peak, bins[j]);
        const target = Math.max(0.06, peak / 255);
        levels.current[i] += (target - levels.current[i]) * 0.35;
      }
      draw();
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-16 w-full max-w-[260px] transition-opacity duration-300"
      style={{ opacity: playing ? 1 : 0.25 }}
    />
  );
}
