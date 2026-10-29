import { useEffect, useMemo, useState } from 'react';

/**
 * Four routes, in the hash. `#/about` rather than `/about` because the app is a
 * static bundle served by nginx: a hash never reaches the server, so a reload on
 * any route keeps working without a rewrite rule — and the `<audio>` element
 * lives outside the routed view, so navigation never stops playback.
 *
 * The query travels in the hash too (`#/?view=favorites`), for the same reason:
 * the install shortcut that opens the listener's own list must survive a reload
 * without nginx knowing anything about it.
 */
export const ROUTES = ['/', '/settings', '/about', '/privacy'] as const;
export type Route = (typeof ROUTES)[number];

export const DEFAULT_ROUTE: Route = '/';

/** Unknown or empty hashes fall back to the player rather than a blank page. */
export function routeFromHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0];
  const normalised = path === '' ? DEFAULT_ROUTE : path.startsWith('/') ? path : `/${path}`;
  const match = ROUTES.find((route) => route === normalised);
  return match ?? DEFAULT_ROUTE;
}

/** `#/settings?x=1` → `x=1`. Only the hash is read; the real search is empty. */
export function paramsFromHash(hash: string): URLSearchParams {
  const index = hash.indexOf('?');
  return new URLSearchParams(index === -1 ? '' : hash.slice(index + 1));
}

export function useHashRoute(): { route: Route; navigate: (route: Route) => void; params: URLSearchParams } {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  );

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  // Stable per hash: an effect that reads `params` must not re-run on every
  // render, and every navigation changes the hash anyway.
  const params = useMemo(() => paramsFromHash(hash), [hash]);

  const navigate = (next: Route) => {
    if (window.location.hash === `#${next}`) return;
    window.location.hash = next;
  };

  return { route: routeFromHash(hash), navigate, params };
}
