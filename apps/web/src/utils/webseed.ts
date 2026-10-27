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
 * `https://host/media/<torrent folder>/<NNN>.mp3` — the same path WebTorrent
 * builds itself (`<base>/<torrent name>/<file>`), which is why nginx can serve
 * the downloads volume as-is.
 */
export function mediaUrl(origin: string, folder: string, surahId: number): string {
  const file = `${String(surahId).padStart(3, '0')}.mp3`;
  return `${mediaBase(origin)}${encodeURIComponent(folder)}/${file}`;
}

/** One HEAD per file per session; the sheet and the timer share the answer. */
const probes = new Map<string, Promise<boolean>>();

export function probeMedia(origin: string, folder: string, surahId: number): Promise<boolean> {
  const url = mediaUrl(origin, folder, surahId);
  let pending = probes.get(url);
  if (!pending) {
    pending = fetch(url, { method: 'HEAD' })
      .then((response) => response.ok)
      .catch(() => false);
    probes.set(url, pending);
  }
  return pending;
}
