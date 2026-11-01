/**
 * Which sign-in method this browser used last.
 *
 * A convenience, not an account fact: it lives in localStorage next to the theme
 * and the folded panels, never reaches the server, and is per device. "Recently
 * used" on a shared browser is still true — it was recently used there.
 *
 * The value is written in two places because sign-in ends in two places: the
 * password form finishes in this tab, while a provider ends with a redirect, so
 * the callback carries `?auth=<provider>` and App records it on boot.
 */
export const LAST_AUTH_KEY = 'tilawa.last-auth';

export const AUTH_METHODS = ['local', 'google', 'github'] as const;

export type AuthMethod = (typeof AUTH_METHODS)[number];

export function isAuthMethod(value: unknown): value is AuthMethod {
  return typeof value === 'string' && (AUTH_METHODS as readonly string[]).includes(value);
}

export function readLastAuth(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): AuthMethod | null {
  try {
    const value = storage.getItem(LAST_AUTH_KEY);
    return isAuthMethod(value) ? value : null;
  } catch {
    // Private mode, a full quota, a disabled store: the label is not worth an error.
    return null;
  }
}

export function writeLastAuth(
  method: AuthMethod,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  try {
    storage.setItem(LAST_AUTH_KEY, method);
  } catch {
    // The label still applies to this page; only the memory is lost.
  }
}

/**
 * Record a provider sign-in from the callback's `?auth=` and take it out of the
 * URL, so a refresh or a bookmark does not carry it.
 *
 * An unknown value is stripped too — it is a stray parameter, not a method — and
 * nothing is written for it.
 */
export function rememberAuthFromUrl(
  href: string = window.location.href,
  history: Pick<History, 'replaceState'> = window.history,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): AuthMethod | null {
  const url = new URL(href, 'http://localhost');
  if (!url.searchParams.has('auth')) return null;

  const raw = url.searchParams.get('auth');
  url.searchParams.delete('auth');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

  if (!isAuthMethod(raw)) return null;
  writeLastAuth(raw, storage);
  return raw;
}
