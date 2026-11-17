/**
 * What a sample means, in one word, for every surface that shows it.
 *
 * The honest axis is "can a listener get this recitation right now", and the only
 * number behind it is how many peers announce that they have the whole release.
 * Three states, because a volunteer needs one decision — help or skip:
 *
 *  - `thin`    nobody is serving it. One person holding a copy changes this.
 *  - `ok`      someone is, but not enough to survive a browser closing.
 *  - `healthy` three or more seeders; adding a copy here helps nobody today.
 *
 * `unknown` is the fourth, and it is not a failure: a release that was never
 * sampled, or whose last answer is older than six hours (the scheduler missed a
 * beat, or the tracker is down), must not be reported as thin. "We do not know"
 * and "nobody seeds it" lead to different decisions.
 *
 * No smoothing yet. An hourly sample will flap around the boundary as browsers
 * open and close, and the console shows `seeders` beside the word so the reader
 * can see the number rather than trust a bucket. If the flapping turns out to
 * matter, the fix is a 24-hour rollup — not a longer cache of one sample.
 */

export type SwarmHealth = 'thin' | 'ok' | 'healthy' | 'unknown';

export type Swarm = {
  health: SwarmHealth;
  seeders: number | null;
  leechers: number | null;
  /** ISO timestamp of the sample this answer reads. */
  sampledAt: string | null;
};

export const UNKNOWN_SWARM: Swarm = {
  health: 'unknown',
  seeders: null,
  leechers: null,
  sampledAt: null,
};

/** Three seeders is the line between "served" and "served by one closed tab". */
export const HEALTHY_SEEDERS = 3;

/** One missed hourly beat is tolerated; a stale day is not an answer. */
export const SWARM_FRESH_MS = 6 * 60 * 60 * 1000;

export function swarmHealth(input: {
  seeders: number | null;
  sampledAt: string | null;
  now: number;
}): SwarmHealth {
  const { seeders, sampledAt, now } = input;
  if (seeders === null || sampledAt === null) return 'unknown';

  const at = Date.parse(sampledAt);
  if (!Number.isFinite(at) || now - at > SWARM_FRESH_MS) return 'unknown';

  if (seeders >= HEALTHY_SEEDERS) return 'healthy';
  return seeders > 0 ? 'ok' : 'thin';
}
