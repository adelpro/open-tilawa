import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Db } from '@tilawa-admin/core';

import { SQLITE_DB } from '../store/store.module';

/**
 * The event whitelist, and nothing outside it.
 *
 * A field added here without being added to the client, the table and the console is a
 * column nobody reads; a field accepted from a request without being listed is a place for
 * something personal to arrive. Validation is a plain `includes`, so the rule is legible.
 */
export const EVENTS = ['play', 'complete', 'error', 'fallback'] as const;
export const SOURCES = ['torrent', 'webseed'] as const;
export const MS_TO_PLAY = ['0-1s', '1-3s', '3-10s', '10s+'] as const;
const LOCALES = ['ar', 'en'] as const;

export type TelemetryEvent = {
  event: (typeof EVENTS)[number];
  reciter: string;
  surah: number;
  source: (typeof SOURCES)[number];
  errorCode?: string;
  msToPlay?: (typeof MS_TO_PLAY)[number];
  version: string;
  locale: (typeof LOCALES)[number];
};

const ALLOWED_KEYS = new Set([
  'event',
  'reciter',
  'surah',
  'source',
  'errorCode',
  'msToPlay',
  'version',
  'locale',
]);

/** Ninety days of raw rows; the daily counts outlive them. */
export const RETENTION_DAYS = 90;

export class InvalidEvent extends Error {}

function assertEvent(input: unknown): TelemetryEvent {
  if (!input || typeof input !== 'object') throw new InvalidEvent('not an object');
  const raw = input as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) throw new InvalidEvent(`unexpected field: ${key}`);
  }
  if (!EVENTS.includes(raw.event as never)) throw new InvalidEvent('unknown event');
  if (!SOURCES.includes(raw.source as never)) throw new InvalidEvent('unknown source');
  if (typeof raw.reciter !== 'string' || raw.reciter.length === 0 || raw.reciter.length > 80) {
    throw new InvalidEvent('bad reciter');
  }
  const surah = Number(raw.surah);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw new InvalidEvent('bad surah');
  if (typeof raw.version !== 'string' || raw.version.length > 32) throw new InvalidEvent('bad version');
  if (!LOCALES.includes(raw.locale as never)) throw new InvalidEvent('unknown locale');
  if (raw.errorCode !== undefined && (typeof raw.errorCode !== 'string' || raw.errorCode.length > 40)) {
    throw new InvalidEvent('bad error code');
  }
  if (raw.msToPlay !== undefined && !MS_TO_PLAY.includes(raw.msToPlay as never)) {
    throw new InvalidEvent('bad msToPlay');
  }

  return {
    event: raw.event as TelemetryEvent['event'],
    reciter: raw.reciter,
    surah,
    source: raw.source as TelemetryEvent['source'],
    errorCode: raw.errorCode as string | undefined,
    msToPlay: raw.msToPlay as TelemetryEvent['msToPlay'],
    version: raw.version,
    locale: raw.locale as TelemetryEvent['locale'],
  };
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  /** Per-address, in memory, never persisted: a rate limit is not a user record. */
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(@Inject(SQLITE_DB) private readonly db: Db) {}

  /** True when the deployment asked ingest to stop. Rotation keeps running regardless. */
  private get stopped(): boolean {
    return process.env.USLUB_TELEMETRY_OFF === '1' || process.env.TELEMETRY_OFF === '1';
  }

  accepted(): boolean {
    return !this.stopped;
  }

  /** 60 requests a minute per address; enough for a batch every 30 s from a shared proxy. */
  allow(address: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(address);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(address, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (bucket.count >= 60) return false;
    bucket.count += 1;
    return true;
  }

  ingest(batch: unknown, address = 'unknown', now = Date.now()): number {
    if (this.stopped) return 0;
    if (!this.allow(address, now)) throw new InvalidEvent('rate limited');
    if (!Array.isArray(batch)) throw new InvalidEvent('expected a batch');
    if (batch.length > 50) throw new InvalidEvent('batch too large');

    const events = batch.map(assertEvent);
    const insert = this.db.prepare(
      `INSERT INTO telemetry_events (event, reciter, surah, source, error_code, ms_to_play, version, locale)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const event of events) {
      insert.run(
        event.event,
        event.reciter,
        event.surah,
        event.source,
        event.errorCode ?? null,
        event.msToPlay ?? null,
        event.version,
        event.locale,
      );
    }
    return events.length;
  }

  /**
   * Roll the raw rows up, then delete what is older than the window.
   *
   * Order matters and the invariant is explicit: a raw row is never deleted before its day
   * is rolled up, so a failed rollup leaves the data for the next pass instead of losing it.
   */
  rotate(now = new Date()): { rolledUp: number; pruned: number } {
    const day = now.toISOString().slice(0, 10);

    const rolledUp = this.db
      .prepare(
        `INSERT INTO telemetry_daily (day, reciter, surah, event, source, count)
         SELECT substr(at, 1, 10), reciter, surah, event, source, count(*)
           FROM telemetry_events
          WHERE substr(at, 1, 10) <= ?
          GROUP BY substr(at, 1, 10), reciter, surah, event, source
         ON CONFLICT (day, reciter, surah, event, source) DO UPDATE SET count = excluded.count`,
      )
      .run(day).changes;

    this.db
      .prepare(
        `INSERT INTO telemetry_errors_daily (day, version, error_code, count)
         SELECT substr(at, 1, 10), version, coalesce(error_code, 'unknown'), count(*)
           FROM telemetry_events
          WHERE event = 'error' AND substr(at, 1, 10) <= ?
          GROUP BY substr(at, 1, 10), version, coalesce(error_code, 'unknown')
         ON CONFLICT (day, version, error_code) DO UPDATE SET count = excluded.count`,
      )
      .run(day);

    // Only days that are already in the rollup can be pruned: the subquery is the guard,
    // not the comment above it.
    const pruned = this.db
      .prepare(
        `DELETE FROM telemetry_events
          WHERE at < datetime('now', ?)
            AND substr(at, 1, 10) IN (SELECT day FROM telemetry_daily)`,
      )
      .run(`-${RETENTION_DAYS} days`).changes;

    if (pruned > 0) {
      this.db.pragma('incremental_vacuum');
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    }

    this.db
      .prepare(
        `INSERT INTO telemetry_state (key, value) VALUES ('last_pruned_at', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      )
      .run(new Date().toISOString());

    this.logger.log(`telemetry: rolled up ${rolledUp} row(s), pruned ${pruned} raw row(s)`);
    return { rolledUp, pruned };
  }

  lastPrunedAt(): string | null {
    const row = this.db
      .prepare("SELECT value FROM telemetry_state WHERE key = 'last_pruned_at'")
      .get() as { value: string } | undefined;
    return row?.value ?? null;
  }

  summary(days: number): {
    surahs: { surah: number; plays: number }[];
    sources: { torrent: number; webseed: number };
    errorsByVersion: { version: string; rate: number }[];
    recentErrors: unknown[];
    lastPrunedAt: string | null;
  } {
    const window = Math.min(Math.max(days, 1), RETENTION_DAYS);
    const since = new Date(Date.now() - window * 86_400_000).toISOString();

    const surahs = this.db
      .prepare(
        `SELECT surah, count(*) AS plays FROM telemetry_events
          WHERE event = 'play' AND at >= ? GROUP BY surah ORDER BY plays DESC LIMIT 20`,
      )
      .all(since) as { surah: number; plays: number }[];

    const sourceRows = this.db
      .prepare(
        `SELECT source, count(*) AS n FROM telemetry_events WHERE at >= ? GROUP BY source`,
      )
      .all(since) as { source: string; n: number }[];
    const sources = {
      torrent: sourceRows.find((row) => row.source === 'torrent')?.n ?? 0,
      webseed: sourceRows.find((row) => row.source === 'webseed')?.n ?? 0,
    };

    const errorsByVersion = this.db
      .prepare(
        `SELECT version,
                ROUND(1.0 * sum(CASE WHEN event = 'error' THEN 1 ELSE 0 END) / count(*), 4) AS rate
           FROM telemetry_events WHERE at >= ? GROUP BY version ORDER BY version DESC`,
      )
      .all(since) as { version: string; rate: number }[];

    const recentErrors = this.db
      .prepare(
        `SELECT at, reciter, surah, source, error_code AS errorCode, version
           FROM telemetry_events WHERE event = 'error' ORDER BY id DESC LIMIT 50`,
      )
      .all();

    return { surahs, sources, errorsByVersion, recentErrors, lastPrunedAt: this.lastPrunedAt() };
  }
}
