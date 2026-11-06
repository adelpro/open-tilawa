import { useCallback, useEffect, useRef, useState } from 'react';

import type { Reciter } from '@/types';
import { toReciters, type CatalogueRow } from '@/utils/catalogue';
import { sortByArabicName } from '@/utils/reciter-order';

/**
 * The reciter roster, served by the admin catalogue.
 *
 * Two readers want different shapes of the same list. The app itself — boot
 * restore, `/listen` deep links, the reciter page, the searchable picker — needs
 * the whole roster: a stored reciter on row twelve must still be found, and a
 * search must reach what it has not scrolled to. Only the two browsing surfaces
 * (`/reciters` and the sheet's long list) can afford to arrive a page at a time.
 *
 * That split is the fix for a real defect: pagination was added to the sheet and
 * every other consumer silently kept assuming the roster was complete, so a
 * reciter past row ten could not be restored, deep-linked, or rendered.
 *
 * The full roster is the cached one (`tilawa.reciters.v1`); the paged reader does
 * not write a partial list into that cache.
 */

const ADMIN_API =
  (import.meta as { env?: Record<string, string> }).env?.VITE_ADMIN_API_URL ||
  'https://console.tilawah.cc';

const CACHE_KEY = 'tilawa.reciters.v1';
const DEFAULT_PAGE = 1;
const DEFAULT_RANGE = 10;
/** The page size used to pull the whole roster; the API has no "all". */
const FULL_RANGE = 200;

interface CataloguePage {
  rows: CatalogueRow[];
  total: number;
  page: number;
  range: number;
}

let pendingFull: Promise<Reciter[]> | null = null;
let pendingFirstPage: Promise<CataloguePage> | null = null;

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

async function fetchPage(
  page: number = DEFAULT_PAGE,
  range: number = DEFAULT_RANGE,
): Promise<CataloguePage> {
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

  return {
    rows: body.reciters,
    total: body.total ?? body.reciters.length,
    page: body.page ?? page,
    range: body.range ?? range,
  };
}

/**
 * Every published row, a page at a time.
 *
 * The API's `range` is a maximum, not a guarantee: a future catalogue could outgrow
 * one request. Following `total` keeps the roster complete without hard-coding the
 * current twelve.
 */
async function fetchAll(): Promise<Reciter[]> {
  const rows: CatalogueRow[] = [];
  for (let page = 1; page <= 25; page += 1) {
    const result = await fetchPage(page, FULL_RANGE);
    rows.push(...result.rows);
    if (result.rows.length === 0 || rows.length >= result.total) break;
  }
  writeCache(rows);
  return toReciters(rows);
}

/** Keep the later copy of a row and drop the duplicate a page boundary can repeat. */
function mergeUnique(current: Reciter[], incoming: Reciter[]): Reciter[] {
  const byId = new Map<number, Reciter>();
  for (const reciter of current) byId.set(reciter.id, reciter);
  for (const reciter of incoming) byId.set(reciter.id, reciter);
  return sortByArabicName([...byId.values()], (reciter) => reciter.name);
}

/**
 * The complete roster. This is what the app's own navigation uses: the picker's
 * search, boot restore, deep links and the reciter page.
 */
export function useReciters(): {
  reciters: Reciter[];
  error: boolean;
  retry: () => void;
} {
  const [reciters, setReciters] = useState<Reciter[]>(readCache);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    pendingFull ??= fetchAll();
    void pendingFull.then(
      (list) => {
        if (!live) return;
        setReciters(list);
        setError(false);
      },
      () => {
        if (!live) return;
        setError(true);
        // A failed fetch must not be memoised, or retry would resolve instantly.
        pendingFull = null;
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    pendingFull = null;
    setError(false);
    setReciters(readCache());
    setAttempt((value) => value + 1);
  }, []);

  return { reciters, error, retry };
}

/**
 * The browsing feed: one page at a time, with `loadMore` for the sentinel.
 *
 * Deliberately separate from `useReciters`: a page is not the roster, and callers
 * that need to find an arbitrary reciter must not be handed one.
 */
export function useReciterPages(): {
  reciters: Reciter[];
  error: boolean;
  retry: () => void;
  loadMore: () => void;
  loading: boolean;
  hasMore: boolean;
  page: number;
} {
  const [reciters, setReciters] = useState<Reciter[]>(() => readCache().slice(0, DEFAULT_RANGE));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The first page is fetched on mount, so the sentinel must not be armed before
  // it lands: `hasMore` is true while `total` is unknown, and a visible sentinel
  // would ask for page two while page one is still in flight.
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [total, setTotal] = useState<number | null>(null);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [exhausted, setExhausted] = useState(false);
  const loadingRef = useRef(false);
  const pageRef = useRef(DEFAULT_PAGE);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loadingRef.current = true;
    pendingFirstPage ??= fetchPage(DEFAULT_PAGE, DEFAULT_RANGE);
    void pendingFirstPage.then(
      (result) => {
        if (!live) return;
        setReciters((prev) => {
          // A page already loaded means the reader is past page one; do not reset.
          if (pageRef.current > DEFAULT_PAGE) return prev;
          return toReciters(result.rows);
        });
        setTotal(result.total);
        setRange(result.range);
        setError(false);
        setLoading(false);
        loadingRef.current = false;
      },
      () => {
        if (!live) return;
        setError(true);
        setLoading(false);
        loadingRef.current = false;
        pendingFirstPage = null;
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || error || exhausted) return;
    if (total !== null && reciters.length >= total) return;

    setLoading(true);
    loadingRef.current = true;
    const nextPage = page + 1;

    try {
      const result = await fetchPage(nextPage, range);
      // An empty page is the end, whatever `total` claims. `toReciters` drops a
      // row without a magnet or a duplicate infohash; without this guard the
      // difference between `total` and the rendered rows would make the sentinel
      // ask for that page forever.
      if (result.rows.length === 0) setExhausted(true);
      // A page arrives in catalogue order, so the merge is re-sorted: appending
      // would leave the alphabetical default broken from the eleventh row on.
      setReciters((prev) => mergeUnique(prev, toReciters(result.rows)));
      setPage(nextPage);
      pageRef.current = nextPage;
      setTotal(result.total);
      setRange(result.range);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [page, range, total, reciters.length, error, exhausted]);

  const retry = useCallback(() => {
    pendingFirstPage = null;
    setError(false);
    setReciters(readCache().slice(0, DEFAULT_RANGE));
    setPage(DEFAULT_PAGE);
    pageRef.current = DEFAULT_PAGE;
    setTotal(null);
    setExhausted(false);
    setLoading(true);
    loadingRef.current = true;
    setAttempt((value) => value + 1);
  }, []);

  const hasMore = !exhausted && (total !== null ? reciters.length < total : true);

  return { reciters, error, retry, loadMore, loading, hasMore, page };
}
