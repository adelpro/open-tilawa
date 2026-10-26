/**
 * The ring answers "how much of this surah is here yet". It is meaningless for a
 * host-served reciter (no swarm) and pointless at the two extremes: an empty
 * ring is not progress, and a full one is a done state nobody needs to see.
 */
export function shouldShowRing(source: 'connected' | 'waiting' | 'http', progress: number): boolean {
  if (source === 'http') return false;
  if (!Number.isFinite(progress)) return false;
  return progress > 0.01 && progress < 0.995;
}
