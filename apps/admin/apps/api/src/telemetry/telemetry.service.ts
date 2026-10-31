import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Db } from '@tilawa-admin/core';

import { SQLITE_DB } from '../store/store.module';
import { MediaLogImporter } from './media-import';

/**
 * The event whitelist, and nothing outside it.
 *
 * A field added here without being added to the client, the table and the console is a
 * column nobody reads; a field accepted from a request without being listed is a place for
 * something personal to arrive. Validation is a plain `includes`, so the rule is legible.
 *
 * `device` is the one event that is not a play: one per consenting device per day, with no
 * identifier in it, which is why the server can count devices but never join two days.
 */
export const EVENTS = ['play', 'complete', 'error', 'fallback', 'device', 'first_play'] as const;
export const SOURCES = ['torrent', 'webseed'] as const;
export const MS_TO_PLAY = ['0-1s', '1-3s', '3-10s', '10s+'] as const;
const LOCALES = ['ar', 'en'] as const;

type PlayEvent = {
  event: 'play' | 'complete' | 'error' | 'fallback';
  reciter: string;
  surah: number;
  source: (typeof SOURCES)[number];
  errorCode?: string;
  msToPlay?: (typeof MS_TO_PLAY)[number];
  version: string;
  locale: (typeof LOCALES)[number];
};

/** A device saying "a consenting device opened the app today"; it carries nothing else. */
type DeviceEvent = {
  event: 'device';
  version: string;
  locale: (typeof LOCALES)[number];
};

/**
 * A device saying "this is the first thing I played today"; it carries nothing
 * else, and no reciter — a play that announced itself here would make the two
 * counters inseparable.
 */
type FirstPlayEvent = {
  event: 'first_play';
  version: string;
  locale: (typeof LOCALES)[number];
};

export type TelemetryEvent = PlayEvent | DeviceEvent | FirstPlayEvent;

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

/**
 * The three filters the summary answers to.
 *
 * Each is optional and each is validated against what ingest would have accepted —
 * a filter the ingest could never have produced is a typo, not an empty result.
 */
export type SummaryFilters = {
  source?: (typeof SOURCES)[number];
  version?: string;
  reciter?: string;
};

export function assertSummaryFilters(input: {
  source?: string;
  version?: string;
  reciter?: string;
}): SummaryFilters {
  const filters: SummaryFilters = {};
  if (input.source) {
    if (!SOURCES.includes(input.source as never)) {
      throw new InvalidEvent(`unknown source: ${input.source}`);
    }
    filters.source = input.source as SummaryFilters['source'];
  }
  if (input.version) {
    if (input.version.length > 32) throw new InvalidEvent('bad version');
    filters.version = input.version;
  }
  if (input.reciter) {
    if (input.reciter.length > 80) throw new InvalidEvent('bad reciter');
    filters.reciter = input.reciter;
  }
  return filters;
}

function assertEvent(input: unknown): TelemetryEvent {
  if (!input || typeof input !== 'object') throw new InvalidEvent('not an object');
  const raw = input as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) throw new InvalidEvent(`unexpected field: ${key}`);
  }
  if (!EVENTS.includes(raw.event as never)) throw new InvalidEvent('unknown event');
  if (typeof raw.version !== 'string' || raw.version.length > 32)
    throw new InvalidEvent('bad version');
  if (!LOCALES.includes(raw.locale as never)) throw new InvalidEvent('unknown locale');

  if (raw.event === 'device' || raw.event === 'first_play') {
    // The shape is the promise: a counting event with a reciter on it would be a
    // listening event wearing the wrong verb.
    for (const key of ['reciter', 'surah', 'source', 'errorCode', 'msToPlay']) {
      if (key in raw) throw new InvalidEvent(`a ${raw.event} event carries no ${key}`);
    }
    return {
      event: raw.event,
      version: raw.version,
      locale: raw.locale as DeviceEvent['locale'],
    };
  }

  if (!SOURCES.includes(raw.source as never)) throw new InvalidEvent('unknown source');
  if (typeof raw.reciter !== 'string' || raw.reciter.length === 0 || raw.reciter.length > 80) {
    throw new InvalidEvent('bad reciter');
  }
  const surah = Number(raw.surah);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw new InvalidEvent('bad surah');
  if (
    raw.errorCode !== undefined &&
    (typeof raw.errorCode !== 'string' || raw.errorCode.length > 40)
  ) {
    throw new InvalidEvent('bad error code');
  }
  if (raw.msToPlay !== undefined && !MS_TO_PLAY.includes(raw.msToPlay as never)) {
    throw new InvalidEvent('bad msToPlay');
  }

  return {
    event: raw.event as PlayEvent['event'],
    reciter: raw.reciter,
    surah,
    source: raw.source as PlayEvent['source'],
    errorCode: raw.errorCode as string | undefined,
    msToPlay: raw.msToPlay as PlayEvent['msToPlay'],
    version: raw.version,
    locale: raw.locale as PlayEvent['locale'],
  };
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  /** Per-address, in memory, never persisted: a rate limit is not a user record. */
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  /**
   * Each node's cumulative upload counter per torrent, as of the last sample.
   *
   * In memory on purpose: a restart forgets one interval's baseline and the next
   * sample re-establishes it, which costs five minutes of an approximate number.
   * Persisting it would mean writing a row per torrent per poll for a figure that
   * is labelled approximate anyway.
   */
  private readonly uploads = new Map<string, number>();

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
    let devices = 0;
    let listeners = 0;
    for (const event of events) {
      if (event.event === 'device') {
        devices += 1;
        continue;
      }
      if (event.event === 'first_play') {
        listeners += 1;
        continue;
      }
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

    // One row per day, incremented; the batch is already deduplicated by the
    // client, and a dishonest repeat only inflates a floor.
    const day = new Date(now).toISOString().slice(0, 10);
    if (devices > 0) {
      this.db
        .prepare(
          `INSERT INTO device_days (day, devices) VALUES (?, ?)
           ON CONFLICT(day) DO UPDATE SET devices = devices + excluded.devices`,
        )
        .run(day, devices);
    }
    if (listeners > 0) {
      this.db
        .prepare(
          `INSERT INTO listener_days (day, listeners) VALUES (?, ?)
           ON CONFLICT(day) DO UPDATE SET listeners = listeners + excluded.listeners`,
        )
        .run(day, listeners);
    }
    return events.length;
  }

  /**
   * Turn a node's cumulative upload counter into a daily delta, per reciter.
   *
   * `uploaded` is what the seeder's own client has sent since the torrent was added,
   * so the only honest figure is a difference between two samples. A counter that
   * went backwards is a restarted node: the new value becomes the baseline and the
   * interval between the restart and this sample is lost — that is what
   * "approximate" buys here, and the screen says so.
   *
   * Returns the bytes attributed this call, for the log line and the tests.
   */
  recordUploads(
    nodeId: number,
    torrents: readonly { infoHash: string; uploaded: number }[],
    now = new Date(),
  ): number {
    const byHash = new Map(
      (
        this.db
          .prepare('SELECT slug, lower(infohash) AS hash FROM reciters WHERE slug IS NOT NULL')
          .all() as { slug: string; hash: string }[]
      ).map((row) => [row.hash, row.slug]),
    );

    const perReciter = new Map<string, number>();
    let moved = 0;
    for (const torrent of torrents) {
      if (!Number.isFinite(torrent.uploaded) || typeof torrent.infoHash !== 'string') continue;
      const hash = torrent.infoHash.toLowerCase();
      const key = `${nodeId}:${hash}`;
      const previous = this.uploads.get(key);
      if (previous === undefined || torrent.uploaded < previous) {
        this.uploads.set(key, torrent.uploaded);
        continue;
      }
      const delta = torrent.uploaded - previous;
      if (delta === 0) continue;
      this.uploads.set(key, torrent.uploaded);
      const reciter = byHash.get(hash);
      if (!reciter) continue;
      perReciter.set(reciter, (perReciter.get(reciter) ?? 0) + delta);
      moved += delta;
    }

    if (perReciter.size > 0) {
      const day = now.toISOString().slice(0, 10);
      const upsert = this.db.prepare(
        `INSERT INTO torrent_daily (day, reciter, bytes) VALUES (?, ?, ?)
         ON CONFLICT(day, reciter) DO UPDATE SET bytes = bytes + excluded.bytes`,
      );
      this.db.transaction(() => {
        for (const [reciter, bytes] of perReciter) upsert.run(day, reciter, bytes);
      })();
    }
    return moved;
  }

  /** The nginx half of the volume figure; see `MediaLogImporter` for the cursor rules. */
  importMediaLog(): { files: number; rows: number; bytes: number } {
    return new MediaLogImporter(this.db).run();
  }

  /**
   * Roll the raw rows up, then delete what is older than the window.
   *
   * Order matters and the invariant is explicit: a raw row is never deleted before its day
   * is rolled up, so a failed rollup leaves the data for the next pass instead of losing it.
   *
   * `media_daily`, `torrent_daily`, `device_days` and `listener_days` are already daily counts,
   * so the rotation neither rolls them up nor prunes them: there is no row in them that names
   * anyone, and "what did Ramadan cost" is asked a year later.
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

  /**
   * The read-out, narrowed by the filters the console offers.
   *
   * One rule runs through every query: a panel that *is* a dimension ignores its own
   * filter. The source split keeps both sources while you are looking at the source
   * split, and errors-by-version keeps every version while you are looking at one —
   * otherwise the comparison the panel exists for collapses to a single number.
   *
   * Volume obeys a narrower rule, written down because it is invisible otherwise: the
   * server figure is read from nginx, which never learned what version or source a
   * request came from, so it honours the window and the reciter and ignores the rest.
   * The torrent figure is per reciter by construction. The two are never added.
   */
  summary(
    days: number,
    filters: SummaryFilters = {},
  ): {
    surahs: { surah: number; plays: number; bytes: number }[];
    reciters: { reciter: string; plays: number }[];
    sources: { torrent: number; webseed: number };
    errorsByVersion: { version: string; errors: number; plays: number; rate: number }[];
    recentErrors: unknown[];
    volume: {
      serverBytes: number;
      torrentBytes: number;
      byReciter: { reciter: string; serverBytes: number; torrentBytes: number }[];
    };
    devices: { day: string; devices: number }[];
    listeners: { day: string; listeners: number }[];
    lastPrunedAt: string | null;
  } {
    const window = Math.min(Math.max(days, 1), RETENTION_DAYS);
    const since = new Date(Date.now() - window * 86_400_000).toISOString();
    const sinceDay = since.slice(0, 10);

    /** The window, plus every filter except the one this panel is the dimension of. */
    const scope = (ignore?: keyof SummaryFilters): { where: string; params: unknown[] } => {
      const parts = ['at >= ?'];
      const params: unknown[] = [since];
      if (ignore !== 'source' && filters.source) {
        parts.push('source = ?');
        params.push(filters.source);
      }
      if (ignore !== 'version' && filters.version) {
        parts.push('version = ?');
        params.push(filters.version);
      }
      if (ignore !== 'reciter' && filters.reciter) {
        parts.push('reciter = ?');
        params.push(filters.reciter);
      }
      return { where: parts.join(' AND '), params };
    };

    /**
     * The folder → reciter bridge. A log line names a folder; the console names a slug.
     * `min()` collapses the duplicates a reciter held by several nodes would otherwise
     * produce, and `GROUP BY` keeps one row per folder.
     */
    const FOLDER_MAP = `(
      SELECT nt.name AS folder, min(r.slug) AS slug
        FROM node_torrents nt
        JOIN reciters r ON lower(r.infohash) = lower(nt.infohash)
       WHERE r.slug IS NOT NULL
       GROUP BY nt.name
    )`;

    const mediaWhere = (part: string): { where: string; params: unknown[] } => {
      const params: unknown[] = [sinceDay];
      const parts = [`${part}.day >= ?`];
      if (filters.reciter) {
        parts.push(
          `EXISTS (SELECT 1 FROM ${FOLDER_MAP} f WHERE f.folder = ${part}.folder AND f.slug = ?)`,
        );
        params.push(filters.reciter);
      }
      return { where: parts.join(' AND '), params };
    };

    const surahScope = scope();
    const mediaScene = mediaWhere('m');
    const surahs = this.db
      .prepare(
        `SELECT p.surah, p.plays, coalesce(b.bytes, 0) AS bytes
           FROM (
             SELECT surah, count(*) AS plays FROM telemetry_events
              WHERE ${surahScope.where} AND event = 'play'
              GROUP BY surah
           ) p
           LEFT JOIN (
             SELECT m.surah, sum(m.bytes) AS bytes FROM media_daily m
              WHERE ${mediaScene.where}
              GROUP BY m.surah
           ) b ON b.surah = p.surah
          ORDER BY p.plays DESC, p.surah LIMIT 20`,
      )
      .all(...surahScope.params, ...mediaScene.params) as {
      surah: number;
      plays: number;
      bytes: number;
    }[];

    const reciters = this.db
      .prepare(
        `SELECT reciter, count(*) AS plays FROM telemetry_events
          WHERE ${scope('reciter').where} AND event = 'play'
          GROUP BY reciter ORDER BY plays DESC, reciter LIMIT 20`,
      )
      .all(...scope('reciter').params) as { reciter: string; plays: number }[];

    const sourceScope = scope('source');
    const sourceRows = this.db
      .prepare(
        `SELECT source, count(*) AS n FROM telemetry_events
          WHERE ${sourceScope.where} AND event = 'play' GROUP BY source`,
      )
      .all(...sourceScope.params) as { source: string; n: number }[];
    const sources = {
      torrent: sourceRows.find((row) => row.source === 'torrent')?.n ?? 0,
      webseed: sourceRows.find((row) => row.source === 'webseed')?.n ?? 0,
    };

    const versionScope = scope('version');
    const versionRows = this.db
      .prepare(
        `SELECT version,
                sum(CASE WHEN event = 'error' THEN 1 ELSE 0 END) AS errors,
                sum(CASE WHEN event = 'play'  THEN 1 ELSE 0 END) AS plays
           FROM telemetry_events WHERE ${versionScope.where}
          GROUP BY version ORDER BY version DESC`,
      )
      .all(...versionScope.params) as { version: string; errors: number; plays: number }[];
    const errorsByVersion = versionRows.map((row) => {
      // One number, named: an error is counted against the plays it happened in,
      // plus itself when playback never started. Counting fallbacks or completions
      // here made a release that leaned on the web seed look healthier than one
      // that did not — the denominator has to be the plays.
      const attempts = row.errors + row.plays;
      return {
        version: row.version,
        errors: row.errors,
        plays: row.plays,
        rate: attempts === 0 ? 0 : row.errors / attempts,
      };
    });

    const recentErrors = this.db
      .prepare(
        `SELECT at, reciter, surah, source, error_code AS errorCode, version
           FROM telemetry_events WHERE ${scope().where} AND event = 'error'
          ORDER BY id DESC LIMIT 50`,
      )
      .all(...scope().params);

    const serverScope = mediaWhere('m');
    const serverRows = this.db
      .prepare(
        `SELECT f.slug AS reciter, sum(m.bytes) AS bytes
           FROM media_daily m JOIN ${FOLDER_MAP} f ON f.folder = m.folder
          WHERE ${serverScope.where}
          GROUP BY f.slug`,
      )
      .all(...serverScope.params) as { reciter: string; bytes: number }[];

    const serverTotal = filters.reciter
      ? serverRows.reduce((sum, row) => sum + row.bytes, 0)
      : (
          this.db
            .prepare('SELECT coalesce(sum(bytes), 0) AS bytes FROM media_daily WHERE day >= ?')
            .get(sinceDay) as { bytes: number }
        ).bytes;

    const torrentWhere = filters.reciter ? 'day >= ? AND reciter = ?' : 'day >= ?';
    const torrentParams = filters.reciter ? [sinceDay, filters.reciter] : [sinceDay];
    const torrentRows = this.db
      .prepare(
        `SELECT reciter, sum(bytes) AS bytes FROM torrent_daily
          WHERE ${torrentWhere} GROUP BY reciter`,
      )
      .all(...torrentParams) as { reciter: string; bytes: number }[];
    const torrentTotal = torrentRows.reduce((sum, row) => sum + row.bytes, 0);

    const merged = new Map<string, { serverBytes: number; torrentBytes: number }>();
    const bucket = (reciter: string) => {
      const existing = merged.get(reciter);
      if (existing) return existing;
      const created = { serverBytes: 0, torrentBytes: 0 };
      merged.set(reciter, created);
      return created;
    };
    for (const row of serverRows) bucket(row.reciter).serverBytes += row.bytes;
    for (const row of torrentRows) bucket(row.reciter).torrentBytes += row.bytes;
    const byReciter = [...merged.entries()]
      .map(([reciter, value]) => ({ reciter, ...value }))
      .sort((a, b) => b.serverBytes + b.torrentBytes - (a.serverBytes + a.torrentBytes))
      .slice(0, 20);

    // Devices ignore the reciter and source filters because the event has neither;
    // pretending otherwise would show a filtered number that was never collected.
    const devices = this.db
      .prepare('SELECT day, devices FROM device_days WHERE day >= ? ORDER BY day')
      .all(sinceDay) as { day: string; devices: number }[];

    // The other half of the same funnel, and it obeys the same rule: no filter,
    // because a listener report has neither a reciter nor a source.
    const listeners = this.db
      .prepare('SELECT day, listeners FROM listener_days WHERE day >= ? ORDER BY day')
      .all(sinceDay) as { day: string; listeners: number }[];

    return {
      surahs,
      reciters,
      sources,
      errorsByVersion,
      recentErrors,
      volume: { serverBytes: serverTotal, torrentBytes: torrentTotal, byReciter },
      devices,
      listeners,
      lastPrunedAt: this.lastPrunedAt(),
    };
  }
}
