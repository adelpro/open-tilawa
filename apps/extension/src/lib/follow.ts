/**
 * The follow list: what the site says the person is listening to, kept newest
 * first under its own cap.
 *
 * Two rules carry the whole design. First, a **manual choice is never evicted**
 * — the person picked it, the app may not unpick it; only follow-source rows
 * rotate. Second, a reciter **playing right now is not evicted** — the cap may
 * be temporarily exceeded, and the next add trims it, because cutting the audio
 * out from under a listener is the one failure this mode must never have.
 *
 * This module is pure: no storage, no engine, no catalogue. The background
 * resolves the row and applies the result.
 */

import type { HeldReciter, Reciter, ReciterSource } from '@/lib/catalogue';
import type { ListeningMode } from '@/lib/settings';

const INFO_HASH = /^[0-9a-f]{40}$/i;

export type FollowInput = {
  held: HeldReciter[];
  row: Reciter;
  mode: ListeningMode;
  followCap: number;
  now: number;
  /** Infohashes the engine currently holds open; eviction walks around these. */
  playing: ReadonlySet<string>;
  /** Decimal bytes the whole roster may occupy; absent/0 means no budget. */
  budgetBytes?: number;
};

export type FollowResult = {
  held: HeldReciter[];
  evicted: string[];
  added: boolean;
};

/**
 * What the site is allowed to send: one type, one hash. A slug or a name is
 * decorative; the infohash is the identity the engine and the catalogue share.
 */
export function parsePlayMessage(raw: unknown): { infohash: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const message = raw as { type?: unknown; infohash?: unknown };
  if (message.type !== 'tilawah:play') return null;
  const infohash = typeof message.infohash === 'string' ? message.infohash.trim().toLowerCase() : '';
  return INFO_HASH.test(infohash) ? { infohash } : null;
}

/**
 * Who is audible right now — the set the eviction walk goes around.
 *
 * The one thing this helper pins: **only the play message is evidence of
 * playing.** The engine's snapshot lists every torrent it holds — seeding,
 * queued, paused, error, all of it — and a warm engine holds the whole roster,
 * so building the guard from the snapshot protects everyone and the cap stops
 * trimming. The site said who is playing; that is who is protected.
 */
export function playingNow(played: string): ReadonlySet<string> {
  return new Set([played]);
}

export function followAdd(input: FollowInput): FollowResult {
  const { held, row, mode, followCap, now, playing } = input;

  // Manual mode holds exactly what the person ticked; the site's play notice
  // changes nothing. `followCap: 0` is the same "off" with a different door.
  if (mode === 'manual' || followCap <= 0) {
    return { held, evicted: [], added: false };
  }

  // A manual choice stays a manual choice: refreshing it would let the app
  // start evicting something the person decided to keep.
  if (held.some((entry) => entry.infohash === row.infohash && entry.source === 'manual')) {
    return { held, evicted: [], added: false };
  }

  // An entry already followed is a recency refresh, not a second copy.
  const refreshed = held.findIndex((entry) => entry.infohash === row.infohash && entry.source === 'follow');

  const stamp = new Date(now).toISOString();
  const next: HeldReciter[] = [...held];
  if (refreshed >= 0) next.splice(refreshed, 1);
  // Newest first: the front of the list is what the person played last, and
  // manual rows keep the position the person's picker gave them.
  next.unshift({ ...row, addedAt: stamp, source: 'follow' as ReciterSource });

  const evicted: string[] = [];
  // Two budgets, one walk. The cap counts every follow entry, protected or
  // not — a playing row occupies its slot like any other; the disk budget
  // counts every held byte, because that is what the disk measures. Only the
  // eviction *candidates* walk around playing rows and the fresh row, and
  // manual choices are never candidates at all.
  const bytes = (entry: HeldReciter): number => entry.sizeBytes ?? 0;
  const budget = typeof input.budgetBytes === 'number' && input.budgetBytes > 0 ? input.budgetBytes : Infinity;
  const followCount = next.filter((entry) => entry.source === 'follow').length;
  const totalBytes = next.reduce((sum, entry) => sum + bytes(entry), 0);
  let overCap = followCount - followCap;
  let overBudget = totalBytes - budget;
  // Oldest by stamp, not by position: the stored order is the picker's, and
  // only the follow entries follow recency. The fresh row is never evicted —
  // it is the intent this whole call exists to serve.
  const evictable = next
    .filter((entry) => entry.source === 'follow' && !playing.has(entry.infohash) && entry.infohash !== row.infohash)
    .sort((a, b) => (a.addedAt < b.addedAt ? -1 : 1));
  for (const entry of evictable) {
    if (overCap <= 0 && overBudget <= 0) break;
    const at = next.findIndex((candidate) => candidate.infohash === entry.infohash);
    if (at < 0) continue;
    next.splice(at, 1);
    evicted.push(entry.infohash);
    overCap -= 1;
    overBudget -= bytes(entry);
  }

  return { held: next, evicted, added: true };
}
