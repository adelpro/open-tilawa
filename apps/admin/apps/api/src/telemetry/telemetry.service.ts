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
 *
 * `fallback` is legacy. Up to web 1.13.30 the client sent it beside every play the web seed
 * served, saying what `source` already said. Ingest still accepts it — one rejected event
 * fails the whole batch, so removing it would silence every older client — and never stores it.
 */
export const EVENTS = ['play', 'complete', 'error', 'fallback', 'device', 'first_play'] as const;
export const SOURCES = ['torrent', 'webseed'] as const;
export const MS_TO_PLAY = ['0-1s', '1-3s', '3-10s', '10s+'] as const;
const LOCALES = ['ar', 'en'] as const;

/**
 * The age ranges a device may report, measured locally from its own first open.
 *
 * The client never sends the date, only the range, so this stays a count of
 * devices rather than a way to follow one. An older client sends no age at all;
 * it still counts in `device_days` and is absent from `device_ages`.
 */
export const AGE_BUCKETS = ['new', '1-3', '4-6', '7-13', '14-29', '30+'] as const;

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
  /** Optional: clients before 1.13.16 do not send it. */
  age?: (typeof AGE_BUCKETS)[number];
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
  'age',
]);

/** Ninety days of raw rows; the daily counts outlive them. */
export const RETENTION_DAYS = 90;

/**
 * The widest window the console offers.
 *
 * Past `RETENTION_DAYS` the raw rows are gone and the rollup answers instead. It keeps
 * every day the pruner takes, so a year of history is a query rather than a promise,
 * and the number the screen shows past ninety days is a count, never a reconstruction.
 */
export const MAX_WINDOW_DAYS = 365;

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

  if (raw.event === 'device') {
    // The shape is the promise: a counting event with a reciter on it would be a
    // listening event wearing the wrong verb.
    for (const key of ['reciter', 'surah', 'source', 'errorCode', 'msToPlay']) {
      if (key in raw) throw new InvalidEvent(`a device event carries no ${key}`);
    }
    if (raw.age !== undefined && !AGE_BUCKETS.includes(raw.age as never)) {
      throw new InvalidEvent('unknown device age');
    }
    return {
      event: 'device',
      ...(raw.age !== undefined ? { age: raw.age as DeviceEvent['age'] } : {}),
      version: raw.version,
      locale: raw.locale as DeviceEvent['locale'],
    };
  }

  if (raw.event === 'first_play') {
    for (const key of ['reciter', 'surah', 'source', 'errorCode', 'msToPlay', 'age']) {
      if (key in raw) throw new InvalidEvent(`a first_play event carries no ${key}`);
    }
    return {
      event: 'first_play',
      version: raw.version,
      locale: raw.locale as FirstPlayEvent['locale'],
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
    const ages = new Map<(typeof AGE_BUCKETS)[number], number>();
    for (const event of events) {
      if (event.event === 'device') {
        devices += 1;
        if (event.age) ages.set(event.age, (ages.get(event.age) ?? 0) + 1);
        continue;
      }
      if (event.event === 'first_play') {
        listeners += 1;
        continue;
      }
      // A client older than web 1.13.31 still sends this beside a web-seeded play.
      // Accepted above so its batch still lands, and dropped here so the same play
      // is not counted twice.
      if (event.event === 'fallback') continue;
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
    if (ages.size > 0) {
      const upsertAge = this.db.prepare(
        `INSERT INTO device_ages (day, age, devices) VALUES (?, ?, ?)
         ON CONFLICT(day, age) DO UPDATE SET devices = devices + excluded.devices`,
      );
      for (const [age, count] of ages) upsertAge.run(day, age, count);
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
        `INSERT INTO telemetry_daily (day, version, reciter, surah, event, source, count)
         SELECT substr(at, 1, 10), version, reciter, surah, event, source, count(*)
           FROM telemetry_events
          WHERE substr(at, 1, 10) <= ?
          GROUP BY substr(at, 1, 10), version, reciter, surah, event, source
         ON CONFLICT (day, version, reciter, surah, event, source) DO UPDATE SET count = excluded.count`,
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
    surahs: { surah: number; plays: number; completes: number; bytes: number }[];
    reciters: { reciter: string; plays: number }[];
    sources: { torrent: number; webseed: number };
    reliability: { source: string; plays: number; errors: number; rate: number }[];
    errorsByVersion: { version: string; errors: number; plays: number; rate: number }[];
    recentErrors: unknown[];
    volume: {
      serverBytes: number;
      torrentBytes: number;
      byReciter: { reciter: string; serverBytes: number; torrentBytes: number }[];
    };
    devices: { day: string; devices: number }[];
    listeners: { day: string; listeners: number }[];
    deviceAges: { day: string; age: string; devices: number }[];
    lastPrunedAt: string | null;
  } {
    const window = Math.min(Math.max(days, 1), MAX_WINDOW_DAYS);
    /**
     * `window` calendar days, today included.
     *
     * The window opens on the day `window − 1` days back and at UTC midnight —
     * the bucket the daily counters are keyed by. Anchoring it on `now − window
     * days` kept the time of day and reached one day too far: a seven-day panel
     * counted eight days, which is how "Days reported" could outgrow the period
     * printed above it. Raw events start at the same midnight so the two halves
     * of the screen describe one window.
     */
    const sinceDay = new Date(Date.now() - (window - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const since = `${sinceDay}T00:00:00.000Z`;

    /**
     * Where the rollup ends and the raw rows begin.
     *
     * `telemetry_daily` is rebuilt hourly, so it is at most one rotation behind and
     * must not be trusted for the day in progress. The last two days are read from
     * the raw rows and every earlier day from the rollup: two, not one, because a
     * rotation that runs after midnight may not have touched the day that just ended.
     * Above this line the split is invisible — both halves carry the same columns.
     */
    const rawSinceDay = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const rawSince = `${rawSinceDay}T00:00:00.000Z`;

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

    /**
     * One dimension, counted the same way on both sides of the split.
     *
     * Closed days come from the rollup, the last two from the raw rows, and the two
     * are unioned before the GROUP BY so a panel cannot tell them apart. This is also
     * what lets the screen offer a year: the rollup keeps every day the pruner takes.
     */
    const counted = (
      dimension: string,
      event: string,
      ignore?: keyof SummaryFilters,
    ): { sql: string; params: unknown[] } => {
      const rollupParts = ['day >= ?', 'day < ?', 'event = ?'];
      const rollupParams: unknown[] = [sinceDay, rawSinceDay, event];
      const rawParts = ['at >= ?', 'event = ?'];
      const rawParams: unknown[] = [rawSince, event];
      const both = (column: string, value: string | undefined): void => {
        if (value === undefined) return;
        rollupParts.push(`${column} = ?`);
        rollupParams.push(value);
        rawParts.push(`${column} = ?`);
        rawParams.push(value);
      };
      if (ignore !== 'source') both('source', filters.source);
      if (ignore !== 'version') both('version', filters.version);
      if (ignore !== 'reciter') both('reciter', filters.reciter);
      return {
        sql: `SELECT ${dimension} AS dim, sum(n) AS n FROM (
                SELECT ${dimension}, count AS n FROM telemetry_daily
                 WHERE ${rollupParts.join(' AND ')}
                UNION ALL
                SELECT ${dimension}, 1 AS n FROM telemetry_events
                 WHERE ${rawParts.join(' AND ')}
              ) GROUP BY ${dimension}`,
        params: [...rollupParams, ...rawParams],
      };
    };

    const countedRows = (
      dimension: string,
      event: string,
      ignore?: keyof SummaryFilters,
    ): { dim: string | number; n: number }[] => {
      const { sql, params } = counted(dimension, event, ignore);
      return this.db.prepare(sql).all(...params) as { dim: string | number; n: number }[];
    };

    const mediaScene = mediaWhere('m');
    const byteRows = this.db
      .prepare(
        `SELECT m.surah AS dim, sum(m.bytes) AS n FROM media_daily m
          WHERE ${mediaScene.where}
          GROUP BY m.surah`,
      )
      .all(...mediaScene.params) as { dim: number; n: number }[];
    const bytesBySurah = new Map(byteRows.map((row) => [row.dim, row.n]));
    const completesBySurah = new Map(
      countedRows('surah', 'complete').map((row) => [Number(row.dim), row.n]),
    );
    const surahs = countedRows('surah', 'play')
      .map((row) => ({
        surah: Number(row.dim),
        plays: row.n,
        completes: completesBySurah.get(Number(row.dim)) ?? 0,
        bytes: bytesBySurah.get(Number(row.dim)) ?? 0,
      }))
      .sort((a, b) => b.plays - a.plays || a.surah - b.surah)
      .slice(0, 20);

    const reciters = countedRows('reciter', 'play', 'reciter')
      .map((row) => ({ reciter: String(row.dim), plays: row.n }))
      .sort((a, b) => b.plays - a.plays || a.reciter.localeCompare(b.reciter))
      .slice(0, 20);

    /**
     * The source split, and the one comparison it could never make before: which
     * source actually worked.
     *
     * Both numbers come from the same split. A play is only written once sound
     * started, so the errors are the failures and they carry the same `source`; the
     * rate is the same one the errors panel prints, `errors ÷ (errors + plays)`, so
     * the two panels cannot disagree. The panel is the source dimension, so it keeps
     * both sides while you filter by source.
     */
    const playsBySource = new Map(
      countedRows('source', 'play', 'source').map((row) => [String(row.dim), row.n]),
    );
    const errorsBySource = new Map(
      countedRows('source', 'error', 'source').map((row) => [String(row.dim), row.n]),
    );
    const reliability = SOURCES.map((source) => {
      const plays = playsBySource.get(source) ?? 0;
      const errors = errorsBySource.get(source) ?? 0;
      const attempts = plays + errors;
      return { source, plays, errors, rate: attempts === 0 ? 0 : errors / attempts };
    });
    const sources = {
      torrent: reliability.find((row) => row.source === 'torrent')?.plays ?? 0,
      webseed: reliability.find((row) => row.source === 'webseed')?.plays ?? 0,
    };

    const versionPlays = new Map(
      countedRows('version', 'play', 'version').map((row) => [String(row.dim), row.n]),
    );
    const versionErrors = new Map(
      countedRows('version', 'error', 'version').map((row) => [String(row.dim), row.n]),
    );
    const errorsByVersion = [...new Set([...versionPlays.keys(), ...versionErrors.keys()])]
      .map((version) => {
        // One number, named: an error is counted against the plays it happened in,
        // plus itself when playback never started. Counting completions here made a
        // release that finished more of what it started look healthier than one that
        // did not — the denominator has to be the plays.
        const plays = versionPlays.get(version) ?? 0;
        const errors = versionErrors.get(version) ?? 0;
        const attempts = errors + plays;
        return { version, errors, plays, rate: attempts === 0 ? 0 : errors / attempts };
      })
      .sort((a, b) => (a.version < b.version ? 1 : a.version > b.version ? -1 : 0));

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

    // The age mix per day, from the clients new enough to send a range. It can sum
    // to fewer devices than `device_days`: a device that reported before the age
    // shipped has no bucket, and the screen says so rather than assuming "new".
    const deviceAges = this.db
      .prepare('SELECT day, age, devices FROM device_ages WHERE day >= ? ORDER BY day, age')
      .all(sinceDay) as { day: string; age: string; devices: number }[];

    // The other half of the same funnel, and it obeys the same rule: no filter,
    // because a listener report has neither a reciter nor a source.
    const listeners = this.db
      .prepare('SELECT day, listeners FROM listener_days WHERE day >= ? ORDER BY day')
      .all(sinceDay) as { day: string; listeners: number }[];

    return {
      surahs,
      reciters,
      sources,
      reliability,
      errorsByVersion,
      recentErrors,
      volume: { serverBytes: serverTotal, torrentBytes: torrentTotal, byReciter },
      devices,
      listeners,
      deviceAges,
      lastPrunedAt: this.lastPrunedAt(),
    };
  }
}
