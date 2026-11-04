/**
 * The tab a screen was left on, kept per screen and per browser.
 *
 * A preference, like the fold state: it belongs to this device, so it lives in
 * localStorage next to the theme — no request, no schema. One key per screen so
 * two tablists cannot overwrite each other, and a value this build no longer
 * knows falls back to the screen's own default instead of opening nothing.
 */
const PREFIX = 'tilawa.tab.';

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

export function readTab<T extends string>(
  screen: string,
  allowed: readonly T[],
  fallback: T,
  storage: Reader = window.localStorage,
): T {
  try {
    const raw = storage.getItem(`${PREFIX}${screen}`);
    // The stored string is someone else's data: only an id the screen still
    // offers is allowed through.
    return allowed.find((id) => id === raw) ?? fallback;
  } catch {
    // Private mode, disabled storage, or a value written by an older build.
    return fallback;
  }
}

export function writeTab(screen: string, id: string, storage: Writer = window.localStorage): void {
  try {
    storage.setItem(`${PREFIX}${screen}`, id);
  } catch {
    // The tab still applies to this session; only the memory is lost.
  }
}
