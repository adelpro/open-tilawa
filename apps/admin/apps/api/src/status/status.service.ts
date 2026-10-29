import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';

/** How long a check is kept: 7 days at a 5-minute beat is 2016 rows/service. */
const RETENTION_DAYS = 7;
const CHECK_TIMEOUT_MS = 8_000;

export type ServiceKind = 'http' | 'ws';

export interface ServiceRow {
  id: number;
  name: string;
  url: string;
  /** How the check talks to it: an HTTP request, or a WebSocket handshake. */
  kind: ServiceKind;
  enabled: boolean;
}

/** A service is checked with the protocol it names; sockets get a handshake. */
export function serviceKind(protocol: string): ServiceKind {
  return protocol === 'ws:' || protocol === 'wss:' ? 'ws' : 'http';
}

export interface ServiceOverview {
  id: number;
  name: string;
  url: string;
  kind: ServiceKind;
  ok: boolean | null;
  latencyMs: number | null;
  version: string | null;
  detail: string | null;
  lastCheckedAt: string | null;
  uptime24h: number | null;
  /** 24 hourly buckets, oldest first: null when the service was not checked. */
  timeline: (number | null)[];
}

/**
 * Service health with a timeline.
 *
 * Most of the stack is reached over HTTP — the public site, the tracker's /stats, the
 * admin API's /health and the console — so an HTTP check answers for them.
 *
 * The GunDB relay is the exception: it speaks WebSocket at /gun and has no status
 * page at all, so a GET proves nothing. It is checked with a handshake, because that
 * is the whole path accounts depend on (DNS → Cloudflare → tunnel → gun). Nodes and
 * TURN keep their own monitors (richer than a probe); the overview joins them rather
 * than duplicating theirs.
 */
@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);

  constructor(@Inject(SQLITE_DB) private readonly db: Db) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL DEFAULT 'http',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS service_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        checked_at TEXT NOT NULL DEFAULT (datetime('now')),
        ok INTEGER NOT NULL,
        latency_ms INTEGER,
        version TEXT,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS service_checks_service_idx ON service_checks (service_id, id DESC);
    `);
    this.ensureKindColumn();
    this.seedDefaults();
  }

  /**
   * The table predates the WebSocket kind: an install that already has services gets
   * the column rather than a fresh database.
   */
  private ensureKindColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(services)').all() as { name: string }[];
    if (columns.some((column) => column.name === 'kind')) return;
    this.db.exec("ALTER TABLE services ADD COLUMN kind TEXT NOT NULL DEFAULT 'http'");
  }

  /**
   * A fresh install should open the status page with something on it.
   *
   * The relay is seeded on every start rather than only on an empty table: accounts,
   * pairing and counters are dead without it, and it is the one dependency a console
   * must not be able to be blind to. Removing the row therefore lasts until the next
   * restart, which is the honest behaviour for a required backend.
   */
  private seedDefaults(): void {
    const port = process.env.PORT ?? '9410';
    const defaults: { name: string; url: string; kind: ServiceKind }[] = [
      { name: 'Public site', url: 'https://tilawah.cc/', kind: 'http' },
      { name: 'Tracker', url: 'https://tracker.tilawah.cc/stats', kind: 'http' },
      { name: 'Admin API', url: `http://127.0.0.1:${port}/api/health`, kind: 'http' },
      { name: 'Admin console', url: 'http://admin-web:80/', kind: 'http' },
      { name: 'GunDB relay', url: 'wss://gun.tilawah.cc/gun', kind: 'ws' },
    ];
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO services (name, url, kind) VALUES (?, ?, ?)',
    );
    const count = (this.db.prepare('SELECT COUNT(*) AS n FROM services').get() as { n: number }).n;
    for (const service of defaults) {
      // On a populated table only the relay is enforced; the other four stay choices.
      if (count > 0 && service.kind !== 'ws') continue;
      insert.run(service.name, service.url, service.kind);
    }
  }

  list(): ServiceRow[] {
    return (
      this.db
        .prepare('SELECT id, name, url, kind, enabled FROM services ORDER BY id')
        .all() as {
        id: number;
        name: string;
        url: string;
        kind: string;
        enabled: number;
      }[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      kind: row.kind === 'ws' ? 'ws' : 'http',
      enabled: row.enabled === 1,
    }));
  }

  add(name: string, url: string): ServiceRow {
    const cleanName = name?.trim();
    const cleanUrl = url?.trim();
    if (!cleanName) throw new BadRequestException('a name is required');
    let parsed: URL;
    try {
      parsed = new URL(cleanUrl);
    } catch {
      throw new BadRequestException('the URL must be absolute (http:// or https://)');
    }
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
      throw new BadRequestException('the URL must use http(s):// or ws(s)://');
    }
    const kind = serviceKind(parsed.protocol);
    try {
      const info = this.db
        .prepare('INSERT INTO services (name, url, kind) VALUES (?, ?, ?)')
        .run(cleanName, cleanUrl, kind);
      const service = this.db
        .prepare('SELECT id, name, url, kind, enabled FROM services WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as {
        id: number;
        name: string;
        url: string;
        kind: string;
        enabled: number;
      };
      return {
        ...service,
        kind: service.kind === 'ws' ? 'ws' : 'http',
        enabled: service.enabled === 1,
      };
    } catch {
      throw new BadRequestException('a service with that URL already exists');
    }
  }

  remove(id: number): void {
    const info = this.db.prepare('DELETE FROM services WHERE id = ?').run(id);
    if (info.changes === 0) throw new NotFoundException('service not found');
    this.db.prepare('DELETE FROM service_checks WHERE service_id = ?').run(id);
  }

  /** One check per service; failures are recorded, not thrown. */
  async runAll(): Promise<void> {
    const services = this.list().filter((service) => service.enabled);
    await Promise.all(services.map((service) => this.check(service)));
    this.db
      .prepare(
        `DELETE FROM service_checks WHERE checked_at < datetime('now', '-${RETENTION_DAYS} days')`,
      )
      .run();
  }

  private async check(service: ServiceRow): Promise<void> {
    const started = Date.now();
    let ok = false;
    let version: string | null = null;
    let detail: string | null = null;
    try {
      if (service.kind === 'ws') {
        const probe = await this.handshake(service.url);
        ok = probe.ok;
        detail = probe.detail;
      } else {
        const response = await fetch(service.url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
          headers: { 'User-Agent': 'tilawa-status/1' },
        });
        ok = response.ok;
        const type = response.headers.get('content-type') ?? '';
        if (type.includes('application/json')) {
          const body = (await response.json().catch(() => null)) as { version?: unknown } | null;
          if (body && typeof body.version === 'string') version = body.version;
        }
        detail = ok ? `${response.status}` : `${response.status} ${response.statusText}`.trim();
      }
    } catch (err) {
      detail = (err as Error).message;
    }
    const latency = Date.now() - started;
    this.db
      .prepare(
        'INSERT INTO service_checks (service_id, ok, latency_ms, version, detail) VALUES (?, ?, ?, ?, ?)',
      )
      .run(service.id, ok ? 1 : 0, ok ? latency : null, version, detail?.slice(0, 200) ?? null);
    if (!ok) this.logger.debug(`${service.name} down: ${detail}`);
  }

  /**
   * A WebSocket handshake and nothing more: open the socket, time it, close it.
   *
   * The relay has no HTTP surface, so this is the only check that proves the whole
   * path a client takes — DNS, Cloudflare, the tunnel and the gun container. A GET
   * would report a 200 from the tunnel page or hang; neither says "accounts work".
   */
  private handshake(url: string): Promise<{ ok: boolean; detail: string | null }> {
    return new Promise((resolve) => {
      let settled = false;
      let socket: WebSocket | null = null;
      const finish = (ok: boolean, detail: string | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          socket?.close();
        } catch {
          // Already closed by the peer, which is the normal case.
        }
        resolve({ ok, detail });
      };
      const timer = setTimeout(() => finish(false, 'handshake timed out'), CHECK_TIMEOUT_MS);
      try {
        socket = new WebSocket(url);
      } catch (err) {
        finish(false, (err as Error).message);
        return;
      }
      socket.addEventListener('open', () => finish(true, 'handshake ok'));
      socket.addEventListener('error', () => finish(false, 'handshake failed'));
    });
  }

  /** Current state plus 24 hourly buckets, oldest first. */
  overview(): ServiceOverview[] {
    return this.list().map((service) => {
      const latest = this.db
        .prepare(
          'SELECT ok, latency_ms, version, detail, checked_at FROM service_checks WHERE service_id = ? ORDER BY id DESC LIMIT 1',
        )
        .get(service.id) as
        | {
            ok: number;
            latency_ms: number | null;
            version: string | null;
            detail: string | null;
            checked_at: string;
          }
        | undefined;

      const buckets = this.db
        .prepare(
          `SELECT strftime('%Y-%m-%dT%H', checked_at) AS hour, SUM(ok) AS ok, COUNT(*) AS total
             FROM service_checks
            WHERE service_id = ? AND checked_at >= datetime('now', '-24 hours')
            GROUP BY hour ORDER BY hour`,
        )
        .all(service.id) as { hour: string; ok: number; total: number }[];

      const byHour = new Map(buckets.map((bucket) => [bucket.hour, bucket]));
      const timeline: (number | null)[] = [];
      let okTotal = 0;
      let total = 0;
      for (let index = 23; index >= 0; index -= 1) {
        const date = new Date(Date.now() - index * 3600_000);
        const key = `${date.toISOString().slice(0, 13)}`;
        const bucket = byHour.get(key);
        if (!bucket) {
          timeline.push(null);
          continue;
        }
        const ratio = bucket.total === 0 ? 0 : bucket.ok / bucket.total;
        okTotal += bucket.ok;
        total += bucket.total;
        timeline.push(ratio);
      }

      return {
        id: service.id,
        name: service.name,
        url: service.url,
        kind: service.kind,
        ok: latest ? latest.ok === 1 : null,
        latencyMs: latest?.latency_ms ?? null,
        version: latest?.version ?? null,
        detail: latest?.detail ?? null,
        lastCheckedAt: latest?.checked_at ?? null,
        uptime24h: total === 0 ? null : okTotal / total,
        timeline,
      };
    });
  }

  /** TURN timeline from the probe history the TURN module already keeps. */
  turnTimeline(turnId: number): { uptime24h: number | null; timeline: (number | null)[] } {
    const buckets = this.db
      .prepare(
        `SELECT strftime('%Y-%m-%dT%H', checked_at) AS hour, SUM(ok) AS ok, COUNT(*) AS total
           FROM turn_checks
          WHERE turn_id = ? AND checked_at >= datetime('now', '-24 hours')
          GROUP BY hour ORDER BY hour`,
      )
      .all(turnId) as { hour: string; ok: number; total: number }[];
    const byHour = new Map(buckets.map((bucket) => [bucket.hour, bucket]));
    const timeline: (number | null)[] = [];
    let okTotal = 0;
    let total = 0;
    for (let index = 23; index >= 0; index -= 1) {
      const key = new Date(Date.now() - index * 3600_000).toISOString().slice(0, 13);
      const bucket = byHour.get(key);
      if (!bucket) {
        timeline.push(null);
        continue;
      }
      okTotal += bucket.ok;
      total += bucket.total;
      timeline.push(bucket.total === 0 ? 0 : bucket.ok / bucket.total);
    }
    return { uptime24h: total === 0 ? null : okTotal / total, timeline };
  }
}
