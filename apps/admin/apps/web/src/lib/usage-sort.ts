import type { Sort, SortDir } from './usage-filters';

/**
 * Which column each Usage table was last sorted by, kept per browser.
 *
 * One key for the whole page, like the fold state: a single read on mount and a
 * single write per click. A stored key this build no longer draws falls back to
 * that table's own default, so an older build cannot leave a table unsorted.
 */
export const STORAGE_KEY = 'tilawa.usage.sorts';

export const USAGE_SORT_TABLES = [
  'surahs',
  'reciters',
  'versions',
  'errors',
  'volume',
] as const;

export type UsageSortTable = (typeof USAGE_SORT_TABLES)[number];

export type UsageSorts = Record<UsageSortTable, Sort>;

export const DEFAULT_USAGE_SORTS: UsageSorts = {
  surahs: { key: 'plays', dir: 'desc' },
  reciters: { key: 'plays', dir: 'desc' },
  versions: { key: 'version', dir: 'desc' },
  errors: { key: 'at', dir: 'desc' },
  volume: { key: 'served', dir: 'desc' },
};

/** Only keys a comparator in `Usage.tsx` actually handles. */
export const USAGE_SORT_KEYS: Record<UsageSortTable, readonly string[]> = {
  surahs: ['surah', 'plays', 'completes', 'bytes'],
  reciters: ['reciter', 'plays'],
  versions: ['version', 'errors', 'plays', 'rate'],
  errors: ['at', 'version', 'reciter', 'surah', 'errorCode'],
  volume: ['reciter', 'serverBytes', 'torrentBytes', 'served'],
};

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

function isDir(value: unknown): value is SortDir {
  return value === 'asc' || value === 'desc';
}

export function readSorts(storage: Reader = window.localStorage): UsageSorts {
  const result = { ...DEFAULT_USAGE_SORTS };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return result;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return result;
    const value = parsed as Record<string, unknown>;
    for (const table of USAGE_SORT_TABLES) {
      const entry = value[table];
      if (typeof entry !== 'object' || entry === null) continue;
      const candidate = entry as Record<string, unknown>;
      if (USAGE_SORT_KEYS[table].includes(String(candidate.key)) && isDir(candidate.dir)) {
        result[table] = { key: String(candidate.key), dir: candidate.dir };
      }
    }
  } catch {
    // A corrupt or unreadable value opens every table on its default.
  }
  return result;
}

export function writeSort(
  table: UsageSortTable,
  sort: Sort,
  storage: Partial<Reader & Writer> = window.localStorage,
): void {
  try {
    const current = readSorts({ getItem: (key) => storage.getItem?.(key) ?? null });
    storage.setItem?.(STORAGE_KEY, JSON.stringify({ ...current, [table]: sort }));
  } catch {
    // The order still applies to this session; only the memory is lost.
  }
}
