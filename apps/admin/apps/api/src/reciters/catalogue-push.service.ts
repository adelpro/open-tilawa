import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditRepository } from '@tilawa-admin/core';
import { RecitersService } from '../reciters/reciters.service';
import { magnetForInfo, SettingsService } from '../settings/settings.service';
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
          riwaya: 'Hafs',
          infohash: torrent.infoHash,
          magnet: magnetForInfo(torrent.infoHash, torrent.name, this.settings.getTrackers()),
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
    purgeNodes: boolean,
    actorId?: number,
  ): Promise<{
    removed: boolean;
    nodes: { seederId: number; name: string; removed: boolean; error: string | null }[];
  }> {
    const reciter = this.reciters.get(id);
    if (!reciter) throw new NotFoundException('reciter not found');

    const nodes: { seederId: number; name: string; removed: boolean; error: string | null }[] = [];
    if (purgeNodes) {
      for (const seeder of this.seeders.list()) {
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
    this.audit.record({
      actorId: actorId ?? null,
      userId: null,
      action: 'reciter:delete',
      target: String(id),
      status: 'ok',
      after: { infohash: reciter.infohash, purgeNodes, nodes },
    });
    return { removed: true, nodes };
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
        const missingRows = catalogue.filter((r) => !held.has(r.infohash.toLowerCase()));
        const toAdd = missingRows.map((r) => ({ infohash: r.infohash, name: r.name }));

        // Capacity comes from the node's own /health: its quota and disk,
        // combined. Catalogue sizes make the decision possible before any byte
        // moves; unknown sizes count as 0 and are left to the node, which
        // applies the same rule after reading the metadata.
        const needed = missingRows.reduce((sum, row) => sum + (row.sizeBytes ?? 0), 0);
        const headroom = seeder.headroomBytes;
        if (headroom !== null && (headroom <= 0 || needed > headroom)) {
          return {
            ...base,
            present: inventory.torrents.length,
            skipReason: 'low_space',
            detail: `${Math.round(headroom / 1024 ** 3)} GB headroom, ${Math.round(needed / 1024 ** 3)} GB needed`,
          };
        }
        return {
          ...base,
          present: inventory.torrents.length,
          toAdd,
          skipReason: null,
          detail: null,
        };
      }),
    );

    return { catalogue: catalogue.length, nodes };
  }
}
