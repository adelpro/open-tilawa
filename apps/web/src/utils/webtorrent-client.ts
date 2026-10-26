import type { Instance } from 'webtorrent';

import { rtcConfig } from '@/constants';
import { whenWorkerReady } from '@/utils/sw-registration';

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

// One registration for the whole app, installed at startup (see
// utils/sw-registration). This module only has to wait for it: `createServer()`
// needs the registration object, and file.streamURL does not exist without it.
export function getWebTorrentClient(): Promise<Instance> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const WebTorrent = window.WebTorrent;
      if (!WebTorrent) throw new Error('WebTorrent is not loaded');

      const client = new WebTorrent({ tracker: { rtcConfig } }) as Instance;

      // `file.streamURL` throws until a server exists, so this must happen
      // before any torrent is added.
      const registration = await whenWorkerReady();
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
