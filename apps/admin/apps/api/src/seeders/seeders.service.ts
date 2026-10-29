import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { SQLITE_DB } from '../store/store.module';
import { AuditRepository, isExpired, nextPlacementState, type Db } from '@tilawa-admin/core';
import { updateSeederService } from './seeder-update';

/** Seeder admin calls are bounded: a hung seeder must not hang the console. */
const SEEDER_TIMEOUT_MS = 8000;

/**
 * A seeder URL must be an http(s) origin. The console makes server-side requests
 * to it, so anything else (file:, gopher:) is a proxy primitive we do not need;
 * private hosts are legitimate here (nodes live inside the operator's network),
 * which is why this validates the scheme rather than the address.
 */
export function assertSeederUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('the seeder URL must be an absolute http:// or https:// URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('the seeder URL must use http:// or https://');
  }
  return raw.replace(/\/$/, '');
}

type BaseSeeder = Omit<
  Seeder,
  'pinned' | 'updateMode' | 'desiredVersion' | 'updating' | 'updateError'
>;

export interface Seeder {
  id: number;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  torrentCount: number;
  peerCount: number;
  uploadSpeed: number;
  downloadSpeed: number;
  /** True when Basic-auth credentials are stored; the password never leaves the API. */
  hasCredentials: boolean;
  /** Seeder release reported by its /health, e.g. "1.2.0". */
  version: string | null;
  /** Build SHA the node was stamped with, when it reports one. */
  sha: string | null;
  /** Disk space on the node's data volume, from its /health. */
  freeBytes: number | null;
  totalBytes: number | null;
  /** Operator cap on this node (0 = unlimited), from its /health. */
  quotaBytes: number | null;
  /** What the node currently holds, by torrent length. */
  usedBytes: number | null;
  /** How much more the node will accept right now (quota and disk combined). */
  headroomBytes: number | null;
  /**
   * The node the console itself runs. Pinned to the top of the fleet because
   * if it is down the site is dead, and recognised by its URL host matching
   * SEEDER_SERVICE rather than by a flag someone has to remember to set.
   */
  pinned: boolean;
  /** How this node is updated: compiled from the checkout, or pulled by tag. */
  updateMode: 'build' | 'pull';
  /** The version the operator's source of truth says it should run. */
  desiredVersion: string | null;
  /** True while a software update is running on this host. */
  updating: boolean;
  /** The last update's failure, kept until the next one starts. */
  updateError: string | null;
}

/** One torrent as the seeder reports it. */
export interface SeederTorrent {
  name: string;
  infoHash: string;
  size: number;
  progress: string;
  peers: number;
  uploadSpeed: number;
  downloadSpeed: number;
  uploaded: number;
  downloaded: number;
  files: number;
  done: boolean;
}

export interface SeederInventory {
  torrents: SeederTorrent[];
  stats: {
    totalTorrents: number;
    totalPeers: number;
    uploadSpeed: number;
    downloadSpeed: number;
  };
}

@Injectable()
export class SeedersService {
  private readonly logger = new Logger(SeedersService.name);
  /**
   * Software updates in flight, keyed by node. Presence is the progress the
   * console shows; the error survives the run so the screen can report it.
   */
  private readonly updates = new Map<number, { running: boolean; error: string | null }>();

  constructor(
    @Inject(SQLITE_DB) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly audit: AuditRepository,
  ) {
    this.ensureSchema();
  }

  /**
   * Schema lives here, not in a migration (the fork's service-managed table
   * pattern): the production database predates the migration history for these
   * tables, and `CREATE TABLE IF NOT EXISTS` would silently skip new columns.
   * Adding each missing column in place is what makes both shapes converge.
   */
  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS seeders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'unknown',
        last_seen TEXT,
        torrent_count INTEGER NOT NULL DEFAULT 0,
        peer_count INTEGER NOT NULL DEFAULT 0,
        upload_speed INTEGER NOT NULL DEFAULT 0,
        download_speed INTEGER NOT NULL DEFAULT 0,
        admin_user TEXT,
        admin_pass TEXT,
        version TEXT,
        sha TEXT,
        free_bytes INTEGER,
        total_bytes INTEGER,
        quota_bytes INTEGER,
        used_bytes INTEGER,
        headroom_bytes INTEGER
      )
    `);
    const cols = (this.db.pragma('table_info(seeders)') as { name: string }[]).map((c) => c.name);
    const add = (column: string, type: string): void => {
      if (!cols.includes(column)) this.db.exec(`ALTER TABLE seeders ADD COLUMN ${column} ${type}`);
    };
    add('admin_user', 'TEXT');
    add('admin_pass', 'TEXT');
    add('version', 'TEXT');
    add('sha', 'TEXT');
    add('free_bytes', 'INTEGER');
    add('total_bytes', 'INTEGER');
    add('quota_bytes', 'INTEGER');
    add('used_bytes', 'INTEGER');
    add('headroom_bytes', 'INTEGER');
  }

  list(): Seeder[] {
    return (
      this.db.prepare('SELECT * FROM seeders ORDER BY id').all() as Record<string, unknown>[]
    ).map((row) => this.decorate(mapSeeder(row)));
  }

  get(id: number): Seeder | null {
    const r = this.db.prepare('SELECT * FROM seeders WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    return r ? this.decorate(mapSeeder(r)) : null;
  }

  /**
   * Adds the two facts that are not in the row: whether this is the console's
   * own node, and which version the deployment says it should be running.
   */
  private decorate(seeder: BaseSeeder): Seeder {
    const service = this.config.get<string>('SEEDER_SERVICE') ?? 'seeder';
    const mode: 'build' | 'pull' =
      this.config.get<string>('SEEDER_UPDATE_MODE') === 'build' ? 'build' : 'pull';
    return {
      ...seeder,
      pinned: isServiceHost(seeder.url, service),
      updateMode: mode,
      desiredVersion: mode === 'build' ? treeVersion() : tagVersion(imageTag()),
      updating: this.updates.get(seeder.id)?.running ?? false,
      updateError: this.updates.get(seeder.id)?.error ?? null,
    };
  }

  add(input: {
    name: string;
    url: string;
    adminUser?: string | null;
    adminPass?: string | null;
  }): Seeder {
    const info = this.db
      .prepare('INSERT INTO seeders (name, url, admin_user, admin_pass) VALUES (?, ?, ?, ?)')
      .run(
        input.name,
        assertSeederUrl(input.url),
        input.adminUser ?? null,
        input.adminPass ?? null,
      );
    return this.get(Number(info.lastInsertRowid))!;
  }

  /**
   * Edits a row in place. Credentials are tri-state: omitted keeps what is
   * stored, `null` clears it, a string replaces it. Without this, a node
   * registered before the credentials feature (or one whose password changed)
   * could only be fixed by deleting it and losing its state.
   */
  update(
    id: number,
    input: {
      name?: string;
      url?: string;
      adminUser?: string | null;
      adminPass?: string | null;
    },
  ): Seeder | null {
    if (!this.db.prepare('SELECT id FROM seeders WHERE id = ?').get(id)) return null;
    const sets: string[] = [];
    const values: unknown[] = [];
    if (input.name !== undefined) {
      sets.push('name = ?');
      values.push(input.name);
    }
    if (input.url !== undefined) {
      sets.push('url = ?');
      values.push(assertSeederUrl(input.url));
    }
    if (input.adminUser !== undefined) {
      sets.push('admin_user = ?');
      values.push(emptyToNull(input.adminUser));
    }
    if (input.adminPass !== undefined) {
      sets.push('admin_pass = ?');
      values.push(emptyToNull(input.adminPass));
    }
    if (sets.length > 0) {
      this.db.prepare(`UPDATE seeders SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
    }
    return this.get(id);
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM seeders WHERE id = ?').run(id);
  }

  /** Health check (public endpoint on the seeder; used for the status chip). */
  async poll(id: number): Promise<Seeder | null> {
    const seeder = this.get(id);
    if (!seeder) return null;

    let data: {
      version?: string;
      sha?: string;
      disk?: { free?: number; total?: number };
      quotaBytes?: number;
      usedBytes?: number;
      headroomBytes?: number;
      torrents?: number;
      peers?: number;
      uploadSpeed?: number;
      downloadSpeed?: number;
      stats?: {
        totalTorrents?: number;
        totalPeers?: number;
        uploadSpeed?: number;
        downloadSpeed?: number;
      };
    };
    try {
      const res = await fetch(`${seeder.url}/health`, {
        signal: AbortSignal.timeout(SEEDER_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`health answered ${res.status}`);
      data = (await res.json()) as typeof data;
    } catch (err) {
      // Only the reachability half decides the status. A failure in the write
      // below is our bug and must surface, not paint a healthy node offline —
      // that masking is what made a missing column look like a dead seeder.
      this.logger.debug(`seeder ${id} offline: ${(err as Error).message}`);
      this.db
        .prepare("UPDATE seeders SET status = 'offline', last_seen = datetime('now') WHERE id = ?")
        .run(id);
      return this.get(id);
    }

    this.db
      .prepare(
        `UPDATE seeders SET status = 'online', last_seen = datetime('now'),
           torrent_count = ?, peer_count = ?, upload_speed = ?, download_speed = ?,
           version = ?, sha = ?, free_bytes = ?, total_bytes = ?,
           quota_bytes = ?, used_bytes = ?, headroom_bytes = ? WHERE id = ?`,
      )
      .run(
        data.torrents ?? data.stats?.totalTorrents ?? 0,
        data.peers ?? data.stats?.totalPeers ?? 0,
        data.uploadSpeed ?? data.stats?.uploadSpeed ?? 0,
        data.downloadSpeed ?? data.stats?.downloadSpeed ?? 0,
        data.version ?? null,
        data.sha ?? null,
        data.disk?.free ?? null,
        data.disk?.total ?? null,
        data.quotaBytes ?? null,
        data.usedBytes ?? null,
        data.headroomBytes ?? null,
        id,
      );

    // A healthy node is also the only moment we can learn what it holds. A
    // failure here is ours, not the node's, so it must not mark it offline.
    await this.reconcileInventory(id).catch((error) =>
      this.logger.warn(`reconcile of node ${id} failed: ${(error as Error).message}`),
    );
    return this.get(id);
  }

  async pollAll(): Promise<Seeder[]> {
    await Promise.all(this.list().map((s) => this.poll(s.id)));
    return this.list();
  }

  /**
   * Fold one node's inventory into `node_torrents` and settle its placements.
   *
   * This is what turns "which node holds this reciter" from a fan-out into a
   * join, and what makes a placement observable: a request stays pending until
   * the node's own report confirms it. A node that cannot be read keeps its last
   * known answer — silence is not evidence of an empty node.
   */
  private async reconcileInventory(id: number): Promise<void> {
    const row = this.db
      .prepare('SELECT admin_user, admin_pass FROM seeders WHERE id = ?')
      .get(id) as { admin_user?: string | null; admin_pass?: string | null } | undefined;
    if (!row?.admin_user || !row?.admin_pass) return;

    let torrents: SeederTorrent[];
    try {
      torrents = (await this.inventory(id)).torrents;
    } catch (error) {
      this.logger.debug(`node ${id} inventory unavailable: ${(error as Error).message}`);
      return;
    }

    const now = new Date().toISOString();
    const upsert = this.db.prepare(
      `INSERT INTO node_torrents (seeder_id, infohash, name, size, done, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(seeder_id, infohash) DO UPDATE SET
         name = excluded.name, size = excluded.size, done = excluded.done,
         last_seen = excluded.last_seen`,
    );
    const remove = this.db.prepare(
      'DELETE FROM node_torrents WHERE seeder_id = ? AND infohash = ?',
    );
    const markPlaced = this.db.prepare(
      `UPDATE placements SET state = 'placed', verified_at = ?, error = NULL
       WHERE seeder_id = ? AND reciter_id = ?`,
    );
    const markFailed = this.db.prepare(
      `UPDATE placements SET state = 'failed', error = ? WHERE seeder_id = ? AND reciter_id = ?`,
    );

    this.db.transaction(() => {
      const seen = new Set<string>();
      // Only a finished torrent is "placed": a download in progress is present
      // in the inventory but cannot be played yet.
      const complete = new Set<string>();
      for (const torrent of torrents) {
        const hash = torrent.infoHash.toLowerCase();
        seen.add(hash);
        if (torrent.done) complete.add(hash);
        upsert.run(id, hash, torrent.name, torrent.size, torrent.done ? 1 : 0, now, now);
      }

      const known = this.db
        .prepare('SELECT infohash FROM node_torrents WHERE seeder_id = ?')
        .all(id) as { infohash: string }[];
      for (const { infohash } of known) {
        if (!seen.has(infohash)) remove.run(id, infohash);
      }

      const placements = this.db
        .prepare(
          `SELECT p.reciter_id, p.state, p.requested_at, lower(r.infohash) AS hash
           FROM placements p JOIN reciters r ON r.id = p.reciter_id
           WHERE p.seeder_id = ?`,
        )
        .all(id) as { reciter_id: number; state: string; requested_at: string; hash: string }[];

      for (const placement of placements) {
        const next = nextPlacementState({
          current: placement.state as 'pending' | 'placed' | 'failed',
          observed: complete.has(placement.hash),
          expired: isExpired(placement.requested_at),
        });
        if (next.state === 'placed' && placement.state !== 'placed') {
          markPlaced.run(now, id, placement.reciter_id);
        } else if (next.state === 'failed' && placement.state !== 'failed') {
          markFailed.run(next.error, id, placement.reciter_id);
        }
      }
    })();
  }

  /**
   * Fail placements that have waited longer than the TTL. Runs on its own beat,
   * because a node that never answers must not leave a request pending forever:
   * "we asked and nothing happened" is a failure the operator has to see.
   */
  expirePlacements(): number {
    const rows = this.db
      .prepare("SELECT reciter_id, seeder_id, requested_at FROM placements WHERE state = 'pending'")
      .all() as { reciter_id: number; seeder_id: number; requested_at: string }[];
    const fail = this.db.prepare(
      "UPDATE placements SET state = 'failed', error = 'not confirmed within 3 hours' WHERE reciter_id = ? AND seeder_id = ?",
    );
    let expired = 0;
    this.db.transaction(() => {
      for (const row of rows) {
        if (!isExpired(row.requested_at)) continue;
        fail.run(row.reciter_id, row.seeder_id);
        expired += 1;
      }
    })();
    return expired;
  }

  /**
   * Updates the seeder service on this host through Docker.
   *
   * Deliberately narrow: one service, one compose file, no user input. It is off
   * unless `SEEDER_UPDATE=1` is set, because it needs the daemon socket and that
   * is a decision the deployment makes, not a default.
   *
   * Only the node this console runs may be updated here. The command drives the
   * host's Docker socket, so running it for a remote row would rebuild the local
   * seeder and then report a version that never changed.
   *
   * It returns as soon as the job starts. A build takes minutes and the console
   * answers through a proxy that gives up long before that, so progress is the
   * row's `updating` flag and the outcome is the audit entry.
   */
  async updateSoftware(
    id: number,
    actorId?: number,
  ): Promise<{ started: true; mode: 'build' | 'pull' }> {
    const seeder = this.get(id);
    if (!seeder) throw new NotFoundException('seeder not found');
    if (!seeder.pinned) {
      throw new BadRequestException("only this host's own node can be updated from here");
    }
    if (this.config.get<string>('SEEDER_UPDATE') !== '1') {
      throw new ServiceUnavailableException(
        'node updates are not enabled on this deployment (set SEEDER_UPDATE=1 and mount the Docker socket)',
      );
    }
    if (this.updates.get(id)?.running) {
      throw new ConflictException('an update is already running on this node');
    }
    const mode = this.config.get<string>('SEEDER_UPDATE_MODE') === 'build' ? 'build' : 'pull';
    this.updates.set(id, { running: true, error: null });
    void this.runUpdate(id, mode, actorId);
    return { started: true, mode };
  }

  /** Never rejects: the job reports itself through the row and the audit trail. */
  private async runUpdate(id: number, mode: 'build' | 'pull', actorId?: number): Promise<void> {
    let error: string | null = null;
    try {
      await updateSeederService({
        composeFile: this.config.get<string>('SEEDER_COMPOSE_FILE') ?? '/host/docker-compose.yml',
        project: this.config.get<string>('SEEDER_COMPOSE_PROJECT') ?? 'open-tilawa',
        service: this.config.get<string>('SEEDER_SERVICE') ?? 'seeder',
        mode,
        timeoutMs: Number(this.config.get<string>('SEEDER_UPDATE_TIMEOUT_MS') ?? 600_000),
      });
      // The node comes back on a new image; re-read /health so the row shows the
      // version it is actually running rather than the one it had before. The
      // container is only "started" when compose returns, so give the process a
      // few seconds to bind its port before calling the absence of an answer a
      // failed update.
      let updated = await this.poll(id);
      for (let attempt = 0; attempt < 12 && updated?.status !== 'online'; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        updated = await this.poll(id);
      }
      this.logger.log(`seeder ${id} updated (${mode}) -> ${updated?.version ?? 'unknown'}`);
    } catch (err) {
      error = (err as Error).message;
      this.logger.warn(`seeder ${id} update failed: ${error}`);
    } finally {
      this.updates.set(id, { running: false, error });
    }
    this.audit.record({
      actorId: actorId ?? null,
      userId: id,
      action: 'seeder:update',
      target: String(id),
      status: error ? 'error' : 'ok',
      after: { mode, error, version: this.get(id)?.version ?? null },
    });
  }

  // ---------- proxy: the seeder's own admin API, on the console's behalf ----------

  async inventory(id: number): Promise<SeederInventory> {
    const seeder = await this.requireSeeder(id);
    const res = await this.call(seeder, '/api/torrents', { method: 'GET' });
    const body = await this.json<SeederInventory>(res);
    // A wrong URL that happens to answer 200 (any web UI) must not reach the
    // console as a half-shaped object: the screen dereferences stats.torrents.
    if (!Array.isArray(body.torrents) || typeof body.stats !== 'object' || body.stats === null) {
      throw new BadGatewayException('the seeder answered, but not with a torrent inventory');
    }
    return body;
  }

  /** Resolve a magnet's metadata through a node (no data kept on the node). */
  async metadata(
    id: number,
    magnet: string,
  ): Promise<{
    name: string;
    infoHash: string;
    size: number;
    files: number;
    magnet: string;
  }> {
    const seeder = await this.requireSeeder(id);
    const res = await this.call(
      seeder,
      '/api/metadata',
      {
        method: 'POST',
        body: JSON.stringify({ magnet }),
        headers: { 'Content-Type': 'application/json' },
      },
      30_000,
    );
    return this.json(res);
  }

  async files(id: number): Promise<string[]> {
    const seeder = await this.requireSeeder(id);
    const res = await this.call(seeder, '/api/files', { method: 'GET' });
    const body = await this.json<{ files?: unknown }>(res);
    return Array.isArray(body.files) ? (body.files as string[]) : [];
  }

  async addTorrent(
    id: number,
    input: { magnet?: string; torrentPath?: string },
  ): Promise<{ ok: boolean; name?: string; infoHash?: string }> {
    const seeder = await this.requireSeeder(id);
    const res = await this.call(seeder, '/api/torrents', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    });
    return this.json<{ ok: boolean; name?: string; infoHash?: string }>(res);
  }

  async removeTorrent(id: number, infoHash: string, keepData = false): Promise<void> {
    const seeder = await this.requireSeeder(id);
    const suffix = keepData ? '?keepData=1' : '';
    const res = await this.call(seeder, `/api/torrents/${encodeURIComponent(infoHash)}${suffix}`, {
      method: 'DELETE',
    });
    if (res.status === 404) throw new NotFoundException('the seeder does not hold that torrent');
  }

  /** One body read that explains itself when the peer is not answering JSON. */
  private async json<T>(res: Response): Promise<T> {
    try {
      return (await res.json()) as T;
    } catch {
      throw new BadGatewayException('the seeder answered with a non-JSON body');
    }
  }

  private async requireSeeder(
    id: number,
  ): Promise<BaseSeeder & { adminUser: string | null; adminPass: string | null }> {
    const row = this.db.prepare('SELECT * FROM seeders WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    if (!row) throw new NotFoundException('seeder not found');
    return {
      ...mapSeeder(row),
      adminUser: (row.admin_user as string | null) ?? null,
      adminPass: (row.admin_pass as string | null) ?? null,
    };
  }

  /**
   * One HTTP call to the seeder, authenticated with the row's stored Basic
   * credentials. Failures are translated at the boundary so the console can
   * tell "the node is unreachable" from "the node refused the credentials".
   */
  private async call(
    seeder: BaseSeeder & { adminUser: string | null; adminPass: string | null },
    pathname: string,
    init: RequestInit,
    timeoutMs = SEEDER_TIMEOUT_MS,
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!seeder.adminUser || !seeder.adminPass) {
      throw new BadGatewayException(
        'no credentials stored for this seeder — edit the row and add the admin user and password',
      );
    }
    if (seeder.adminUser && seeder.adminPass) {
      headers.set(
        'Authorization',
        `Basic ${Buffer.from(`${seeder.adminUser}:${seeder.adminPass}`).toString('base64')}`,
      );
    }
    let res: Response;
    try {
      res = await fetch(`${seeder.url}${pathname}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const error = err as Error;
      const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
      throw new BadGatewayException(
        timedOut
          ? `seeder timed out after ${SEEDER_TIMEOUT_MS}ms`
          : `seeder unreachable: ${error.message}`,
      );
    }
    if (res.status === 401) {
      throw new BadGatewayException('the seeder refused the stored credentials');
    }
    if (!res.ok && res.status !== 404) {
      const detail = await res.text().catch(() => '');
      throw new BadGatewayException(
        `seeder answered ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`,
      );
    }
    return res;
  }
}

function emptyToNull(value: string | null): string | null {
  if (value === null) return null;
  return value.trim() === '' ? null : value;
}

/** `http://seeder:8085` is the node this console manages, in its own project. */
function isServiceHost(url: string, service: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === service.toLowerCase();
  } catch {
    return false;
  }
}

/** The version in the checkout the host builds from. */
function treeVersion(): string | null {
  try {
    const pkg = JSON.parse(readFileSync('/host/apps/seeder/package.json', 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

/** The image tag this host deploys, when it pulls rather than builds. */
function imageTag(): string | null {
  try {
    const env = readFileSync('/host/.env', 'utf8');
    const match = env.match(/^SEEDER_IMAGE=(.*)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * A registry tag is only a version when it carries one. `:latest` and `:local`
 * say nothing, and pretending they do would make every node look up to date.
 */
function tagVersion(tag: string | null): string | null {
  if (!tag) return null;
  const match = tag.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function mapSeeder(r: Record<string, unknown>): BaseSeeder {
  return {
    id: r.id as number,
    name: r.name as string,
    url: r.url as string,
    status: r.status as Seeder['status'],
    lastSeen: (r.last_seen as string | null) ?? null,
    torrentCount: r.torrent_count as number,
    peerCount: r.peer_count as number,
    uploadSpeed: r.upload_speed as number,
    downloadSpeed: r.download_speed as number,
    hasCredentials: Boolean(r.admin_user && r.admin_pass),
    version: (r.version as string | null) ?? null,
    sha: (r.sha as string | null) ?? null,
    freeBytes: (r.free_bytes as number | null) ?? null,
    totalBytes: (r.total_bytes as number | null) ?? null,
    quotaBytes: (r.quota_bytes as number | null) ?? null,
    usedBytes: (r.used_bytes as number | null) ?? null,
    headroomBytes: (r.headroom_bytes as number | null) ?? null,
  };
}
