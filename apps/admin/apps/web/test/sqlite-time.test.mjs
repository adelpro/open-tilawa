import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sqliteTime } from '../src/lib/format.ts';

/**
 * The check table's timestamps come from SQLite's `datetime('now')`, which writes
 * "2026-11-12 21:00:00" with no zone. The JS parser reads that as local time, so a
 * UTC stamp would render late by the operator's offset. These cases pin the UTC
 * reading, and the fact that a stamp which *does* carry a zone is left alone.
 */
describe('sqliteTime', () => {
  it('reads a zone-less stamp as UTC', () => {
    assert.equal(sqliteTime('2026-11-12 21:00:00')?.toISOString(), '2026-11-12T21:00:00.000Z');
  });

  it('leaves an already-zoned stamp alone', () => {
    assert.equal(
      sqliteTime('2026-11-12T21:00:00.000Z')?.toISOString(),
      '2026-11-12T21:00:00.000Z',
    );
  });

  it('answers null for a missing or unreadable stamp', () => {
    assert.equal(sqliteTime(null), null);
    assert.equal(sqliteTime('not a date'), null);
  });
});
