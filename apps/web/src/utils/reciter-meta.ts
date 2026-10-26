import type { Reciter } from '@/types';

/**
 * True when a reciter can play over plain HTTP without peers: an Itqan
 * playlist, or web seeds in the magnet. The queue shows the same distinction as
 * the `Fidelity` badge, so the two never disagree.
 */
export function hasHttpFallback(reciter: Reciter): boolean {
  return (
    (!reciter.magnet && (reciter.itqanPlaylist?.length ?? 0) > 0) || /&ws=/.test(reciter.magnet)
  );
}
