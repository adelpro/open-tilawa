export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Move `delta` seconds inside a file, never past either end. A stream whose
 * duration is not known yet (or is Infinity while the torrent is still
 * buffering) has no meaningful seek target, so it stays put.
 */
export function seekBy(position: number, delta: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp(position + delta, 0, duration);
}
