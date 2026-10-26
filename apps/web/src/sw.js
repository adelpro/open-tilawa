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

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA shell for every navigation; the app routes client-side.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
