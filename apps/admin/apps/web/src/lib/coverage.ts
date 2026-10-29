/**
 * How far each node is from the published catalogue.
 *
 * This is a hint, not a plan. It reads what the last poll reported — the
 * `node_torrents` cache behind `GET /reciters` — so asking the fleet page
 * "is there anything to push?" costs no request to any node. The authoritative
 * numbers, with the disk budget applied, come from `/reciters/push/plan` at the
 * moment the operator confirms.
 */

export interface CoverageReciter {
  infohash: string;
  published: boolean;
  /** Nodes that reported holding this reciter on their last probe. */
  heldBy: { seederId: number }[];
}

export interface NodeCoverage {
  seederId: number;
  /** Published reciters this node does not report holding. */
  missing: number;
}

/**
 * Published rows the node does not report. Unpublished ones are excluded because
 * a push never sends them: counting them would promise work the button cannot do.
 */
export function missingPerNode(
  reciters: readonly CoverageReciter[],
  seederIds: readonly number[],
): NodeCoverage[] {
  const published = reciters.filter((reciter) => reciter.published);
  return seederIds.map((seederId) => ({
    seederId,
    missing: published.filter(
      (reciter) => !reciter.heldBy.some((held) => held.seederId === seederId),
    ).length,
  }));
}

/** True when no node has anything left to receive. */
export function totalMissing(rows: readonly NodeCoverage[]): number {
  return rows.reduce((sum, row) => sum + row.missing, 0);
}
