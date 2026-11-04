import type { AppRole } from './nav';

/**
 * Picking up where the console left off.
 *
 * The console is URL-driven, so "the page I was on" is already a path — the only
 * question is which stored paths are safe to reopen. A path is restored only if
 * it names a screen that exists, one the signed-in role may open, and carries no
 * query or fragment: a token link or a provider callback must never come back
 * from storage.
 *
 * It is a preference, not an account fact: this browser remembers this screen.
 */
export const LAST_PATH_KEY = 'tilawa.console.path';

/** Every first segment the shell can render. */
const SCREENS = new Set([
  'seeders',
  'turns',
  'torrents',
  'reciters',
  'account',
  'tools',
  'status',
  'usage',
  'settings',
  'admin',
  'superadmin',
  'help',
]);

/** Screens that only an operator may open; a plain user lands on Seeders instead. */
const OPERATOR_ONLY = new Set(['usage', 'settings', 'admin', 'superadmin']);

/** One path segment: a slug or an id, never a query, a fragment, or a scheme. */
const SEGMENT = /^[A-Za-z0-9_-]+$/;

function consoleSegments(path: string): string[] | null {
  if (!path.startsWith('/console/')) return null;
  const segments = path.slice('/console/'.length).split('/');
  if (segments.some((segment) => !SEGMENT.test(segment))) return null;
  if (!SCREENS.has(segments[0])) return null;
  return segments;
}

/** The path to reopen for this role, or null when the stored one is not safe. */
export function restorablePath(stored: string | null, role: AppRole | null): string | null {
  if (!stored) return null;
  const segments = consoleSegments(stored);
  if (!segments) return null;
  if (OPERATOR_ONLY.has(segments[0]) && role !== 'admin' && role !== 'super_admin') return null;
  return `/console/${segments.join('/')}`;
}

/** The path worth remembering, or null when this page should not be reopened. */
export function rememberablePath(path: string): string | null {
  const segments = consoleSegments(path);
  return segments ? `/console/${segments.join('/')}` : null;
}

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

export function readLastPath(storage: Reader = window.localStorage): string | null {
  try {
    return storage.getItem(LAST_PATH_KEY);
  } catch {
    return null;
  }
}

export function writeLastPath(path: string, storage: Writer = window.localStorage): void {
  try {
    storage.setItem(LAST_PATH_KEY, path);
  } catch {
    // The session still works; only the memory of where it was is lost.
  }
}
