/**
 * The fallback is a web seed, not a second player.
 *
 * The audio element keeps pointing at the service-worker stream; when the swarm
 * gives us nothing, the torrent is given an HTTP source of its own — our node,
 * same origin, no CORS, and the pieces it delivers are verified, stored and
 * shared with peers like any other.
 */

/** Long enough for a healthy swarm to answer, short enough not to feel broken. */
export const WEBSEED_GRACE_MS = 8_000;

export type WebSeedDecision = {
  ready: boolean;
  /** WebTorrent's `idle`: nothing is selected, so the player is not waiting. */
  idle: boolean;
  /** Time since the last verified byte arrived. */
  stalledMs: number;
  alreadyAdded: boolean;
};

/**
 * Silence, not absence.
 *
 * This used to require `peers === 0`, and WebTorrent counts every wire — a peer
 * that is connected but delivering nothing therefore held the fallback off for
 * the whole session, which is the stall this exists to prevent. `progress` went
 * too: it is `downloaded / length` over every file in the torrent, so it says
 * the same thing as the byte clock, only later.
 *
 * `idle` is the one thing bytes cannot answer: a paused, buffered player is
 * silent by design and must not pull our server into the swarm.
 */
export function shouldAddWebSeed(input: WebSeedDecision): boolean {
  return (
    input.ready &&
    !input.alreadyAdded &&
    !input.idle &&
    input.stalledMs >= WEBSEED_GRACE_MS
  );
}

/** `addWebSeed` refuses a relative URL, so the base is always absolute. */
export function mediaBase(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/media/`;
}

/**
 * `https://host/media/<torrent folder>/<file>` — the same path WebTorrent builds
 * itself (`<base>/<torrent name>/<file>`), which is why nginx can serve the
 * downloads volume as-is.
 *
 * Each segment is encoded separately: the folder and the file name are one path
 * segment each on disk, not places where `/` may appear.
 */
export function mediaFileUrl(origin: string, folder: string, fileName: string): string {
  return `${mediaBase(origin)}${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`;
}

/**
 * The direct URL for a file the torrent owns, or `undefined` if either half of
 * the path is missing.
 *
 * `file.name` is used verbatim: catalogues are not uniformly `001.mp3` (some ship
 * `ar_001_Al-Fatiha.mp3`), and a rebuilt name is a 404. The folder is the torrent
 * name — the same segment nginx serves under `/media`.
 */
export function mediaUrlForFile(
  origin: string,
  folder: string | undefined,
  file: { name?: unknown } | null | undefined,
): string | undefined {
  const name = file?.name;
  if (!folder || typeof name !== 'string' || !name) return undefined;
  return mediaFileUrl(origin, folder, name);
}

/**
 * The source the audio element should point at.
 *
 * The service-worker stream is the fast path, but it only exists when a worker
 * controls the page. Facebook and Instagram in-app browsers on iOS often start
 * without one; refusing to play there is what made the app look unreachable.
 * `directURL` is the same file over plain HTTP, so it can carry the first listen
 * while the worker settles — or forever, if the browser never gives it one.
 */
export function choosePlaybackSource(input: {
  streaming: boolean;
  streamURL?: string;
  directURL?: string;
}): { url: string; direct: boolean } | null {
  if (input.streaming && input.streamURL) {
    return { url: input.streamURL, direct: false };
  }
  if (input.directURL) {
    return { url: input.directURL, direct: true };
  }
  // A stream URL without the server that answers it is not a source.
  return null;
}

/**
 * When the element refuses the service-worker stream, is the direct file worth
 * one try?
 *
 * `MEDIA_ERR_SRC_NOT_SUPPORTED` (4) is the only code that means "the source as a
 * whole did not work": the service worker never resolved the range request, or
 * answered with something that is not audio. `MEDIA_ERR_DECODE` (3) is different
 * — the bytes arrived and the browser could not read them, so our own copy of the
 * same bytes fails the same way. Network/abort (2/1) are transient and belong to
 * the torrent's own retry, not to a second source.
 */
export function shouldRetryDirect(input: {
  code?: number | null;
  alreadyTried: boolean;
}): boolean {
  return !input.alreadyTried && input.code === 4;
}

/** One HEAD per URL per session; the sheet and the timer share the answer. */
const probes = new Map<string, Promise<boolean>>();

export function probeMedia(url: string): Promise<boolean> {
  let pending = probes.get(url);
  if (!pending) {
    pending = fetch(url, { method: 'HEAD' })
      .then((response) => response.ok)
      .catch(() => false);
    probes.set(url, pending);
  }
  return pending;
}
