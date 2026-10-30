import { STORAGE_KEYS } from '@/utils/storage-keys';

const RECENT_KEY = STORAGE_KEYS.recent;
const LIMIT = 10;

export type RecentEntry = { id: string; at: number };

function readRaw(): RecentEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentEntry =>
        Boolean(entry) &&
        typeof (entry as RecentEntry).id === 'string' &&
        typeof (entry as RecentEntry).at === 'number',
    );
  } catch {
    return [];
  }
}

function writeRaw(list: RecentEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // private mode: the in-memory atom still works for this session
  }
}

/**
 * Newest first, one entry per reciter, capped at ten. A repeat listen moves the
 * reciter back to the front instead of adding a second row.
 */
export function normaliseRecent(entries: RecentEntry[]): RecentEntry[] {
  const byId = new Map<string, number>();
  for (const entry of entries) {
    const seen = byId.get(entry.id) ?? 0;
    if (entry.at > seen) byId.set(entry.id, entry.at);
  }
  return [...byId.entries()]
    .map(([id, at]) => ({ id, at }))
    .sort((a, b) => b.at - a.at)
    .slice(0, LIMIT);
}

export function readRecent(): RecentEntry[] {
  return normaliseRecent(readRaw());
}

export function writeRecent(entries: RecentEntry[]): RecentEntry[] {
  const normalised = normaliseRecent(entries);
  writeRaw(normalised);
  return normalised;
}

/** Folds a second device's history into this one, newest stamp wins. */
export function mergeRecent(a: RecentEntry[], b: RecentEntry[]): RecentEntry[] {
  return normaliseRecent([...a, ...b]);
}

export function rememberReciter(id: string | number, at: number = Date.now()): RecentEntry[] {
  return writeRecent([{ id: String(id), at }, ...readRecent()]);
}

export const RECENT_LIMIT = LIMIT;
