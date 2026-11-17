import { Inject, Injectable, Logger } from '@nestjs/common';

import type { Db } from '@tilawa-admin/core';

import { SQLITE_DB } from '../store/store.module';
import { parseScrape, scrapeUrl } from './scrape';
import { swarmHealth, type Swarm } from './swarm-health';

/**
 * The swarm, asked of the one server that can answer.
 *
 * The tracker sees every peer; this process sees none of them. So the sample is a
 * scrape of the published releases — one request for the whole roster, because
 * `info_hash` repeats and the tracker answers a dictionary of counts. The reply
 * lands in `swarm_health` (migration 032) and every surface reads it from there:
 * the console, and through the public catalogue, the extension.
 *
 * Nothing here decides anything. It writes down what the swarm said, and
 * `swarmHealth` turns that into the word each screen shows.
 */
@Injectable()
export class SwarmService {
  private readonly logger = new Logger(SwarmService.name);

  constructor(@Inject(SQLITE_DB) private readonly db: Db) {}

  /** `TRACKER_SCRAPE_URL` exists so a test or a staging host can be pointed at. */
  private get base(): string {
    const configured = process.env.TRACKER_SCRAPE_URL?.trim();
    return (configured || 'https://tracker.tilawah.cc').replace(/\/+$/, '');
  }

  private publishedHashes(): string[] {
    const rows = this.db
      .prepare("SELECT infohash FROM reciters WHERE published = 1 AND infohash <> ''")
      .all() as { infohash: string }[];
    return rows
      .map((row) => row.infohash.trim().toLowerCase())
      .filter((hash) => /^[0-9a-f]{40}$/.test(hash));
  }

  /**
   * Ask the tracker about every published release and store the answer.
   *
   * A hash the tracker has never seen is written as zero seeders rather than
   * skipped: "nobody announces it" is exactly the state a volunteer can fix, and
   * leaving the row out would keep yesterday's number in place.
   */
  async sample(now = Date.now()): Promise<number> {
    const hashes = [...new Set(this.publishedHashes())];
    if (hashes.length === 0) return 0;

    const response = await fetch(scrapeUrl(this.base, hashes), {
      headers: { accept: 'text/plain' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`scrape answered ${response.status}`);

    const counts = parseScrape(new Uint8Array(await response.arrayBuffer()));
    const sampledAt = new Date(now).toISOString();

    const upsert = this.db.prepare(
      `INSERT INTO swarm_health (infohash, seeders, leechers, sampled_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(infohash) DO UPDATE SET
         seeders = excluded.seeders,
         leechers = excluded.leechers,
         sampled_at = excluded.sampled_at`,
    );
    const stale = this.db.prepare('DELETE FROM swarm_health WHERE sampled_at < ?');

    const write = this.db.transaction(() => {
      for (const hash of hashes) {
        const countsFor = counts.get(hash) ?? { seeders: 0, leechers: 0 };
        upsert.run(hash, countsFor.seeders, countsFor.leechers, sampledAt);
      }
      // A release that was pulled from the catalogue leaves no row to read.
      stale.run(new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString());
    });
    write();

    this.logger.debug(`swarm: sampled ${hashes.length} reciter(s)`);
    return hashes.length;
  }

  /**
   * The last answer for each release that has one.
   *
   * The table holds one row per published release, so it is read whole: a page of
   * the catalogue costs one query here, not one per row.
   */
  snapshot(now = Date.now()): Map<string, Swarm> {
    const rows = this.db
      .prepare('SELECT infohash, seeders, leechers, sampled_at FROM swarm_health')
      .all() as { infohash: string; seeders: number; leechers: number; sampled_at: string }[];

    return new Map(
      rows.map((row) => [
        row.infohash,
        {
          health: swarmHealth({ seeders: row.seeders, sampledAt: row.sampled_at, now }),
          seeders: row.seeders,
          leechers: row.leechers,
          sampledAt: row.sampled_at,
        } satisfies Swarm,
      ]),
    );
  }
}
