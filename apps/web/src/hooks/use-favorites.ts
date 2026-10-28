import { useCallback, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';

import { user } from '@/gun';
import { syncFavorite, syncView } from '@/gun/counts';
import { myFavoritesAtom, gunUserPubAtom } from '@/jotai/gun';
import { selectedReciterAtom } from '@/jotai/atom';
import { getCountingIdentity } from '@/utils/identity';
import {
  readCounted,
  readLocalFavorites,
  writeCounted,
  writeLocalFavorites,
} from '@/utils/favorites-local';

const VIEWED_PREFIX = 'open-tilawa:viewed:';

/**
 * The user's own favourites plus the two public counters.
 *
 * The local list is the source of truth for the UI; `gun.user().favorites` is a
 * sync layer on top of it. A favourite therefore works while logged out, and
 * logging in later merges instead of replacing. The login merge itself lives in
 * `useUserSync` — one owner for the account graph, so two effects cannot race
 * to rewrite the same list.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useAtom(myFavoritesAtom);
  const pub = useAtomValue(gunUserPubAtom);

  // Seed from localStorage once, so anonymous favourites survive a reload.
  useEffect(() => {
    if (favorites.length === 0) {
      const local = readLocalFavorites();
      if (local.length > 0) setFavorites(local);
    }
    // Intentionally runs once; later updates come from toggles and Gun.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isFavorite = useCallback(
    (reciterId: string | number) => favorites.includes(String(reciterId)),
    [favorites],
  );

  const toggle = useCallback(
    (reciterId: string | number) => {
      const id = String(reciterId);
      const wasFavorite = favorites.includes(id);
      const next = wasFavorite ? favorites.filter((f) => f !== id) : [...favorites, id];

      setFavorites(next);
      writeLocalFavorites(next);

      if (user.is) {
        user.get('favorites').get(id).put(wasFavorite ? null : true);
      }

      // Only a real transition moves the public counter.
      const identity = getCountingIdentity(pub);
      const counted = readCounted(identity);
      if (!wasFavorite && !counted.has(id)) {
        counted.add(id);
        writeCounted(identity, counted);
        syncFavorite(id, true);
      } else if (wasFavorite && counted.has(id)) {
        counted.delete(id);
        writeCounted(identity, counted);
        syncFavorite(id, false);
      }
    },
    [favorites, pub, setFavorites],
  );

  return { favorites, isFavorite, toggle };
}

/**
 * Counts a reciter once per tab session. Mount it once, next to the player, so
 * the sheet rows never trigger a view.
 */
export function useTrackView() {
  const reciter = useAtomValue(selectedReciterAtom);

  useEffect(() => {
    if (!reciter) return;
    const id = String(reciter.id);
    try {
      const key = `${VIEWED_PREFIX}${id}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage unavailable: count it, the relay cannot tell either way
    }
    syncView(id);
  }, [reciter]);
}
