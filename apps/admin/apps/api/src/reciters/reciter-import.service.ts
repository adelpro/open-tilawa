import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SeedersService } from '../seeders/seeders.service';
import { ProviderRegistry } from '../providers/provider.registry';
import type { ProviderId } from '../providers/provider.types';
import { folderFromRelease } from './folder';
import { RecitersService, type Reciter } from './reciters.service';

const FULL_QURAN = 114;

/**
 * The bridge between a provider release and a node's disk.
 *
 * The admin resolves the 114 URLs and the seeder only downloads and seeds; that
 * keeps provider keys in one process and makes the node's job a plain file task.
 * The scheduler is what survives a console refresh: the row, not the browser,
 * holds the job id.
 */
@Injectable()
export class ReciterImportService {
  private readonly logger = new Logger(ReciterImportService.name);
  /** Jobs on the other selected nodes; the row tracks only the primary one. */
  private readonly extras = new Map<string, { rowId: number; seederId: number }>();

  constructor(
    private readonly reciters: RecitersService,
    private readonly seeders: SeedersService,
    private readonly registry: ProviderRegistry,
  ) {}

  async start(input: {
    provider: ProviderId;
    reciterId: string;
    releaseId: string;
    variant?: string;
    seederIds?: number[];
    seederId?: number;
    folderName?: string;
    publish?: boolean;
  }): Promise<Reciter> {
    const seederIds = [
      ...new Set(
        (input.seederIds ?? (input.seederId === undefined ? [] : [input.seederId])).map((id) =>
          Number(id),
        ),
      ),
    ].filter((id) => Number.isInteger(id) && id > 0);
    if (seederIds.length === 0) throw new BadRequestException('choose a seeder node');
    const provider = this.registry.get(input.provider);
    let release;
    try {
      release = await provider.release(input.reciterId, input.releaseId, input.variant);
    } catch (err) {
      throw new BadGatewayException(
        `the provider could not resolve this release: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // A provider may carry a partial recitation (16 surahs, say). The catalogue
    // stores the real file count and the player offers what is there; the
    // torrent is not required to be the whole mushaf.
    if (release.tracks.length < 1 || release.tracks.length > FULL_QURAN) {
      throw new BadRequestException(
        `this release has ${release.tracks.length} tracks; a torrent needs 1 to ${FULL_QURAN}`,
      );
    }

    const variant = release.variant ?? '';
    const existing = this.reciters
      .list()
      .find(
        (row) =>
          row.provider === release.provider &&
          row.releaseId === release.releaseId &&
          (row.variant ?? '') === variant,
      );
    if (existing) {
      if (existing.importState === 'downloading' || existing.importState === 'seeding') {
        throw new ConflictException(`an import is already running for reciter ${existing.id}`);
      }
      // A row linked before it had a torrent is the same release, not a second
      // one. Import into it instead of refusing the operator's own link.
      if (existing.magnet || existing.infohash) {
        throw new ConflictException(`this release is already linked to reciter ${existing.id}`);
      }
    }

    const folder = input.folderName?.trim() || folderFromRelease(release.name, release.riwaya);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(folder)) {
      throw new BadRequestException(
        'the folder name may only contain letters, digits, "_" and "-"',
      );
    }

    const row = existing
      ? this.reciters.update(existing.id, {
          name: release.name,
          nameAr: release.nameAr,
          riwaya: release.riwaya,
          fileCount: release.surahCount,
          sizeBytes: release.sizeBytes,
          provider: release.provider,
          reciterId: release.reciterId,
          releaseId: release.releaseId,
          variant,
        })!
      : this.reciters.add({
          name: release.name,
          nameAr: release.nameAr,
          riwaya: release.riwaya,
          fileCount: release.surahCount,
          sizeBytes: release.sizeBytes,
          published: false,
          provider: release.provider,
          reciterId: release.reciterId,
          releaseId: release.releaseId,
          variant,
        });

    let primary: { seederId: number; jobId: string } | null = null;
    let lastError: unknown = null;
    for (const seederId of seederIds) {
      try {
        const job = await this.seeders.importRelease(seederId, {
          folderName: folder,
          name: folder,
          tracks: release.tracks,
        });
        if (!primary) primary = { seederId, jobId: job.jobId };
        else this.extras.set(job.jobId, { rowId: row.id, seederId });
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `import ${row.id} on node ${seederId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    if (!primary) {
      // Remove a row created for this attempt; a pre-existing linked draft is
      // the operator's row and stays.
      if (!existing) this.reciters.remove(row.id);
      throw lastError ?? new BadGatewayException('no node accepted the import');
    }
    return this.reciters.markImport(row.id, {
      jobId: primary.jobId,
      seederId: primary.seederId,
      folder,
      publish: input.publish !== false,
    })!;
  }

  async retry(id: number): Promise<Reciter> {
    const row = this.reciters.get(id);
    if (!row) throw new NotFoundException('reciter not found');
    if (
      !row.provider ||
      !row.reciterId ||
      !row.releaseId ||
      row.importSeederId === null ||
      !row.importFolder
    ) {
      throw new BadRequestException('this reciter has no import to retry');
    }

    let release;
    try {
      release = await this.registry
        .get(row.provider)
        .release(row.reciterId, row.releaseId, row.variant ?? '');
    } catch (err) {
      throw new BadGatewayException(
        `the provider could not resolve this release: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (release.tracks.length < 1 || release.tracks.length > FULL_QURAN) {
      throw new BadRequestException(`this release has ${release.tracks.length} tracks`);
    }

    const job = await this.seeders.importRelease(row.importSeederId, {
      folderName: row.importFolder,
      name: row.importFolder,
      tracks: release.tracks,
    });
    return this.reciters.markImport(id, {
      jobId: job.jobId,
      seederId: row.importSeederId,
      folder: row.importFolder,
      publish: row.importPublish,
    })!;
  }

  async cancel(id: number): Promise<{ cancelled: boolean }> {
    const active = this.reciters.listActiveImports().find((entry) => entry.id === id);
    if (!active) return { cancelled: false };
    try {
      await this.seeders.cancelImport(active.seederId, active.job);
    } catch (err) {
      // The row is still marked; the seeder will finish its current file and
      // then stop. A node that cannot be reached is not a reason to keep the
      // console showing progress forever.
      this.logger.warn(`cancel import ${id}: ${err instanceof Error ? err.message : err}`);
    }
    this.reciters.failImport(id, 'cancelled');
    return { cancelled: true };
  }

  /** Every active row, once every five seconds. */
  @Interval(5000)
  async poll(): Promise<void> {
    for (const active of this.reciters.listActiveImports()) {
      try {
        const status = await this.seeders.importStatus(active.seederId, active.job);
        if (status.state === 'done') {
          if (status.result) {
            this.reciters.completeImport(active.id, status.result, active.publish);
          } else {
            this.reciters.failImport(active.id, 'the node finished without a torrent');
          }
          continue;
        }
        if (status.state === 'failed') {
          this.reciters.failImport(active.id, status.error ?? 'the node failed the import');
          continue;
        }
        const total = status.total || FULL_QURAN;
        this.reciters.setImportProgress(
          active.id,
          status.state,
          (Math.min(status.done, total) / total) * 100,
        );
      } catch (err) {
        this.reciters.failImport(
          active.id,
          err instanceof Error ? err.message : 'the node could not be reached',
        );
      }
    }

    // The extra nodes do not own the row; they only need a placement once done.
    for (const [jobId, extra] of [...this.extras]) {
      try {
        const status = await this.seeders.importStatus(extra.seederId, jobId);
        if (status.state === 'done') {
          this.reciters.recordPlacement(extra.rowId, extra.seederId);
          this.extras.delete(jobId);
        } else if (status.state === 'failed') {
          this.logger.warn(
            `import ${extra.rowId} on node ${extra.seederId} failed: ${status.error ?? 'unknown'}`,
          );
          this.extras.delete(jobId);
        }
      } catch (err) {
        this.logger.warn(
          `import ${extra.rowId} on node ${extra.seederId}: ${err instanceof Error ? err.message : err}`,
        );
        this.extras.delete(jobId);
      }
    }
  }
}
