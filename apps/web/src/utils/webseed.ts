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
  peers: number;
  progress: number;
  waitedMs: number;
  alreadyAdded: boolean;
};

export function shouldAddWebSeed(input: WebSeedDecision): boolean {
  return (
    input.ready &&
    !input.alreadyAdded &&
    input.peers === 0 &&
    input.progress < 1 &&
    input.waitedMs >= WEBSEED_GRACE_MS
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
