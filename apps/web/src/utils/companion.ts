/**
 * Telling the companion what is playing — one message, fire-and-forget.
 *
 * The extension listens on `externally_connectable`; the site's whole duty is
 * to send a play notice when a reciter starts and to feel nothing when no
 * extension is installed: no log, no retry, no await. A page that notices its
 * helper add-on is a page that breaks for everyone else.
 */

import { COMPANION_IDS } from '../constants/companion.ts';

const INFO_HASH = /^[0-9a-f]{40}$/i;

export type CompanionRelease = {
  infohash: string;
  slug: string;
  name: string;
  nameAr: string;
};

/** Where the unpacked development build is reachable: staging only. */
const DEV_HOST = 'staging.tilawah.cc';

/**
 * The live listings only: an empty ID is a store still in review, and the
 * development build is addressed from staging alone — production must never
 * probe an extension nobody ships.
 */
export function companionTargets(ids: Record<string, string>, hostname = ''): string[] {
  return Object.entries(ids)
    .filter(([key, id]) => typeof id === 'string' && id.trim() !== '' && (key !== 'dev' || hostname === DEV_HOST))
    .map(([, id]) => id);
}

/** The one message the extension accepts; `null` means "nothing to say". */
export function playMessage(release: CompanionRelease): Record<string, string> | null {
  const infohash = release.infohash.trim().toLowerCase();
  if (!INFO_HASH.test(infohash)) return null;
  return {
    type: 'tilawah:play',
    infohash,
    slug: release.slug,
    name: release.name,
    nameAr: release.nameAr,
  };
}

type RuntimeLike = { sendMessage?: (id: string, message: unknown) => unknown };

const runtimeOf = (): RuntimeLike | undefined => {
  const scope = globalThis as { chrome?: { runtime?: RuntimeLike }; browser?: { runtime?: RuntimeLike } };
  return scope.chrome?.runtime ?? scope.browser?.runtime;
};

const send = (id: string, message: unknown): void => {
  const runtime = runtimeOf();
  const deliver = runtime?.sendMessage;
  if (!deliver) return;
  try {
    // Firefox answers with a promise that *rejects* when no receiver exists;
    // Chrome with an omitted callback resolves. Both are swallowed: the page
    // must never learn whether the person has the companion.
    const reply = deliver.call(runtime, id, message) as Promise<unknown> | undefined;
    reply?.catch?.(() => undefined);
  } catch {
    // Synchronous throw — also silence.
  }
};

export function notifyCompanion(release: CompanionRelease): void {
  // The prerender runs this component tree in Node: no window, no runtime,
  // and nothing to say to either.
  if (typeof window === 'undefined') return;
  const message = playMessage(release);
  if (!message) return;
  for (const id of companionTargets(COMPANION_IDS, window.location.hostname)) send(id, message);
}
