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
    seederId: number;
    folderName?: string;
    publish?: boolean;
  }): Promise<Reciter> {
    if (!Number.isInteger(input.seederId) || input.seederId <= 0) {
      throw new BadRequestException('choose a seeder node');
    }
    const provider = this.registry.get(input.provider);
    let release;
    try {
      release = await provider.release(input.reciterId, input.releaseId, input.variant);
    } catch (err) {
      throw new BadGatewayException(
        `the provider could not resolve this release: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (release.tracks.length !== FULL_QURAN) {
      throw new BadRequestException(
        `this release has ${release.tracks.length} tracks; a torrent needs ${FULL_QURAN}`,
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
      throw new ConflictException(`this release is already linked to row ${existing.id}`);
    }

    const folder = input.folderName?.trim() || folderFromRelease(release.name, release.riwaya);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(folder)) {
      throw new BadRequestException(
        'the folder name may only contain letters, digits, "_" and "-"',
      );
    }

    const row = this.reciters.add({
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

    try {
      const job = await this.seeders.importRelease(input.seederId, {
        folderName: folder,
        name: folder,
        tracks: release.tracks,
      });
      return this.reciters.markImport(row.id, {
        jobId: job.jobId,
        seederId: input.seederId,
        folder,
        publish: input.publish !== false,
      })!;
    } catch (err) {
      // The node never accepted the job, so the draft would be a row with no
      // torrent and no future. Remove it rather than leave a dead row.
      this.reciters.remove(row.id);
      throw err;
    }
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
    if (release.tracks.length !== FULL_QURAN) {
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
  }
}
