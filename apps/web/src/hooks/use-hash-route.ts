import { useEffect, useState } from 'react';

/**
 * Three routes, in the hash. `#/about` rather than `/about` because the app is a
 * static bundle served by nginx: a hash never reaches the server, so a reload on
 * any route keeps working without a rewrite rule — and the `<audio>` element
 * lives outside the routed view, so navigation never stops playback.
 */
export const ROUTES = ['/', '/about', '/privacy'] as const;
export type Route = (typeof ROUTES)[number];

export const DEFAULT_ROUTE: Route = '/';

/** Unknown or empty hashes fall back to the player rather than a blank page. */
export function routeFromHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0];
  const normalised = path === '' ? DEFAULT_ROUTE : path.startsWith('/') ? path : `/${path}`;
  const match = ROUTES.find((route) => route === normalised);
  return match ?? DEFAULT_ROUTE;
}

export function useHashRoute(): { route: Route; navigate: (route: Route) => void } {
  const [route, setRoute] = useState<Route>(() =>
    routeFromHash(typeof window === 'undefined' ? '' : window.location.hash),
  );

  useEffect(() => {
    const onChange = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (next: Route) => {
    if (window.location.hash === `#${next}`) return;
    window.location.hash = next;
  };

  return { route, navigate };
}
