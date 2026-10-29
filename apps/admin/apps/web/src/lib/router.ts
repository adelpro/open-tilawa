import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

/**
 * Routing without a routing library.
 *
 * The console has a dozen screens, no nested layouts and no data loaders on
 * navigation, so `history.pushState` plus `popstate` is the whole requirement —
 * and it keeps the bundle at React and nothing else. `BASE` is where the edge
 * mounts the SPA.
 */
export const BASE = '/console';

function normalise(pathname: string): string {
  if (!pathname.startsWith(BASE)) return pathname === '/' ? BASE : pathname;
  return pathname;
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const target = to.startsWith(BASE) ? to : `${BASE}${to.startsWith('/') ? '' : '/'}${to}`;
  if (options.replace) window.history.replaceState({}, '', target);
  else window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRouter(): {
  path: string;
  segments: string[];
  navigate: typeof navigate;
} {
  const [path, setPath] = useState(() => normalise(window.location.pathname));

  useEffect(() => {
    const onChange = (): void => setPath(normalise(window.location.pathname));
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);

  // Segments after the base, so a screen can read its own parameters:
  // `/console/profiles/7` → ["profiles", "7"].
  //
  // The base is stripped only when it is there. Mail links point at
  // `/reset-password/<token>` and `/activate/<token>` — off the console mount on
  // purpose, because those tokens arrive before anyone is signed in — and slicing
  // ten characters off a path that never had them produced garbage segments, so
  // both links landed on the sign-in screen with the token thrown away.
  const tail = path.startsWith(BASE) ? path.slice(BASE.length) : path;
  const segments = tail.split('/').filter(Boolean);

  const go = useCallback(navigate, []);
  return { path, segments, navigate: go };
}

/** A link that keeps the SPA's history intact but still looks like a link. */
export function linkProps(to: string): {
  href: string;
  onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
} {
  const href = to.startsWith(BASE) ? to : `${BASE}${to}`;
  return {
    href,
    onClick: (event) => {
      // Modified clicks (new tab, download) are left to the browser.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      navigate(to);
    },
  };
}
