import { useCallback, useEffect, useState } from 'react';

import type { Reciter } from '@/types';
import { toReciters, type CatalogueRow } from '@/utils/catalogue';

/**
 * The reciter list, served by the admin catalogue.
 *
 * The catalogue is the only source: what is published there is the roster, in
 * that order. There is deliberately no built-in list to fall back to — a stale
 * copy of the roster is how two reciters ended up sharing a name and a stale
 * hash came back from the dead. The last good payload is cached instead, so an
 * outage costs freshness, not the player.
 */

const ADMIN_API =
  (import.meta as { env?: Record<string, string> }).env?.VITE_ADMIN_API_URL ||
  'https://admin-tilawa.quran.us.kg';

const CACHE_KEY = 'tilawa.reciters.v1';

let pending: Promise<Reciter[]> | null = null;

function readCache(): Reciter[] {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as CatalogueRow[];
    return Array.isArray(rows) ? toReciters(rows) : [];
  } catch {
    return [];
  }
}

function writeCache(rows: CatalogueRow[]): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    // A full or disabled store costs freshness, never playback.
  }
}

async function fetchRoster(): Promise<Reciter[]> {
  const response = await fetch(`${ADMIN_API}/api/public/reciters`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`catalogue answered ${response.status}`);

  const body = (await response.json()) as { reciters?: CatalogueRow[] };
  if (!Array.isArray(body.reciters)) throw new Error('catalogue payload is not a list');

  writeCache(body.reciters);
  return toReciters(body.reciters);
}

export function useReciters(): { reciters: Reciter[]; error: boolean; retry: () => void } {
  const [reciters, setReciters] = useState<Reciter[]>(readCache);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    pending ??= fetchRoster();
    void pending.then(
      (list) => {
        if (!live) return;
        setReciters(list);
        setError(false);
      },
      () => {
        if (!live) return;
        setError(true);
        // A failed fetch must not be memoised, or retry would resolve instantly.
        pending = null;
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    pending = null;
    setError(false);
    setAttempt((value) => value + 1);
  }, []);

  return { reciters, error, retry };
}
