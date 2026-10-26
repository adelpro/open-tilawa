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
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

self.skipWaiting();
clientsClaim();

// Only the shell is precached, and only the shell has to succeed for the worker
// to activate. Everything else is cached the first time it is used.
const SHELL = /\.(js|css|html|ico|webmanifest)$/;
precacheAndRoute(self.__WB_MANIFEST.filter((entry) => SHELL.test(entry.url)));
cleanupOutdatedCaches();

// SPA shell for every navigation; the app routes client-side.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Fonts, the logo, the WebTorrent bundle: warm after first use, never a reason
// to fail an install. Torrent ranges and the torrent files are left alone — the
// WebTorrent handler above owns those.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.destination !== 'document' &&
    !url.pathname.startsWith('/webtorrent/') &&
    !url.pathname.startsWith('/torrents/'),
  new StaleWhileRevalidate({ cacheName: 'app-runtime' }),
);
