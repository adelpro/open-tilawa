import { useEffect } from 'react';
import { useAtom } from 'jotai';

import { subscribeCounts } from '@/gun/counts';
import { globalViewCountsAtom, globalFavoriteCountsAtom } from '@/jotai/gun';

/**
 * Public counters. Safe to call from several components: `subscribeCounts`
 * keeps one relay subscription per counter and fans out in memory.
 */
export function useGlobalCounts() {
  const [viewCounts, setViewCounts] = useAtom(globalViewCountsAtom);
  const [favCounts, setFavCounts] = useAtom(globalFavoriteCountsAtom);

  useEffect(() => subscribeCounts('view', setViewCounts), [setViewCounts]);
  useEffect(() => subscribeCounts('favorite', setFavCounts), [setFavCounts]);

  return { viewCounts, favCounts };
}
