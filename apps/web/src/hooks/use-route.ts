import { useCallback, useEffect, useMemo, useState } from 'react';

import { legacyHashToPath, parseUrl, toUrl, type Parsed, type UrlLocale } from '@/routes';

/**
 * The path, and the three things a page needs to act on it.
 *
 * The router is `popstate` plus `pushState` — a dozen routes, two parameter shapes and no
 * data loaders. Sheets keep their own history entry through `utils/sheet-layer.ts`; the two
 * must not both push, or Back closes a panel and changes the page at once.
 *
 * On the first mount it rewrites a hash URL to its path form, so an installed shortcut or a
 * bookmark from before the move still lands on the page it named.
 */
/**
 * Navigation as a plain function, so a link does not need a hook to change the page.
 * `pushState` does not fire `popstate`, so the event is dispatched by hand — the router
 * hears it either way, and `sheet-layer` sees no change it did not make itself.
 *
 * The language comes from the address unless the caller names one: moving between
 * screens must not be how a listener loses the language they were reading.
 */
export function navigate(
  next: Parsed,
  mode: 'push' | 'replace' = 'push',
  locale?: UrlLocale,
): void {
  const target = hrefFor(next, locale);
  if (target === `${window.location.pathname}${window.location.search}`) return;
  if (mode === 'replace') window.history.replaceState({}, '', target);
  else window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * The address a route should carry, in the language this page is in.
 *
 * A link's `href` has to agree with where the click goes, or "open in a new tab"
 * lands on the Arabic page the router would never have taken you to.
 */
export function hrefFor(route: Parsed, locale?: UrlLocale): string {
  if (typeof window === 'undefined') return toUrl(route, locale ?? 'ar');
  return toUrl(route, locale ?? parseUrl(window.location.pathname).locale);
}

export function useRoute(): {
  route: Parsed;
  /** The language the address is in, which is not the same thing as the one chosen. */
  locale: UrlLocale;
  navigate: (next: Parsed, mode?: 'push' | 'replace') => void;
  params: URLSearchParams;
} {
  const [url, setUrl] = useState(() =>
    typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`,
  );

  useEffect(() => {
    const migrated = legacyHashToPath(window.location.hash);
    if (migrated) {
      window.history.replaceState({}, '', migrated);
      setUrl(`${window.location.pathname}${window.location.search}`);
    }

    const onChange = (): void => setUrl(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);

  const route = useMemo(() => parseUrl(url).route, [url]);
  const locale = useMemo(() => parseUrl(url).locale, [url]);
  const params = useMemo(() => new URLSearchParams(url.split('?')[1] ?? ''), [url]);

  return { route, locale, navigate, params };
}
