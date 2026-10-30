import { STORAGE_KEYS } from '@/utils/storage-keys';

const FAVORITES_KEY = STORAGE_KEYS.favorites;
const COUNTED_PREFIX = STORAGE_KEYS.countedPrefix;

function readList(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // private mode / quota — the in-memory atom still works for this session
  }
}

/** The local mirror. Present for anonymous visitors and as the offline cache. */
export function readLocalFavorites(): string[] {
  return readList(FAVORITES_KEY);
}

export function writeLocalFavorites(list: string[]): void {
  writeList(FAVORITES_KEY, Array.from(new Set(list)));
}

/**
 * Which ids this identity has already contributed to the public counter.
 * Without it, a second device would add a second favourite for the same person.
 */
export function readCounted(identity: string): Set<string> {
  return new Set(readList(`${COUNTED_PREFIX}${identity}`));
}

export function writeCounted(identity: string, ids: Set<string>): void {
  writeList(`${COUNTED_PREFIX}${identity}`, Array.from(ids));
}
