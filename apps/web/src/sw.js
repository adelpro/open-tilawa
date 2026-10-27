/* eslint-disable no-restricted-globals */
/**
 * The app's single service worker, built by vite-plugin-pwa (injectManifest).
 *
 * Two responsibilities share this file because a browser allows only one
 * service worker per scope (`/`):
 *   1. PWA: precache the built app and serve navigations from the precache.
 *   2. WebTorrent: answer `/webtorrent/<infoHash>/<file>` range requests from
 *      torrent pieces, which is what `file.streamURL` points at.
 *
 * The WebTorrent part is imported first so its listener gets the first chance to
 * respond. The two never fight over a request: WebTorrent only claims
 * `/webtorrent/*`, Workbox only claims precached URLs and navigations.
 */
import './service-worker/webtorrent.js';

import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  precacheAndRoute,
  PrecacheFallbackPlugin,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

self.skipWaiting();
clientsClaim();

// Only the shell is precached, and only the shell has to succeed for the worker
// to activate. Everything else is cached the first time it is used.
const SHELL = /\.(js|css|html|ico|webmanifest)$/;
precacheAndRoute(self.__WB_MANIFEST.filter((entry) => SHELL.test(entry.url)));
cleanupOutdatedCaches();

/**
 * Navigations go to the network first, and fall back to the precached shell
 * only when it is unreachable.
 *
 * Serving `index.html` straight from the precache — the previous behaviour —
 * pinned every client to the HTML of the build that installed the worker, and
 * that HTML references that build's hashed bundles. A client whose worker never
 * updated therefore kept running a months-old app, and the only cure was
 * clearing site data by hand. Two seconds of network wait is the price of a
 * deploy actually reaching people; offline still works through the fallback.
 */
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'app-shell',
      networkTimeoutSeconds: 2,
      plugins: [new PrecacheFallbackPlugin({ fallbackURL: 'index.html' })],
    }),
  ),
);

// Fonts, the logo, the WebTorrent bundle: warm after first use, never a reason
// to fail an install. Torrent ranges, the torrent files and the web-seed payload
// are left alone: the WebTorrent handler owns the first, and `/media` answers
// 206s that the Cache API refuses to store (and a cached full file would poison
// every range request that followed).
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.destination !== 'document' &&
    !url.pathname.startsWith('/webtorrent/') &&
    !url.pathname.startsWith('/torrents/') &&
    !url.pathname.startsWith('/media/'),
  new StaleWhileRevalidate({ cacheName: 'app-runtime' }),
);
