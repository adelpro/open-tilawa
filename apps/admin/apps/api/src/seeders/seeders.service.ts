import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';

/** Seeder admin calls are bounded: a hung seeder must not hang the dashboard. */
const SEEDER_TIMEOUT_MS = 8000;

/**
 * A seeder URL must be an http(s) origin. The dashboard makes server-side requests
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

  constructor(@Inject(SQLITE_DB) private readonly db: Db) {
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
        admin_pass TEXT
      )
    `);
    const cols = (this.db.pragma('table_info(seeders)') as { name: string }[]).map((c) => c.name);
    if (!cols.includes('admin_user'))
      this.db.exec('ALTER TABLE seeders ADD COLUMN admin_user TEXT');
    if (!cols.includes('admin_pass'))
      this.db.exec('ALTER TABLE seeders ADD COLUMN admin_pass TEXT');
  }

  list(): Seeder[] {
    return (
      this.db.prepare('SELECT * FROM seeders ORDER BY id').all() as Record<string, unknown>[]
    ).map(mapSeeder);
  }

  get(id: number): Seeder | null {
    const r = this.db.prepare('SELECT * FROM seeders WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    return r ? mapSeeder(r) : null;
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
    try {
      const res = await fetch(`${seeder.url}/health`, {
        signal: AbortSignal.timeout(SEEDER_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`health answered ${res.status}`);
      const data = (await res.json()) as {
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
      this.db
        .prepare(
          `UPDATE seeders SET status = 'online', last_seen = datetime('now'),
             torrent_count = ?, peer_count = ?, upload_speed = ?, download_speed = ? WHERE id = ?`,
        )
        .run(
          data.torrents ?? data.stats?.totalTorrents ?? 0,
          data.peers ?? data.stats?.totalPeers ?? 0,
          data.uploadSpeed ?? data.stats?.uploadSpeed ?? 0,
          data.downloadSpeed ?? data.stats?.downloadSpeed ?? 0,
          id,
        );
    } catch (err) {
      this.logger.debug(`seeder ${id} offline: ${(err as Error).message}`);
      this.db
        .prepare("UPDATE seeders SET status = 'offline', last_seen = datetime('now') WHERE id = ?")
        .run(id);
    }
    return this.get(id);
  }

  async pollAll(): Promise<Seeder[]> {
    await Promise.all(this.list().map((s) => this.poll(s.id)));
    return this.list();
  }

  // ---------- proxy: the seeder's own admin API, on the dashboard's behalf ----------

  async inventory(id: number): Promise<SeederInventory> {
    const seeder = await this.requireSeeder(id);
    const res = await this.call(seeder, '/api/torrents', { method: 'GET' });
    const body = await this.json<SeederInventory>(res);
    // A wrong URL that happens to answer 200 (any web UI) must not reach the
    // dashboard as a half-shaped object: the screen dereferences stats.torrents.
    if (!Array.isArray(body.torrents) || typeof body.stats !== 'object' || body.stats === null) {
      throw new BadGatewayException('the seeder answered, but not with a torrent inventory');
    }
    return body;
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

  async removeTorrent(id: number, infoHash: string): Promise<void> {
    const seeder = await this.requireSeeder(id);
    const res = await this.call(seeder, `/api/torrents/${encodeURIComponent(infoHash)}`, {
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
  ): Promise<Seeder & { adminUser: string | null; adminPass: string | null }> {
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
   * credentials. Failures are translated at the boundary so the dashboard can
   * tell "the node is unreachable" from "the node refused the credentials".
   */
  private async call(
    seeder: Seeder & { adminUser: string | null; adminPass: string | null },
    pathname: string,
    init: RequestInit,
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
        signal: AbortSignal.timeout(SEEDER_TIMEOUT_MS),
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

function mapSeeder(r: Record<string, unknown>): Seeder {
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
  };
}
