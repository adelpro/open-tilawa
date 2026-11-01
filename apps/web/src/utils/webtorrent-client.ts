import type { Instance } from 'webtorrent';

import { rtcConfig } from '@/constants';
import { sharesPieces } from '@/utils/seed-preference';
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
/** The running client, so a changed preference can reach it without an add. */
let liveClient: Instance | undefined;

/**
 * Stop or resume uploading on the client that is already running.
 *
 * With no client there is nothing to throttle, and building one here would start
 * the streaming server for a listener who is only changing a setting: the
 * preference is read again at creation instead.
 */
export function applySharing(allowed: boolean): void {
  if (!liveClient) return;
  const client = liveClient as unknown as { throttleUpload?: (rate: number) => void };
  try {
    client.throttleUpload?.(allowed ? -1 : 0);
  } catch (error) {
    console.warn('upload throttle rejected', error);
  }
}

// One registration for the whole app, installed at startup (see
// utils/sw-registration). This module only has to wait for it: `createServer()`
// needs the registration object, and file.streamURL does not exist without it.
export function getWebTorrentClient(): Promise<Instance> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const WebTorrent = window.WebTorrent;
      if (!WebTorrent) throw new Error('WebTorrent is not loaded');

      const client = new WebTorrent({
        tracker: { rtcConfig },
        // Sharing is the default; a listener who turned it off starts at zero.
        uploadLimit: sharesPieces() ? -1 : 0,
      }) as Instance;
      liveClient = client;

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
