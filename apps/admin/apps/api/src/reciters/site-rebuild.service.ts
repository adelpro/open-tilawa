import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditRepository, type Db } from '@tilawa-admin/core';
import { SQLITE_DB } from '../store/store.module';
import {
  diffSite,
  projectSite,
  readSiteManifest,
  type SiteDiff,
  type SiteManifest,
  type SiteRelease,
  type SiteRow,
} from './site-projection';
import { dirtyTreeFiles, rebuildSiteService } from './site-rebuild';

export interface SiteBuildRow {
  status: 'running' | 'ok' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  actorId: number | null;
  deployedCount: number | null;
}

export interface SiteStatus {
  state: 'in-sync' | 'drift' | 'unknown' | 'building' | 'failed';
  deployedAt: string | null;
  deployedCount: number | null;
  added: SiteRelease[];
  removed: SiteRelease[];
  renamed: SiteDiff['renamed'];
  building: boolean;
  lastBuild: SiteBuildRow | null;
  /** Why the action is unavailable; `null` when it is available. */
  blockedBy: 'dirty-tree' | 'building' | 'unsupported' | null;
  dirtyFiles: string[];
  /** Why the clean-tree check itself failed, when it did. */
  treeError: string | null;
  /** Why the deployed manifest could not be read, when it could not. */
  manifestError: string | null;
  canRebuild: boolean;
}

/**
 * The public site is a static build: its pages and sitemap are written at build
 * time. The app's roster is live from the API, so this service is only about the
 * HTML — which is why publishing a reciter does not start a build by itself.
 *
 * The decision is a diff, not a flag: the build stamps `/site-version.json`, and
 * a manual deploy clears the notice exactly like one started here. The action
 * drives the host's Docker daemon, so it stays admin-only, audited, fixed to the
 * web service, and gated on a clean `apps/web` tree.
 */
@Injectable()
export class SiteRebuildService implements OnModuleInit {
  private readonly logger = new Logger(SiteRebuildService.name);

  constructor(
    @Inject(SQLITE_DB) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly audit: AuditRepository,
  ) {}

  onModuleInit(): void {
    // A process that died mid-build leaves `running` behind. The daemon may have
    // finished the build, but the recreate step lived in this process, so the site
    // is not known to be updated.
    this.db
      .prepare(
        `UPDATE site_builds
            SET status = 'failed', finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                error = 'interrupted by a restart'
          WHERE status = 'running'
            AND julianday(started_at) < julianday('now', '-20 minutes')`,
      )
      .run();
  }

  private get publicSite(): string {
    return (this.config.get<string>('PUBLIC_SITE') ?? 'https://tilawah.cc').replace(/\/+$/, '');
  }

  private get settings() {
    return {
      composeFile: this.config.get<string>('SITE_COMPOSE_FILE') ?? '/host/docker-compose.yml',
      project: this.config.get<string>('SITE_COMPOSE_PROJECT') ?? 'open-tilawa',
      service: this.config.get<string>('SITE_SERVICE') ?? 'web',
      timeoutMs: Number(this.config.get<string>('SITE_REBUILD_TIMEOUT_MS') ?? 600_000),
    };
  }

  async status(): Promise<SiteStatus> {
    this.onModuleInit();
    const current = this.currentProjection();
    const { manifest, error: manifestError } = await this.deployedManifest();
    const lastBuild = this.lastBuild();
    const building = lastBuild?.status === 'running';

    let dirtyFiles: string[] = [];
    let treeError: string | null = null;
    try {
      dirtyFiles = await dirtyTreeFiles();
    } catch (err) {
      treeError = (err as Error).message;
    }

    const diff = manifest
      ? diffSite(current, manifest.releases)
      : { added: [], removed: [], renamed: [], changed: false };

    let state: SiteStatus['state'];
    if (building) state = 'building';
    else if (!manifest) state = 'unknown';
    else if (diff.changed) state = lastBuild?.status === 'failed' ? 'failed' : 'drift';
    else state = 'in-sync';

    const blockedBy: SiteStatus['blockedBy'] = building
      ? 'building'
      : treeError
        ? 'unsupported'
        : dirtyFiles.length > 0
          ? 'dirty-tree'
          : null;

    return {
      state,
      deployedAt: manifest?.builtAt ?? null,
      deployedCount: manifest?.releases.length ?? null,
      added: diff.added,
      removed: diff.removed,
      renamed: diff.renamed,
      building,
      lastBuild,
      blockedBy,
      dirtyFiles,
      treeError,
      manifestError,
      canRebuild: blockedBy === null && state !== 'in-sync',
    };
  }

  /**
   * Start one build. Returns as soon as the job is recorded: a build takes minutes
   * and the console's proxy gives up long before that, so progress is the row and
   * the outcome is the audit entry.
   */
  async start(
    actorId?: number | null,
    force = false,
  ): Promise<{ started: true; id: number }> {
    const status = await this.status();
    if (status.building) throw new ConflictException('a site rebuild is already running');
    if (status.treeError) {
      throw new ServiceUnavailableException(
        `the clean-tree check could not run: ${status.treeError}`,
      );
    }
    if (status.dirtyFiles.length > 0) {
      throw new ConflictException(
        `the web build would ship uncommitted changes: ${status.dirtyFiles.join(', ')}`,
      );
    }
    if (!status.canRebuild && !force) {
      throw new BadRequestException('the deployed site already matches the catalogue');
    }

    let id: number;
    try {
      const info = this.db
        .prepare('INSERT INTO site_builds (status, actor_id) VALUES (?, ?)')
        .run('running', actorId ?? null);
      id = Number(info.lastInsertRowid);
    } catch {
      // The partial unique index caught a second press that passed the status
      // check a moment earlier.
      throw new ConflictException('a site rebuild is already running');
    }
    void this.run(id, actorId ?? null);
    return { started: true, id };
  }

  private async run(id: number, actorId: number | null): Promise<void> {
    let error: string | null = null;
    let deployedCount: number | null = null;
    try {
      const output = await rebuildSiteService(this.settings);
      const { manifest } = await this.deployedManifest();
      deployedCount = manifest?.releases.length ?? null;
      this.logger.log(`site rebuilt (${deployedCount ?? 'unknown'} releases) ${output}`);
    } catch (err) {
      error = (err as Error).message;
      this.logger.warn(`site rebuild failed: ${error}`);
    } finally {
      this.db
        .prepare(
          `UPDATE site_builds
              SET status = ?, finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                  error = ?, deployed_count = ?
            WHERE id = ?`,
        )
        .run(error ? 'failed' : 'ok', error, deployedCount, id);
    }

    this.audit.record({
      actorId,
      action: 'reciter:site_rebuild',
      target: 'web',
      status: error ? 'error' : 'ok',
      after: { deployedCount, error },
    });
  }

  private currentProjection(): SiteRelease[] {
    // The same conditions as the public endpoint: a draft, or a row without a
    // torrent, is not on the site and must not make the console claim drift.
    const rows = this.db
      .prepare(
        `SELECT slug, name, name_ar AS nameAr, riwaya, surahs
           FROM reciters
          WHERE published = 1 AND infohash <> '' AND magnet <> ''
          ORDER BY id`,
      )
      .all() as SiteRow[];
    return projectSite(rows);
  }

  private async deployedManifest(): Promise<{
    manifest: SiteManifest | null;
    error: string | null;
  }> {
    try {
      const response = await fetch(
        `${this.publicSite}/site-version.json?ts=${Date.now()}`,
        {
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!response.ok) {
        return { manifest: null, error: `the site answered ${response.status}` };
      }
      const manifest = readSiteManifest(await response.json());
      return {
        manifest,
        error: manifest ? null : 'the site version file is not in the expected shape',
      };
    } catch (err) {
      return { manifest: null, error: (err as Error).message };
    }
  }

  private lastBuild(): SiteBuildRow | null {
    const row = this.db
      .prepare(
        `SELECT status, started_at AS startedAt, finished_at AS finishedAt,
                error, actor_id AS actorId, deployed_count AS deployedCount
           FROM site_builds ORDER BY id DESC LIMIT 1`,
      )
      .get() as SiteBuildRow | undefined;
    return row ?? null;
  }
}
