/**
 * The usage screen's arithmetic, with no React in it.
 *
 * Sorting is a header click and a comparator — the same shape `Reciters` and
 * `Torrents` use — and the request is a query string. Neither needs a browser, so
 * both live here where a unit test can hold them.
 */

export type SortDir = 'asc' | 'desc';
export type Sort = { key: string; dir: SortDir };

export type SummaryFilters = {
  source?: string;
  version?: string;
  reciter?: string;
};

/**
 * A click on a column header.
 *
 * Same column: flip. New column: ascending, because that is what every other table
 * in the console does and two behaviours for one gesture is a bug with a delay.
 */
export function nextSort(current: Sort, key: string): Sort {
  return current.key === key
    ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: 'asc' };
}

/**
 * The rows in the requested order, as a new array.
 *
 * Ties keep the order they arrived in (Array#sort is stable), so re-rendering a
 * table whose counts are equal cannot reshuffle it under the reader's cursor.
 */
export function sortRows<T>(
  rows: readonly T[],
  comparators: Record<string, (a: T, b: T) => number>,
  sort: Sort,
): T[] {
  const compare = comparators[sort.key];
  if (!compare) return [...rows];
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => compare(a, b) * dir);
}

/**
 * `/admin/telemetry/summary?days=…` for the current window and filters.
 *
 * Order is fixed (source, version, reciter) so the request is the same string for
 * the same state, and an unset filter is omitted rather than sent as an empty
 * value the API would then have to guess about.
 */
export function summaryQuery(days: number, filters: SummaryFilters = {}): string {
  const params = new URLSearchParams({ days: String(days) });
  if (filters.source) params.set('source', filters.source);
  if (filters.version) params.set('version', filters.version);
  if (filters.reciter) params.set('reciter', filters.reciter);
  return `/admin/telemetry/summary?${params.toString()}`;
}
