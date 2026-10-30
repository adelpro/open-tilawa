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
  return { db, telemetry: new TelemetryService(db) };
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

    expect(summary.surahs[0]).toEqual({ surah: 18, plays: 2 });
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

    expect(summary.surahs).toEqual([{ surah: 2, plays: 2 }]);
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
    expect(summary.surahs).toEqual([{ surah: 2, plays: 1 }]);
    expect(summary.errorsByVersion.map((row) => row.version).sort()).toEqual(['1.10.7', '1.12.2']);
    // 1.10.7 has one play and one error: the rate counts every event, so 0.5.
    expect(summary.errorsByVersion.find((row) => row.version === '1.10.7')?.rate).toBeCloseTo(0.5);
  });

  it('narrows the surahs by reciter, but keeps every reciter in the roster', () => {
    const { telemetry } = build([
      { surah: 18, reciter: 'maher-al-muaiqly' },
      { surah: 2, reciter: 'abdul-basit' },
      { surah: 2, reciter: 'abdul-basit' },
    ]);

    const summary = telemetry.summary(7, { reciter: 'abdul-basit' });

    expect(summary.surahs).toEqual([{ surah: 2, plays: 2 }]);
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
      { surah: 2, plays: 1 },
      { surah: 18, plays: 1 },
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
    expect(summary.surahs).toEqual([{ surah: 2, plays: 1 }]);
  });
});
