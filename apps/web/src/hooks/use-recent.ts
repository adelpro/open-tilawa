import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { useAtomValue } from 'jotai';

import { user } from '@/gun';
import { selectedReciterAtom } from '@/jotai/atom';
import { myRecentAtom, gunUserPubAtom } from '@/jotai/gun';
import { readRecent, rememberReciter, writeRecent } from '@/utils/recent-local';

/**
 * Records the reciter the listener opened, newest first, last ten.
 *
 * Local storage is the source of truth for the list; the account graph is a
 * write-through mirror so a second device can fold it in on login.
 */
export function useRecordRecent() {
  const reciter = useAtomValue(selectedReciterAtom);
  const [, setRecent] = useAtom(myRecentAtom);

  useEffect(() => {
    if (!reciter) return;
    const id = String(reciter.id);
    setRecent(rememberReciter(id));

    if (!user.is) return;
    try {
      user
        .get('recentlyViewed')
        .get(id)
        .put({ at: Date.now() });
    } catch {
      // offline: the local list still holds it
    }
  }, [reciter, setRecent]);
}

/** Seeds the atom from storage so the sheet has a list before anything plays. */
export function useHydrateRecent() {
  const [, setRecent] = useAtom(myRecentAtom);
  useEffect(() => {
    setRecent(readRecent());
  }, [setRecent]);
}

/**
 * On login, fold the account's history into this device's list. Local wins on
 * ties; `normaliseRecent` keeps the newest stamp per reciter either way.
 */
export function useRecentSync() {
  const pub = useAtomValue(gunUserPubAtom);
  const [, setRecent] = useAtom(myRecentAtom);

  useEffect(() => {
    if (!pub || !user.is) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const local = readRecent();
      setRecent(local);
    }, 1500);

    user
      .get('recentlyViewed')
      .once((remote: Record<string, { at?: number }> | undefined) => {
        clearTimeout(timer);
        if (cancelled) return;
        const local = readRecent();
        const fromAccount = Object.entries(remote || {})
          .filter(([key]) => key !== '_')
          .map(([id, value]) => ({ id, at: typeof value?.at === 'number' ? value.at : 0 }));
        const merged = writeRecent([...local, ...fromAccount]);
        setRecent(merged);
        // Push back anything the account was missing.
        const known = new Set(fromAccount.map((entry) => entry.id));
        merged
          .filter((entry) => !known.has(entry.id))
          .forEach((entry) => {
            try {
              user.get('recentlyViewed').get(entry.id).put({ at: entry.at });
            } catch {
              // retried on the next listen
            }
          });
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pub, setRecent]);
}
