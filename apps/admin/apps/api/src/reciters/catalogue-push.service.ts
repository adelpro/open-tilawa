import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditRepository, type Db } from '@tilawa-admin/core';
import { SQLITE_DB } from '../store/store.module';
import { RecitersService } from '../reciters/reciters.service';
import { SettingsService } from '../settings/settings.service';
import { SeedersService } from '../seeders/seeders.service';

export interface PushNodePlan {
  seederId: number;
  name: string;
  url: string;
  /** Reciters the node does not hold yet; these are what an apply adds. */
  toAdd: { infohash: string; name: string }[];
  /** Catalogue entries the node already carries. */
  present: number;
  /** Why this node will be left alone, when it will be. */
  skipReason: 'offline' | 'no_credentials' | 'low_space' | 'unreachable' | null;
  /**
   * Reciters deliberately left out because they would push the node past 90 %
   * of its quota. Never silent: the fleet shows the count and the reason.
   */
  skipped: number;
  /** Bytes this node may fill before that cap, when it reports a quota. */
  capBytes: number | null;
  detail: string | null;
}

export interface PushPlan {
  catalogue: number;
  nodes: PushNodePlan[];
}

/**
 * Push the reciter catalogue to the managed seeders.
 *
 * The catalogue is the desired list, so a push is "add what this node is
 * missing". It never removes: a node may carry extra torrents of its own, and a
 * push is not the place to delete someone's data. Removal stays a deliberate act
 * on the Torrents screen.
 *
 * `plan` and `apply` share the computation, so what the operator previews is
 * exactly what runs.
 */
@Injectable()
export class CataloguePushService {
  private readonly logger = new Logger(CataloguePushService.name);

  constructor(
    private readonly reciters: RecitersService,
    private readonly seeders: SeedersService,
    private readonly audit: AuditRepository,
    private readonly settings: SettingsService,
    @Inject(SQLITE_DB) private readonly db: Db,
  ) {}

  plan(nodeIds?: number[]): Promise<PushPlan> {
    return this.compute(nodeIds);
  }

  async apply(
    nodeIds: number[] | undefined,
    actorId?: number,
  ): Promise<PushPlan & { applied: { seederId: number; added: number; error: string | null }[] }> {
    const plan = await this.compute(nodeIds);
    const magnets = new Map(this.reciters.list().map((r) => [r.infohash, r.magnet]));
    const results: { seederId: number; added: number; error: string | null }[] = [];

    for (const node of plan.nodes) {
      if (node.skipReason || node.toAdd.length === 0) continue;
      const seeder = this.seeders.get(node.seederId);
      if (!seeder) continue;
      let added = 0;
      let error: string | null = null;
      for (const item of node.toAdd) {
        try {
          // The magnet from the catalogue is the one the public site publishes;
          // rebuild it from the infohash only when the row never had one.
          const magnet = magnets.get(item.infohash) || `magnet:?xt=urn:btih:${item.infohash}`;
          await this.seeders.addTorrent(node.seederId, { magnet });
          added += 1;
        } catch (err) {
          error = (err as Error).message;
          break; // one failure usually means the node is gone; stop pushing to it
        }
      }
      if (added > 0 && !error) await this.seeders.poll(node.seederId);
      results.push({ seederId: node.seederId, added, error });
      this.audit.record({
        actorId: actorId ?? null,
        userId: node.seederId,
        action: 'seeder:catalogue_push',
        target: String(node.seederId),
        status: error ? 'error' : 'ok',
        after: { added, error },
      });
      this.logger.log(
        `catalogue push -> seeder ${node.seederId}: added ${added}${error ? ` (${error})` : ''}`,
      );
    }

    return { ...plan, applied: results };
  }

  /**
   * Fill the catalogue from what a node already holds.
   *
   * This is the one honest source of a release's size: the seeder knows it, and
   * a hand-typed row does not. Existing rows are not overwritten — only a
   * missing size is filled — because the catalogue is edited deliberately.
   */
  async importFrom(seederId: number): Promise<{ added: number; sized: number; catalogue: number }> {
    const seeder = this.seeders.get(seederId);
    if (!seeder) throw new NotFoundException('seeder not found');
    const inventory = await this.seeders.inventory(seederId);
    const existing = new Map(this.reciters.list().map((r) => [r.infohash.toLowerCase(), r]));
    let added = 0;
    let sized = 0;
    for (const torrent of inventory.torrents) {
      const key = torrent.infoHash.toLowerCase();
      const row = existing.get(key);
      if (!row) {
        this.reciters.add({
          name: torrent.name,
          // The node knows the folder, not the reading: unknown until a human says.
          riwaya: 'unknown',
          // Imported ≠ published: curation is a separate, deliberate act.
          published: false,
          infohash: torrent.infoHash,
          magnet: this.settings.magnetFor(torrent.infoHash, torrent.name),
          fileCount: torrent.files,
          sizeBytes: torrent.size || null,
        });
        added += 1;
        continue;
      }
      if (row.sizeBytes === null && torrent.size > 0) {
        this.reciters.update(row.id, { sizeBytes: torrent.size });
        sized += 1;
      }
    }
    this.audit.record({
      actorId: null,
      userId: seederId,
      action: 'seeder:catalogue_import',
      target: String(seederId),
      status: 'ok',
      after: { added, sized },
    });
    return { added, sized, catalogue: this.reciters.list().length };
  }

  /**
   * Delete a catalogue row, optionally taking it off every node first.
   *
   * The catalogue is the source of truth, so removing a release usually means
   * removing it everywhere. It stays a choice: a node may be kept as an archive,
   * and its disk is the operator's. Failures per node are reported, not fatal —
   * a node that is down must not block the catalogue edit.
   */
  async remove(
    id: number,
    purge: number[] | 'all' | null,
    actorId?: number,
  ): Promise<{
    removed: boolean;
    nodes: { seederId: number; name: string; removed: boolean; error: string | null }[];
  }> {
    const reciter = this.reciters.get(id);
    if (!reciter) throw new NotFoundException('reciter not found');

    const nodes: { seederId: number; name: string; removed: boolean; error: string | null }[] = [];
    if (purge !== null) {
      const targets =
        purge === 'all'
          ? this.seeders.list()
          : this.seeders.list().filter((seeder) => purge.includes(seeder.id));
      for (const seeder of targets) {
        if (!seeder.hasCredentials) {
          nodes.push({
            seederId: seeder.id,
            name: seeder.name,
            removed: false,
            error: 'no credentials',
          });
          continue;
        }
        try {
          await this.seeders.removeTorrent(seeder.id, reciter.infohash);
          nodes.push({ seederId: seeder.id, name: seeder.name, removed: true, error: null });
        } catch (err) {
          // 404 means the node never held it, which is the outcome we wanted.
          nodes.push({
            seederId: seeder.id,
            name: seeder.name,
            removed: false,
            error: (err as Error).message,
          });
        }
      }
    }

    this.reciters.remove(id);
    // Placements cascade with the row, but the cache of what nodes hold does not:
    // drop the deleted hash so coverage stops counting a row that no longer exists.
    this.db
      .prepare('DELETE FROM node_torrents WHERE lower(infohash) = ?')
      .run(reciter.infohash.toLowerCase());
    this.audit.record({
      actorId: actorId ?? null,
      userId: null,
      action: 'reciter:delete',
      target: String(id),
      status: 'ok',
      after: { infohash: reciter.infohash, purge, nodes },
    });
    return { removed: true, nodes };
  }

  /**
   * Put one reciter on specific nodes.
   *
   * The placement row is written first, in `pending`: a 1.5 GB download takes
   * minutes, and the operator has to be able to see "asked, not arrived yet"
   * rather than a button that looks like it failed.
   */
  async place(
    reciterId: number,
    seederIds: number[],
    actorId?: number,
  ): Promise<{ reciterId: number; results: { seederId: number; ok: boolean; error: string | null }[] }> {
    const reciter = this.reciters.get(reciterId);
    if (!reciter) throw new NotFoundException('reciter not found');

    const requestedAt = new Date().toISOString();
    const upsert = this.db.prepare(
      `INSERT INTO placements (reciter_id, seeder_id, state, requested_at)
       VALUES (?, ?, 'pending', ?)
       ON CONFLICT(reciter_id, seeder_id) DO UPDATE SET
         state = 'pending', requested_at = excluded.requested_at,
         verified_at = NULL, error = NULL`,
    );
    const fail = this.db.prepare(
      "UPDATE placements SET state = 'failed', error = ? WHERE reciter_id = ? AND seeder_id = ?",
    );

    const results: { seederId: number; ok: boolean; error: string | null }[] = [];
    for (const seederId of [...new Set(seederIds)]) {
      const seeder = this.seeders.get(seederId);
      if (!seeder) {
        results.push({ seederId, ok: false, error: 'seeder not found' });
        continue;
      }
      upsert.run(reciterId, seederId, requestedAt);
      try {
        await this.seeders.addTorrent(seederId, { magnet: reciter.magnet });
        results.push({ seederId, ok: true, error: null });
      } catch (error) {
        const message = (error as Error).message;
        fail.run(message, reciterId, seederId);
        results.push({ seederId, ok: false, error: message });
      }
    }

    // Only the node's own report turns pending into placed.
    await Promise.all([...new Set(seederIds)].map((id) => this.seeders.poll(id)));

    this.audit.record({
      actorId: actorId ?? null,
      userId: null,
      action: 'reciter:place',
      target: String(reciterId),
      status: results.every((r) => r.ok) ? 'ok' : 'error',
      after: { seederIds, results },
    });
    return { reciterId, results };
  }

  /**
   * Stop seeding a reciter on one node, keeping its files.
   *
   * The volume is also the HTTP source, so removing a torrent from a node must
   * not delete it. Purging data is the separate, deliberate action.
   */
  async unplace(
    reciterId: number,
    seederId: number,
    actorId?: number,
  ): Promise<{ reciterId: number; seederId: number; ok: boolean; error: string | null }> {
    const reciter = this.reciters.get(reciterId);
    if (!reciter) throw new NotFoundException('reciter not found');
    try {
      await this.seeders.removeTorrent(seederId, reciter.infohash, true);
    } catch (error) {
      const message = (error as Error).message;
      // 404: the node never held it, which is the state we wanted anyway.
      if (!/does not hold/.test(message)) {
        return { reciterId, seederId, ok: false, error: message };
      }
    }
    this.db
      .prepare('DELETE FROM placements WHERE reciter_id = ? AND seeder_id = ?')
      .run(reciterId, seederId);
    await this.seeders.poll(seederId);
    this.audit.record({
      actorId: actorId ?? null,
      userId: null,
      action: 'reciter:unplace',
      target: String(reciterId),
      status: 'ok',
      after: { seederId },
    });
    return { reciterId, seederId, ok: true, error: null };
  }

  private async compute(nodeIds?: number[]): Promise<PushPlan> {
    const catalogue = this.reciters.list();
    const seeders = this.seeders
      .list()
      .filter((s) => nodeIds === undefined || nodeIds.includes(s.id));

    const nodes = await Promise.all(
      seeders.map(async (seeder): Promise<PushNodePlan> => {
        const base = {
          seederId: seeder.id,
          name: seeder.name,
          url: seeder.url,
          toAdd: [] as { infohash: string; name: string }[],
          present: 0,
          skipped: 0,
          capBytes: seeder.quotaBytes && seeder.quotaBytes > 0
            ? Math.floor(seeder.quotaBytes * 0.9)
            : null,
        };
        if (seeder.status === 'offline') {
          return { ...base, skipReason: 'offline', detail: null };
        }
        if (!seeder.hasCredentials) {
          return { ...base, skipReason: 'no_credentials', detail: null };
        }
        let inventory;
        try {
          inventory = await this.seeders.inventory(seeder.id);
        } catch (err) {
          return { ...base, skipReason: 'unreachable', detail: (err as Error).message };
        }
        const held = new Set(inventory.torrents.map((t) => t.infoHash.toLowerCase()));
        const missingRows = catalogue.filter(
          (r) => r.published && !held.has(r.infohash.toLowerCase()),
        );

        // Two bounds, and the tighter one wins: what the node says it can still
        // take, and 90 % of its quota. The margin exists so a node is never
        // filled to the point where it cannot even fetch a new reciter.
        const headroom = seeder.headroomBytes;
        if (headroom !== null && headroom <= 0) {
          return {
            ...base,
            present: inventory.torrents.length,
            skipReason: 'low_space',
            detail: 'the node reports no headroom',
          };
        }
        const used = seeder.usedBytes ?? 0;
        const byQuota = base.capBytes !== null ? Math.max(0, base.capBytes - used) : Infinity;
        let remaining = Math.min(headroom ?? Infinity, byQuota);

        const toAdd: { infohash: string; name: string }[] = [];
        let skipped = 0;
        for (const row of missingRows) {
          const size = row.sizeBytes ?? 0;
          if (size <= remaining) {
            toAdd.push({ infohash: row.infohash, name: row.name });
            remaining -= size;
          } else {
            skipped += 1;
          }
        }

        return {
          ...base,
          present: inventory.torrents.length,
          toAdd,
          skipped,
          skipReason: toAdd.length === 0 && skipped > 0 ? 'low_space' : null,
          detail:
            skipped > 0
              ? `${skipped} left out at the 90% cap`
              : null,
        };
      }),
    );

    return { catalogue: catalogue.length, nodes };
  }
}
