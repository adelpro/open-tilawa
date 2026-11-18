/**
 * What is actually new to *this* device.
 *
 * The catalogue changes on its own and the extension must not turn that into a
 * badge, a download, or a nag. A reciter is "new" only if this device has not
 * displayed it before, and the hashes shown the first time the picker opens are
 * the baseline — a fresh install is never told that twelve reciters just arrived
 * when it installed the extension to hold them.
 *
 * Seen is a set of hashes, not a timestamp: a reciter that is withdrawn and
 * republished under a new hash is genuinely a new release, and one that returns
 * under the same hash is the same reciter.
 */

import type { Reciter } from './catalogue';

export const NEW_SEEN_KEY = 'tilawah-companion.seen.v1';

/**
 * Catalogue notices this device has produced and the person has not opened the
 * picker for yet.
 *
 * The background counts them; the picker sets this to zero the moment it renders
 * them, because the strip on screen *is* the notice. Reading a key nobody writes
 * is how the popup grew a count that never went away.
 */
export const PENDING_KEY = 'tilawah-companion.pending.v1';

/** Rows this device has never displayed, newest first. */
export function pickNew(rows: Reciter[], seenHashes: string[]): Reciter[] {
  // No baseline yet: the first visit learns the roster rather than announcing it.
  if (seenHashes.length === 0) return [];

  const seen = new Set(seenHashes);
  return rows
    .filter((row) => !seen.has(row.infohash))
    .sort((a, b) => (b.id ?? -1) - (a.id ?? -1));
}

/** Union, preserving the order the hashes were first seen in. */
export function markSeen(seenHashes: string[], shown: string[]): string[] {
  return [...new Set([...seenHashes, ...shown])];
}
