/**
 * The five states a catalogue entry can be in, and why each matters.
 *
 * This is the whole point of recording placement: the catalogue and the nodes
 * answer two different questions, and only their combination tells an operator
 * what to do.
 */

export type PlacementState = 'pending' | 'placed' | 'failed';

export type ReciterState = 'healthy' | 'unseeded' | 'stale' | 'dormant';

/** A pending placement older than this is a failure, not a slow download. */
export const PENDING_TTL_HOURS = 3;

export interface ReciterStateInput {
  published: boolean;
  /** How many nodes the observer (node_torrents) says hold it right now. */
  heldByNodes: number;
  /** Placements recorded for this reciter, in any state. */
  placements: PlacementState[];
}

/**
 * healthy  — published and held somewhere: the site works.
 * unseeded — published and held nowhere: the site offers what nothing seeds.
 * stale    — a draft held by a node: disk spent on something the site hides.
 * dormant  — a draft held by nobody: fine, it is just a draft.
 *
 * A pending placement does not make something healthy — only the node's own
 * report does. That is the difference between "we asked" and "it is there".
 */
export function deriveReciterState(input: ReciterStateInput): ReciterState {
  const held = input.heldByNodes > 0;
  if (input.published) return held ? 'healthy' : 'unseeded';
  return held ? 'stale' : 'dormant';
}

/** True when a pending placement has waited longer than the TTL. */
export function isExpired(
  requestedAt: string | Date,
  now: Date = new Date(),
  ttlHours: number = PENDING_TTL_HOURS,
): boolean {
  const started = requestedAt instanceof Date ? requestedAt : new Date(requestedAt);
  if (Number.isNaN(started.getTime())) return false;
  return now.getTime() - started.getTime() > ttlHours * 60 * 60 * 1000;
}

/**
 * What a node's inventory should do to one placement.
 *
 * `observed` wins: if the node says it has the torrent, the placement is placed
 * whatever it said before. If it does not, a placed placement has lost its data
 * and a pending one is simply still waiting — until the TTL turns it into a
 * failure, which is the only place a timeout becomes visible.
 */
export function nextPlacementState(input: {
  current: PlacementState;
  observed: boolean;
  expired: boolean;
}): { state: PlacementState; error: string | null } {
  if (input.observed) return { state: 'placed', error: null };
  if (input.current === 'placed') {
    return { state: 'failed', error: 'no longer on the node' };
  }
  if (input.current === 'pending' && input.expired) {
    return { state: 'failed', error: `not confirmed within ${PENDING_TTL_HOURS} hours` };
  }
  return { state: input.current, error: null };
}
