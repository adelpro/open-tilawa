import type { Instance } from 'webtorrent';

import { rtcConfig } from '@/constants';

/**
 * One WebTorrent client per page, created once and reused.
 *
 * `client.createServer()` may only be called once per client, and every browser
 * server attaches its own listener to `navigator.serviceWorker`. Creating a
 * client per playback attempt (the old behaviour) left orphan clients behind and
 * made two servers answer the same streaming request, so the client and its
 * service worker are module-level state now.
 */
let clientPromise: Promise<Instance> | undefined;

// In dev, vite-plugin-pwa serves the worker (with HMR) from this URL instead of
// the built /sw.js. In production /sw.js is the generated worker.
const SERVICE_WORKER_URL = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js';

async function registerStreamingWorker(): Promise<
  ServiceWorkerRegistration | undefined
> {
  if (!('serviceWorker' in navigator)) return undefined;

  try {
    // In dev the worker is served as an ES module; the built one is a classic
    // script.
    const options: RegistrationOptions = import.meta.env.DEV
      ? { scope: '/', type: 'module' }
      : { scope: '/' };

    const registration = await navigator.serviceWorker.register(
      SERVICE_WORKER_URL,
      options,
    );
    // Cap the wait: a worker stuck in activation must not hang playback.
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
    return registration;
  } catch (error) {
    console.error('WebTorrent service worker registration failed:', error);
    return undefined;
  }
}

export function getWebTorrentClient(): Promise<Instance> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const WebTorrent = window.WebTorrent;
      if (!WebTorrent) throw new Error('WebTorrent is not loaded');

      const client = new WebTorrent({ tracker: { rtcConfig } }) as Instance;

      // `file.streamURL` throws until a server exists, so this must happen
      // before any torrent is added.
      const registration = await registerStreamingWorker();
      if (registration?.active) {
        try {
          (client as any).createServer({ controller: registration });
        } catch (error) {
          console.error('WebTorrent server creation failed:', error);
        }
      }

      return client;
    })();

    // Do not cache a failed construction — the next playback attempt retries.
    clientPromise.catch(() => {
      clientPromise = undefined;
    });
  }

  return clientPromise;
}

/** True when the browser server is up, i.e. `file.streamURL` is usable. */
export function hasStreamingServer(client: Instance): boolean {
  return Boolean((client as any)._server);
}
