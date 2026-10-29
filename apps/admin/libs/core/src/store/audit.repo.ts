import type { Db } from './db';

/**
 * The audit trail. Every tool call and every admin action, per the schema's
 * comment — "the audit trail is not optional".
 *
 * Writes are deliberately **not** transactional with the work they describe: the
 * record of an attempt must survive the attempt failing, so a failed call is
 * written with `status: 'error'` rather than rolled back with it.
 */
export interface AuditEntry {
  id: number;
  user_id: number | null;
  actor_id: number | null;
  action: string;
  target: string | null;
  before_json: string | null;
  after_json: string | null;
  tool: string | null;
  status: string;
  ms: number | null;
  ip: string | null;
  created_at: string;
}

export interface AuditStatsDay {
  date: string;
  total: number;
  ok: number;
  fail: number;
}

export interface AuditStatsTool {
  tool: string;
  count: number;
  avgMs: number | null;
  maxMs: number | null;
  failCount: number;
}

export interface AuditStats {
  range: number;
  days: AuditStatsDay[];
  tools: AuditStatsTool[];
  latency: { avgMs: number | null; maxMs: number | null };
  errorRate: number;
  total: number;
}

export interface RecordAuditInput {
  userId?: number | null;
  actorId?: number | null;
  action: string;
  target?: string | null;
  before?: unknown;
  after?: unknown;
  tool?: string | null;
  status?: 'ok' | 'error' | 'denied';
  ms?: number | null;
  ip?: string | null;
}

export class AuditRepository {
  constructor(private readonly db: Db) {}

  record(input: RecordAuditInput): number {
    const info = this.db
      .prepare(
        `INSERT INTO audit_log (user_id, actor_id, action, target, before_json, after_json, tool, status, ms, ip)
         VALUES (@user_id, @actor_id, @action, @target, @before_json, @after_json, @tool, @status, @ms, @ip)`,
      )
      .run({
        user_id: input.userId ?? null,
        actor_id: input.actorId ?? null,
        action: input.action,
        target: input.target ?? null,
        before_json: input.before === undefined ? null : JSON.stringify(input.before),
        after_json: input.after === undefined ? null : JSON.stringify(input.after),
        tool: input.tool ?? null,
        status: input.status ?? 'ok',
        ms: input.ms ?? null,
        ip: input.ip ?? null,
      });
    return Number(info.lastInsertRowid);
  }

  recentForUser(userId: number, limit = 50): AuditEntry[] {
    return this.db
      .prepare('SELECT * FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT ?')
      .all(userId, limit) as AuditEntry[];
  }

  /**
   * Aggregates for the (and only the) caller's console (the same isolation rule
   * recentForUser enforces). Range is a whitelist: 7 | 30 | 90 days.
   * Day buckets are UTC days (SQLite date() on the ISO-8601 stamp), zero-filled —
   * a gap in the chart is "no requests", never a missing day.
   */
  statsForUser(userId: number, range: 7 | 30 | 90 = 30): AuditStats {
    const since = this.db.prepare("SELECT datetime('now', ?) AS since").get(`-${range} days`) as {
      since: string;
    };
    const from = since.since.replace(' ', 'T');

    const perDay = this.db
      .prepare(
        `SELECT date(created_at) AS d,
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok,
                SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END) AS fail
         FROM audit_log
         WHERE user_id = ? AND created_at >= ?
         GROUP BY d ORDER BY d`,
      )
      .all(userId, from) as { d: string; total: number; ok: number; fail: number }[];

    // zero-fill the whole window so the chart has one bar per day
    const byDay = new Map(perDay.map((r) => [r.d, r]));
    const buckets: AuditStatsDay[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      const row = byDay.get(d) ?? { d, total: 0, ok: 0, fail: 0 };
      buckets.push({ date: d, total: row.total, ok: row.ok, fail: row.fail });
    }

    const tools = this.db
      .prepare(
        `SELECT tool,
                COUNT(*) AS count,
                AVG(ms) AS avgMs,
                MAX(ms) AS maxMs,
                SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END) AS failCount
         FROM audit_log
         WHERE user_id = ? AND tool IS NOT NULL AND created_at >= ?
         GROUP BY tool ORDER BY count DESC`,
      )
      .all(userId, from) as AuditStatsTool[];

    const latency = this.db
      .prepare(
        'SELECT AVG(ms) AS avgMs, MAX(ms) AS maxMs FROM audit_log WHERE user_id = ? AND ms IS NOT NULL AND created_at >= ?',
      )
      .get(userId, from) as { avgMs: number | null; maxMs: number | null };

    const totals = this.db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END) AS fails
         FROM audit_log
         WHERE user_id = ? AND created_at >= ?`,
      )
      .get(userId, from) as { total: number; fails: number | null };

    return {
      range,
      days: buckets,
      tools,
      latency: { avgMs: latency.avgMs ?? null, maxMs: latency.maxMs ?? null },
      errorRate: totals.total === 0 ? 0 : (totals.fails ?? 0) / totals.total,
      total: totals.total,
    };
  }

  countForUser(userId: number): number {
    return (
      this.db.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE user_id = ?').get(userId) as {
        n: number;
      }
    ).n;
  }
}
