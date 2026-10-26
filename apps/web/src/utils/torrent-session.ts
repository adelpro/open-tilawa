import type { Instance, Torrent } from 'webtorrent';

/**
 * The one live torrent, owned by the client rather than by a React component.
 *
 * The WebTorrent client is a module singleton, but `useTorrent` has three
 * consumers on the same screen (the player, the reciter selector, the info
 * dialog). While each of them owned the add, the second consumer asked the
 * client for a torrent it already held and WebTorrent answered
 * "Cannot add duplicate torrent <hash>". A session keyed by infohash makes the
 * add idempotent: whoever asks first creates it, everyone else is handed the
 * same object, and switching reciter replaces it once.
 */

export interface TorrentSession {
  infoHash: string;
  torrent: Torrent;
}

export interface OpenOptions {
  infoHash: string;
  /** Already normalised by `updateMagnetURI` — trackers merged, encoding fixed. */
  magnet: string;
  announce?: string[];
  /** The retry button: rebuild even when the same torrent is live. */
  force?: boolean;
}

/** A wedged destroy must not hold the queue forever. */
const DESTROY_TIMEOUT_MS = 5_000;

let active: TorrentSession | null = null;
/** Opens are serialised: two consumers may race, and destroy-then-add must not. */
let queue: Promise<unknown> = Promise.resolve();

/** Test seam: forget the live session without touching the client. */
export function __resetTorrentSession(): void {
  active = null;
  queue = Promise.resolve();
}

function destroyTorrent(torrent: Torrent): Promise<void> {
  /** `destroyed` is set at runtime but missing from the shipped types. */
  const live = torrent as unknown as { destroyed?: boolean };
  return new Promise((resolve) => {
    if (!torrent || live.destroyed) return resolve();
    const done = () => resolve();
    torrent.once('close', done);
    const timer = setTimeout(done, DESTROY_TIMEOUT_MS);
    try {
      torrent.destroy();
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

/** The `.torrent` file first: it carries metadata, so no peers are needed. */
async function addTorrent(client: Instance, options: OpenOptions): Promise<Torrent> {
  const addOptions = { announce: options.announce, deselect: true };
  try {
    const response = await fetch(`/torrents/${options.infoHash}.torrent`);
    if (response.ok) {
      const blob = await response.blob();
      return client.add(blob as never, addOptions as never) as unknown as Torrent;
    }
  } catch {
    // No .torrent beside the app (or no fetch): the magnet does the same job
    // once a peer answers.
  }
  return client.add(options.magnet, addOptions as never) as unknown as Torrent;
}

async function apply(client: Instance, options: OpenOptions): Promise<TorrentSession> {
  if (active && active.infoHash === options.infoHash && !options.force) return active;

  if (active) {
    const previous = active;
    active = null;
    await destroyTorrent(previous.torrent);
  }

  const torrent = await addTorrent(client, options);
  active = { infoHash: options.infoHash, torrent };
  return active;
}

export function openTorrentSession(client: Instance, options: OpenOptions): Promise<TorrentSession> {
  const next = queue.then(() => apply(client, options));
  // A failed open must not poison the queue for the next one.
  queue = next.catch(() => undefined);
  return next;
}

/** Nothing to play (an HTTP-only reciter): let go of the torrent we were seeding. */
export function closeTorrentSession(): Promise<void> {
  const next = queue.then(async () => {
    if (!active) return;
    const previous = active;
    active = null;
    await destroyTorrent(previous.torrent);
  });
  queue = next.catch(() => undefined);
  return next;
}
