import { useCallback, useEffect, useRef, useState } from 'react';

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
const DEFAULT_PAGE = 1;
const DEFAULT_RANGE = 10;

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

async function fetchRosterPage(
  page: number = DEFAULT_PAGE,
  range: number = DEFAULT_RANGE,
): Promise<{ reciters: Reciter[]; total: number; page: number; range: number }> {
  const response = await fetch(
    `${ADMIN_API}/api/public/reciters?page=${page}&range=${range}`,
    {
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) throw new Error(`catalogue answered ${response.status}`);

  const body = (await response.json()) as {
    reciters?: CatalogueRow[];
    total?: number;
    page?: number;
    range?: number;
  };
  if (!Array.isArray(body.reciters)) throw new Error('catalogue payload is not a list');

  // Cache only the first page for backward compatibility
  if (page === DEFAULT_PAGE) {
    writeCache(body.reciters);
  }
  return {
    reciters: toReciters(body.reciters),
    total: body.total ?? body.reciters.length,
    page: body.page ?? page,
    range: body.range ?? range,
  };
}

async function fetchRoster(): Promise<Reciter[]> {
  const result = await fetchRosterPage(DEFAULT_PAGE, DEFAULT_RANGE);
  return result.reciters;
}

export function useReciters(): {
  reciters: Reciter[];
  error: boolean;
  retry: () => void;
  loadMore: () => void;
  loading: boolean;
  hasMore: boolean;
  page: number;
} {
  const [reciters, setReciters] = useState<Reciter[]>(readCache);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [total, setTotal] = useState<number | null>(null);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const loadingRef = useRef(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadingRef.current = true;
    pending ??= fetchRoster();
    void pending.then(
      (list) => {
        if (!live) return;
        setReciters((prev) => {
          // If we already have items from pagination, don't overwrite
          if (prev.length > 0 && page > DEFAULT_PAGE) {
            return prev;
          }
          return list;
        });
        setError(false);
        setLoading(false);
        loadingRef.current = false;
      },
      () => {
        if (!live) return;
        setError(true);
        setLoading(false);
        loadingRef.current = false;
        // A failed fetch must not be memoised, or retry would resolve instantly.
        pending = null;
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || error) return;
    if (total !== null && reciters.length >= total) return;

    setLoading(true);
    loadingRef.current = true;
    const nextPage = page + 1;

    try {
      const result = await fetchRosterPage(nextPage, range);
      setReciters((prev) => [...prev, ...result.reciters]);
      setPage(nextPage);
      if (total === null) {
        setTotal(result.total);
      }
      setRange(result.range);
      setError(false);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [page, range, total, reciters.length, error]);

  const retry = useCallback(() => {
    pending = null;
    setError(false);
    setReciters(readCache());
    setPage(DEFAULT_PAGE);
    setTotal(null);
    setLoading(false);
    loadingRef.current = false;
    setAttempt((value) => value + 1);
  }, []);

  const hasMore = total !== null ? reciters.length < total : true;

  return { reciters, error, retry, loadMore, loading, hasMore, page };
}
