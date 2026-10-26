import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository } from '@tilawa-admin/core';
import { RecitersService } from '../reciters/reciters.service';
import { SeedersService } from '../seeders/seeders.service';

/** Below this much free space a node is not given a new release. */
const DEFAULT_MIN_FREE_BYTES = 5 * 1024 ** 3;

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
        if (seeder.freeBytes !== null && seeder.freeBytes < this.minFreeBytes()) {
          return {
            ...base,
            skipReason: 'low_space',
            detail: `${Math.round(seeder.freeBytes / 1024 ** 3)} GB free`,
          };
        }

        let inventory;
        try {
          inventory = await this.seeders.inventory(seeder.id);
        } catch (err) {
          return { ...base, skipReason: 'unreachable', detail: (err as Error).message };
        }
        const held = new Set(inventory.torrents.map((t) => t.infoHash.toLowerCase()));
        const toAdd = catalogue
          .filter((r) => !held.has(r.infohash.toLowerCase()))
          .map((r) => ({ infohash: r.infohash, name: r.name }));
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

  private minFreeBytes(): number {
    const raw = Number(process.env.CATALOGUE_PUSH_MIN_FREE_BYTES);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MIN_FREE_BYTES;
  }
}
