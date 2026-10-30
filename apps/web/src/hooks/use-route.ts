import { useCallback, useEffect, useMemo, useState } from 'react';

import { legacyHashToPath, parse, toPath, type Parsed } from '@/routes';

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
export function useRoute(): {
  route: Parsed;
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

  const route = useMemo(() => parse(url), [url]);
  const params = useMemo(() => new URLSearchParams(url.split('?')[1] ?? ''), [url]);

  const navigate = useCallback((next: Parsed, mode: 'push' | 'replace' = 'push') => {
    const target = toPath(next);
    if (target === `${window.location.pathname}${window.location.search}`) return;
    if (mode === 'replace') window.history.replaceState({}, '', target);
    else window.history.pushState({}, '', target);
    // `pushState` does not fire `popstate`; the router would otherwise never hear it.
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return { route, navigate, params };
}
