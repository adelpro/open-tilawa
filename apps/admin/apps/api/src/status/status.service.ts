import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';

/** How long a check is kept: 7 days at a 5-minute beat is 2016 rows/service. */
const RETENTION_DAYS = 7;
const CHECK_TIMEOUT_MS = 8_000;

export interface ServiceRow {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
}

export interface ServiceOverview {
  id: number;
  name: string;
  url: string;
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
 * Everything is an HTTP check, because everything in this stack is reached over
 * HTTP — the public site, the tracker's /stats, the admin API's /health and the
 * dashboard. Nodes and TURN keep their own monitors (richer than a HEAD request);
 * the overview joins them rather than duplicating their probes.
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
    this.seedDefaults();
  }

  /** A fresh install should open the status page with something on it. */
  private seedDefaults(): void {
    const count = (this.db.prepare('SELECT COUNT(*) AS n FROM services').get() as { n: number }).n;
    if (count > 0) return;
    const port = process.env.PORT ?? '9410';
    const defaults = [
      { name: 'Public site', url: 'https://tilawa.quran.us.kg/' },
      { name: 'Tracker', url: 'https://tracker.quran.us.kg/stats' },
      { name: 'Admin API', url: `http://127.0.0.1:${port}/api/health` },
      { name: 'Admin dashboard', url: 'http://admin-web:80/' },
    ];
    const insert = this.db.prepare('INSERT INTO services (name, url) VALUES (?, ?)');
    for (const service of defaults) insert.run(service.name, service.url);
  }

  list(): ServiceRow[] {
    return (
      this.db.prepare('SELECT id, name, url, enabled FROM services ORDER BY id').all() as {
        id: number;
        name: string;
        url: string;
        enabled: number;
      }[]
    ).map((row) => ({ id: row.id, name: row.name, url: row.url, enabled: row.enabled === 1 }));
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
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('the URL must use http:// or https://');
    }
    try {
      const info = this.db
        .prepare('INSERT INTO services (name, url) VALUES (?, ?)')
        .run(cleanName, cleanUrl);
      const service = this.db
        .prepare('SELECT id, name, url, enabled FROM services WHERE id = ?')
        .get(Number(info.lastInsertRowid)) as {
        id: number;
        name: string;
        url: string;
        enabled: number;
      };
      return { ...service, enabled: service.enabled === 1 };
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
