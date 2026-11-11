import { describe, expect, it } from '@jest/globals';
import { openDatabase, type Db } from '@tilawa-admin/core';
import { BadRequestException } from '@nestjs/common';
import { TelemetryController } from '../src/telemetry/telemetry.controller';
import { TelemetryService } from '../src/telemetry/telemetry.service';

/**
 * The summary's filters.
 *
 * One rule decides the shape of this suite: a panel that *is* a dimension ignores
 * its own filter. "Where the audio came from" keeps both sides while you are
 * looking at the source split, and "Errors by version" keeps every version while
 * you are looking at one — otherwise the comparison you opened the tab for
 * collapses to a single bar.
 */

type Row = {
  event?: 'play' | 'complete' | 'error' | 'fallback';
  reciter?: string;
  surah?: number;
  source?: 'torrent' | 'webseed';
  version?: string;
  errorCode?: string | null;
  daysAgo?: number;
};

function build(rows: Row[] = []): { db: Db; telemetry: TelemetryService } {
  const db = openDatabase(':memory:');
  const insert = db.prepare(
    `INSERT INTO telemetry_events (event, reciter, surah, source, error_code, ms_to_play, version, locale, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of rows) {
    const at = new Date(Date.now() - (row.daysAgo ?? 0) * 86_400_000).toISOString();
    insert.run(
      row.event ?? 'play',
      row.reciter ?? 'maher-al-muaiqly',
      row.surah ?? 18,
      row.source ?? 'torrent',
      row.errorCode ?? null,
      null,
      row.version ?? '1.12.2',
      'ar',
      at,
    );
  }
  const telemetry = new TelemetryService(db);
  // The read path splits at two days: everything older comes from the rollup, so a
  // fixture that only wrote raw rows would be invisible to any window past that. The
  // rotation is idempotent and is what the deployment runs hourly anyway.
  telemetry.rotate();
  return { db, telemetry };
}

const params = (...values: string[]) => values;

describe('TelemetryService.summary', () => {
  it('lists the most-played surahs and reciters for the window', () => {
    const { telemetry } = build([
      { surah: 18, reciter: 'maher-al-muaiqly' },
      { surah: 18, reciter: 'maher-al-muaiqly' },
      { surah: 2, reciter: 'abdul-basit' },
      // Outside the raw window: the pruner would have taken it, the query must not.
      { surah: 36, reciter: 'abdul-basit', daysAgo: 100 },
    ]);

    const summary = telemetry.summary(7);

    expect(summary.surahs[0]).toEqual({ surah: 18, plays: 2, completes: 0, bytes: 0 });
    expect(summary.reciters[0]).toEqual({ reciter: 'maher-al-muaiqly', plays: 2 });
    expect(summary.surahs.map((row) => row.surah)).not.toContain(36);
  });

  it('narrows the surahs and the recent errors by source, but not the source split', () => {
    const { telemetry } = build([
      { surah: 18, source: 'torrent' },
      { surah: 2, source: 'webseed' },
      { surah: 2, source: 'webseed' },
    ]);

    const summary = telemetry.summary(7, { source: 'webseed' });

    expect(summary.surahs).toEqual([{ surah: 2, plays: 2, completes: 0, bytes: 0 }]);
    // The panel you are filtering by keeps both sides: that is the comparison.
    expect(summary.sources).toEqual({ torrent: 1, webseed: 2 });
  });

  it('narrows the surahs by version, but not the errors-by-version panel', () => {
    const { telemetry } = build([
      { surah: 18, version: '1.12.2' },
      { surah: 2, version: '1.10.7' },
      { surah: 2, version: '1.10.7', event: 'error', errorCode: 'MEDIA_ERR_NETWORK' },
    ]);

    const summary = telemetry.summary(7, { version: '1.10.7' });

    // One play and one error on 1.10.7; the play count must not include the error.
    expect(summary.surahs).toEqual([{ surah: 2, plays: 1, completes: 0, bytes: 0 }]);
    expect(summary.errorsByVersion.map((row) => row.version).sort()).toEqual(['1.10.7', '1.12.2']);
    // 1.10.7 has one play and one error: one failed attempt out of two.
    const row = summary.errorsByVersion.find((entry) => entry.version === '1.10.7');
    expect(row).toMatchObject({ errors: 1, plays: 1 });
    expect(row?.rate).toBeCloseTo(0.5);
  });

  it('narrows the surahs by reciter, but keeps every reciter in the roster', () => {
    const { telemetry } = build([
      { surah: 18, reciter: 'maher-al-muaiqly' },
      { surah: 2, reciter: 'abdul-basit' },
      { surah: 2, reciter: 'abdul-basit' },
    ]);

    const summary = telemetry.summary(7, { reciter: 'abdul-basit' });

    expect(summary.surahs).toEqual([{ surah: 2, plays: 2, completes: 0, bytes: 0 }]);
    expect(summary.reciters).toEqual([
      { reciter: 'abdul-basit', plays: 2 },
      { reciter: 'maher-al-muaiqly', plays: 1 },
    ]);
  });

  it('intersects the filters it is given', () => {
    const { telemetry } = build([
      { surah: 18, reciter: 'maher-al-muaiqly', source: 'torrent' },
      { surah: 18, reciter: 'maher-al-muaiqly', source: 'webseed' },
      { surah: 2, reciter: 'maher-al-muaiqly', source: 'webseed' },
      { surah: 2, reciter: 'abdul-basit', source: 'webseed' },
    ]);

    const summary = telemetry.summary(7, {
      reciter: 'maher-al-muaiqly',
      source: 'webseed',
    });

    expect(summary.surahs).toEqual([
      { surah: 2, plays: 1, completes: 0, bytes: 0 },
      { surah: 18, plays: 1, completes: 0, bytes: 0 },
    ]);
  });

  it('leaves the reciter roster free of the reciter filter it is filtering by', () => {
    const { telemetry } = build([{ reciter: 'abdul-basit' }]);
    const summary = telemetry.summary(7, { reciter: 'abdul-basit' });
    expect(summary.reciters).toHaveLength(1);
  });
});

describe('TelemetryController.summary validation', () => {
  it('refuses a source that is not one of the two the client sends', () => {
    const { telemetry } = build();
    const controller = new TelemetryController(telemetry);
    expect(() => controller.summary(...params('7', 'stream'))).toThrow(BadRequestException);
  });

  it('refuses a version longer than the ingest would accept', () => {
    const { telemetry } = build();
    const controller = new TelemetryController(telemetry);
    expect(() => controller.summary('7', undefined, 'x'.repeat(33))).toThrow(BadRequestException);
  });

  it('refuses a reciter longer than the ingest would accept', () => {
    const { telemetry } = build();
    const controller = new TelemetryController(telemetry);
    expect(() => controller.summary('7', undefined, undefined, 'x'.repeat(81))).toThrow(
      BadRequestException,
    );
  });

  it('passes the filters through to the service', () => {
    const { telemetry } = build([{ surah: 2, source: 'webseed' }, { surah: 18 }]);
    const controller = new TelemetryController(telemetry);
    const summary = controller.summary('7', 'webseed');
    expect(summary.surahs).toEqual([{ surah: 2, plays: 1, completes: 0, bytes: 0 }]);
  });
});

/**
 * The listening funnel: a device that opened the app is not a device that
 * played something. Both are daily counters with no identifier, so the two
 * cannot be joined — only compared.
 */
describe('the listening funnel', () => {
  const today = new Date().toISOString().slice(0, 10);
  const device = { event: 'device' as const, version: '1.12.2', locale: 'ar' as const };
  const firstPlay = { event: 'first_play' as const, version: '1.12.2', locale: 'ar' as const };

  it('counts a device that played apart from a device that only opened the app', () => {
    const { db, telemetry } = build();
    telemetry.ingest([device, device, firstPlay], '127.0.0.1');

    expect(telemetry.summary(7).devices).toEqual([{ day: today, devices: 2 }]);
    expect(telemetry.summary(7).listeners).toEqual([{ day: today, listeners: 1 }]);
    // Neither event is a play: the counters must not reach the play table.
    expect(db.prepare('SELECT count(*) AS n FROM telemetry_events').get()).toEqual({ n: 0 });
  });

  it('refuses a first_play event that carries a reciter', () => {
    const { telemetry } = build();
    expect(() =>
      telemetry.ingest([{ ...firstPlay, reciter: 'maher-al-muaiqly' }], '127.0.0.2'),
    ).toThrow(/first_play event carries no reciter/);
  });

  it('keeps a day that had no listeners out of the listener series', () => {
    const { db, telemetry } = build();
    telemetry.ingest([device], '127.0.0.3');
    db.prepare('INSERT INTO listener_days (day, listeners) VALUES (?, ?)').run('2020-01-01', 4);

    // The window is what makes the series honest: a day before it is not "zero".
    expect(telemetry.summary(7).listeners).toEqual([]);
  });
});

/**
 * The window is a count of days, not of 24-hour slices.
 *
 * `days=7` has to mean seven daily buckets, today included: anchoring it at
 * `now − 7d` put eight days under a header that claimed seven, which is how
 * "Days reported" could exceed the period it was reporting on.
 */
describe('the window follows the selected period', () => {
  /** The day `ago` days back, as the daily counters store it. */
  const day = (ago: number): string =>
    new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);

  it('keeps at most `days` daily buckets, today included', () => {
    const { db, telemetry } = build();
    db.prepare('INSERT INTO device_days (day, devices) VALUES (?, ?)').run(day(6), 1);
    // One day before a seven-day window opens: under `now − 7d` it was inside.
    db.prepare('INSERT INTO device_days (day, devices) VALUES (?, ?)').run(day(7), 1);
    db.prepare('INSERT INTO listener_days (day, listeners) VALUES (?, ?)').run(day(6), 1);
    db.prepare('INSERT INTO listener_days (day, listeners) VALUES (?, ?)').run(day(7), 1);

    expect(telemetry.summary(7).devices).toEqual([{ day: day(6), devices: 1 }]);
    expect(telemetry.summary(7).listeners).toEqual([{ day: day(6), listeners: 1 }]);
    // A wider window reaches further back, so the exclusion is the window and
    // not a fixed limit on the query.
    expect(telemetry.summary(30).devices).toEqual([
      { day: day(7), devices: 1 },
      { day: day(6), devices: 1 },
    ]);
  });

  it('starts the raw-event window at the same UTC midnight', () => {
    const { db, telemetry } = build([{ event: 'error', surah: 36 }]);
    const firstDay = day(6);
    const before = new Date(Date.parse(`${firstDay}T00:00:00.000Z`) - 60_000).toISOString();

    // 23:59 the evening before the window: inside `now − 7d`, outside seven days.
    db.prepare('UPDATE telemetry_events SET at = ?').run(before);
    expect(telemetry.summary(7).recentErrors).toHaveLength(0);

    // Midnight of the first day is the window's first instant, and is included.
    db.prepare('UPDATE telemetry_events SET at = ?').run(`${firstDay}T00:00:00.000Z`);
    expect(telemetry.summary(7).recentErrors).toHaveLength(1);
  });
});

/**
 * Volume and devices are the two figures that do not come from the listener's
 * payoff report: one is read from the server's own log, the other is a daily
 * "a device was here" row with no identifier in it.
 */
describe('TelemetryService volume and devices', () => {
  const today = new Date().toISOString().slice(0, 10);
  const FOLDER = 'Maher_Al-Muaiqly_(MP3_Quran)';
  const HASH = '465aa4a5cc2dafe86cd616f1dc9e94b1dce36496';

  function catalogue(db: Db): void {
    db.prepare('INSERT INTO reciters (name, infohash, magnet, slug) VALUES (?, ?, ?, ?)').run(
      'Maher Al Muaiqly',
      HASH,
      'magnet:?xt=urn:btih:465aa4a5cc2dafe86cd616f1dc9e94b1dce36496',
      'maher-al-muaiqly',
    );
    db.prepare('INSERT INTO node_torrents (seeder_id, infohash, name) VALUES (?, ?, ?)').run(
      1,
      HASH,
      FOLDER,
    );
  }

  it('joins the served bytes to the surah they were served for', () => {
    const { db, telemetry } = build([{ surah: 18, reciter: 'maher-al-muaiqly' }]);
    catalogue(db);
    db.prepare('INSERT INTO media_daily (day, folder, surah, bytes) VALUES (?, ?, ?, ?)').run(
      today,
      FOLDER,
      18,
      1_048_576,
    );

    const summary = telemetry.summary(7);

    expect(summary.surahs).toEqual([{ surah: 18, plays: 1, completes: 0, bytes: 1_048_576 }]);
    expect(summary.volume.serverBytes).toBe(1_048_576);
    expect(summary.volume.byReciter).toEqual([
      { reciter: 'maher-al-muaiqly', serverBytes: 1_048_576, torrentBytes: 0 },
    ]);
  });

  it('keeps a reciter filter on the volume, so one reciter can be priced alone', () => {
    const { db, telemetry } = build([{ surah: 18, reciter: 'maher-al-muaiqly' }]);
    catalogue(db);
    db.prepare('INSERT INTO media_daily (day, folder, surah, bytes) VALUES (?, ?, ?, ?)').run(
      today,
      FOLDER,
      18,
      500,
    );
    db.prepare('INSERT INTO torrent_daily (day, reciter, bytes) VALUES (?, ?, ?)').run(
      today,
      'maher-al-muaiqly',
      300,
    );

    const filtered = telemetry.summary(7, { reciter: 'maher-al-muaiqly' });
    expect(filtered.volume).toEqual({
      serverBytes: 500,
      torrentBytes: 300,
      byReciter: [{ reciter: 'maher-al-muaiqly', serverBytes: 500, torrentBytes: 300 }],
    });
    // The surah column obeys the same reciter filter as the panel above it.
    expect(filtered.surahs).toEqual([{ surah: 18, plays: 1, completes: 0, bytes: 500 }]);
    expect(telemetry.summary(7, { reciter: 'someone-else' }).volume).toEqual({
      serverBytes: 0,
      torrentBytes: 0,
      byReciter: [],
    });
  });

  it('counts one device row per report and refuses a device event with a reciter on it', () => {
    const { db, telemetry } = build();
    const device = { event: 'device' as const, version: '1.12.2', locale: 'ar' as const };

    expect(telemetry.ingest([device, device], '127.0.0.1')).toBe(2);
    expect(telemetry.summary(7).devices).toEqual([{ day: today, devices: 2 }]);

    expect(() =>
      telemetry.ingest([{ ...device, reciter: 'maher-al-muaiqly' }], '127.0.0.2'),
    ).toThrow(/device event carries no reciter/);

    // The device row is not a play: it must not move the play counters.
    expect(
      db.prepare("SELECT count(*) AS n FROM telemetry_events WHERE event = 'device'").get(),
    ).toEqual({ n: 0 });
  });

  it('counts a device age range separately and refuses an unknown one', () => {
    const { telemetry } = build();
    const device = { event: 'device' as const, version: '1.13.16', locale: 'ar' as const };

    expect(
      telemetry.ingest(
        [{ ...device, age: 'new' }, { ...device, age: '7-13' }, { ...device, age: '7-13' }],
        '127.0.0.1',
      ),
    ).toBe(3);
    expect(telemetry.summary(7).deviceAges).toEqual(
      expect.arrayContaining([
        { day: today, age: '7-13', devices: 2 },
        { day: today, age: 'new', devices: 1 },
      ]),
    );

    // An older client sends no age: it is a device, but not an age row.
    expect(telemetry.ingest([device], '127.0.0.2')).toBe(1);
    expect(telemetry.summary(7).devices).toEqual([{ day: today, devices: 4 }]);
    expect(telemetry.summary(7).deviceAges).toHaveLength(2);

    expect(() => telemetry.ingest([{ ...device, age: 'old' }], '127.0.0.3')).toThrow(
      /unknown device age/,
    );
  });

  it('turns a node counter into a delta, and treats a restart as a new baseline', () => {
    const { db, telemetry } = build();
    catalogue(db);

    expect(telemetry.recordUploads(1, [{ infoHash: HASH, uploaded: 1_000 }])).toBe(0);
    expect(telemetry.recordUploads(1, [{ infoHash: HASH, uploaded: 1_500 }])).toBe(500);
    // Restarted node: the counter went backwards, so the new value is the baseline.
    expect(telemetry.recordUploads(1, [{ infoHash: HASH, uploaded: 10 }])).toBe(0);
    expect(telemetry.recordUploads(1, [{ infoHash: HASH, uploaded: 60 }])).toBe(50);

    expect(
      db.prepare('SELECT bytes FROM torrent_daily WHERE reciter = ?').get('maher-al-muaiqly'),
    ).toEqual({ bytes: 550 });
  });

  it('drops uploads for a torrent the catalogue does not know', () => {
    const { db, telemetry } = build();
    catalogue(db);
    telemetry.recordUploads(1, [{ infoHash: 'f'.repeat(40), uploaded: 100 }]);
    expect(telemetry.recordUploads(1, [{ infoHash: 'f'.repeat(40), uploaded: 900 }])).toBe(0);
    expect(db.prepare('SELECT coalesce(sum(bytes), 0) AS n FROM torrent_daily').get()).toEqual({
      n: 0,
    });
  });
});

/**
 * Where the sound came from, as a reliability read-out.
 *
 * The split already says how many plays each source served. It cannot say whether
 * either of them worked: a play is only recorded once sound started, so the error
 * rows are the failures, and they carry the same `source`. Peer and server are
 * then comparable for the first time — 24% against 0% in the live data, which the
 * errors-by-version table was hiding by mixing both sources into one rate.
 */
describe('the source the sound came from', () => {
  it('counts plays and errors per source, and rates them against the plays', () => {
    const { telemetry } = build([
      { source: 'torrent' },
      { source: 'torrent' },
      { source: 'torrent', event: 'error', errorCode: 'MEDIA_ERR_NETWORK' },
      { source: 'webseed' },
      { source: 'webseed' },
    ]);

    expect(telemetry.summary(7).reliability).toEqual([
      { source: 'torrent', plays: 2, errors: 1, rate: 1 / 3 },
      { source: 'webseed', plays: 2, errors: 0, rate: 0 },
    ]);
  });

  it('keeps both sources while the source filter is on, like the split above it', () => {
    const { telemetry } = build([
      { source: 'torrent' },
      { source: 'torrent', event: 'error', errorCode: 'MEDIA_ERR_NETWORK' },
      { source: 'webseed' },
      { source: 'webseed' },
      { source: 'webseed' },
    ]);

    const summary = telemetry.summary(7, { source: 'webseed' });

    // The panel is the dimension being filtered by: collapsing it to one row
    // would delete the comparison the panel exists for.
    expect(summary.reliability).toEqual([
      { source: 'torrent', plays: 1, errors: 1, rate: 0.5 },
      { source: 'webseed', plays: 3, errors: 0, rate: 0 },
    ]);
    expect(summary.sources).toEqual({ torrent: 1, webseed: 3 });
  });

  it('narrows by version, which is not this panel dimension', () => {
    const { telemetry } = build([
      { source: 'torrent', version: '1.10.7' },
      { source: 'webseed', version: '1.12.2' },
      { source: 'webseed', version: '1.12.2' },
    ]);

    const rows = telemetry.summary(7, { version: '1.12.2' }).reliability;

    expect(rows).toEqual([
      { source: 'torrent', plays: 0, errors: 0, rate: 0 },
      { source: 'webseed', plays: 2, errors: 0, rate: 0 },
    ]);
  });
});

/**
 * A client older than the release that stopped sending `fallback` still sends it.
 *
 * Rejecting the event would fail the whole batch, so every play from every other
 * un-updated client would be lost with it. Accept, and do not count.
 */
describe('events from an older client', () => {
  const play = {
    event: 'play' as const,
    reciter: 'maher-al-muaiqly',
    surah: 18,
    source: 'webseed' as const,
    version: '1.13.30',
    locale: 'ar' as const,
  };

  it('accepts a fallback event and does not store it', () => {
    const { db, telemetry } = build();
    telemetry.ingest([play, { ...play, event: 'fallback' as const }], '127.0.0.1');

    expect(db.prepare('SELECT event, count(*) AS n FROM telemetry_events GROUP BY event').all()).toEqual(
      [{ event: 'play', n: 1 }],
    );
  });
});

/**
 * The handover between the rollup and the raw rows.
 *
 * Closed days come from `telemetry_daily`; the last two from `telemetry_events`. The
 * point of the split is that a window can outlive the ninety-day raw retention, so the
 * tests delete the raw rows by hand to stand in for the day the pruner takes them.
 */
describe('the rollup carries what the pruner takes', () => {
  it('still counts a play whose raw row is gone', () => {
    const { db, telemetry } = build([{ surah: 18, daysAgo: 40 }]);
    db.prepare('DELETE FROM telemetry_events').run();

    expect(telemetry.summary(90).surahs).toEqual([
      { surah: 18, plays: 1, completes: 0, bytes: 0 },
    ]);
  });

  it('answers a window the raw rows can never cover', () => {
    const { db, telemetry } = build([{ surah: 2, daysAgo: 200 }]);
    db.prepare('DELETE FROM telemetry_events').run();

    expect(telemetry.summary(365).surahs[0]).toMatchObject({ surah: 2, plays: 1 });
    // And the short windows stay short: the rollup is filtered by the same window.
    expect(telemetry.summary(90).surahs).toEqual([]);
  });

  it('counts a day once, wherever the handover falls', () => {
    const { telemetry } = build([{ surah: 18 }, { surah: 18, daysAgo: 1 }]);

    expect(telemetry.summary(7).surahs).toEqual([
      { surah: 18, plays: 2, completes: 0, bytes: 0 },
    ]);
  });

  it('counts a completed play apart from the play itself', () => {
    const { telemetry } = build([{ surah: 18 }, { surah: 18, event: 'complete' }]);

    expect(telemetry.summary(7).surahs).toEqual([
      { surah: 18, plays: 1, completes: 1, bytes: 0 },
    ]);
  });

  it('refuses a window past the widest one it can answer', () => {
    const { telemetry } = build();
    const controller = new TelemetryController(telemetry);

    expect(() => controller.summary('366')).toThrow(BadRequestException);
    expect(controller.summary('365').surahs).toEqual([]);
  });
});

/**
 * How long the listener waited.
 *
 * A distribution over four bands, not a time series: it stays readable when a day holds
 * two plays, which is the only kind of day this project has so far.
 */
describe('time to first sound', () => {
  it('counts a play per band, and reports every band even when it is empty', () => {
    const { db, telemetry } = build();
    const insert = db.prepare(
      `INSERT INTO telemetry_events (event, reciter, surah, source, error_code, ms_to_play, version, locale, at)
       VALUES ('play', 'maher-al-muaiqly', 18, 'torrent', NULL, ?, '1.13.31', 'ar', ?)`,
    );
    const now = new Date().toISOString();
    insert.run('0-1s', now);
    insert.run('0-1s', now);
    insert.run('10s+', now);
    telemetry.rotate();

    expect(telemetry.summary(7).startBands).toEqual([
      { band: '0-1s', plays: 2 },
      { band: '1-3s', plays: 0 },
      { band: '3-10s', plays: 0 },
      { band: '10s+', plays: 1 },
    ]);
  });

  it('keeps the band for a day the pruner has taken', () => {
    const { db, telemetry } = build();
    db.prepare(
      `INSERT INTO telemetry_events (event, reciter, surah, source, error_code, ms_to_play, version, locale, at)
       VALUES ('play', 'maher-al-muaiqly', 18, 'webseed', NULL, '3-10s', '1.13.31', 'ar', ?)`,
    ).run(new Date(Date.now() - 40 * 86_400_000).toISOString());
    telemetry.rotate();
    db.prepare('DELETE FROM telemetry_events').run();

    expect(telemetry.summary(90).startBands.find((row) => row.band === '3-10s')).toEqual({
      band: '3-10s',
      plays: 1,
    });
  });
});
