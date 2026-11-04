import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { periodStats } from '../src/lib/usage-period.ts';

/**
 * The period read-out: what a window of daily counters adds up to.
 *
 * A day is one count of devices, never a device. Adding the days together would
 * report the same phone ten times if it opened on ten days, so this module
 * describes the days — how many reported, which was busiest, the average of the
 * days that did report, and the newest one — and never a range total.
 */

describe('periodStats', () => {
  it('counts only the days that reported something', () => {
    const stats = periodStats([
      { day: '2026-10-28', count: 4 },
      { day: '2026-10-29', count: 0 },
      { day: '2026-10-30', count: 7 },
    ]);

    assert.equal(stats.days, 2);
  });

  it('names the busiest day and its count', () => {
    const stats = periodStats([
      { day: '2026-10-28', count: 4 },
      { day: '2026-10-30', count: 9 },
      { day: '2026-10-31', count: 7 },
    ]);

    assert.deepEqual(stats.best, { day: '2026-10-30', count: 9 });
  });

  it('picks the earliest day when two are equally busy', () => {
    const stats = periodStats([
      { day: '2026-10-29', count: 5 },
      { day: '2026-10-28', count: 5 },
    ]);

    assert.deepEqual(stats.best, { day: '2026-10-28', count: 5 });
  });

  it('averages over the reporting days, not the calendar days', () => {
    // Three reporting days sum to 21, so 7 — not 21 over a nine-day window.
    const stats = periodStats([
      { day: '2026-10-28', count: 3 },
      { day: '2026-10-30', count: 10 },
      { day: '2026-11-01', count: 8 },
    ]);

    assert.equal(stats.average, 7);
  });

  it('keeps one decimal of the average', () => {
    const stats = periodStats([
      { day: '2026-10-28', count: 1 },
      { day: '2026-10-29', count: 1 },
      { day: '2026-10-30', count: 2 },
    ]);

    assert.equal(stats.average, 1.3);
  });

  it('takes the newest day as the last report, whatever order the rows came in', () => {
    const stats = periodStats([
      { day: '2026-11-02', count: 2 },
      { day: '2026-10-30', count: 5 },
      { day: '2026-11-01', count: 3 },
    ]);

    assert.deepEqual(stats.latest, { day: '2026-11-02', count: 2 });
  });

  it('says nothing at all when the window has no reports', () => {
    assert.deepEqual(periodStats([]), {
      days: 0,
      best: null,
      average: 0,
      latest: null,
    });
  });

  it('ignores a zero row when it looks for the newest day', () => {
    // A stored zero is a measurement of nothing, not a report.
    const stats = periodStats([
      { day: '2026-10-30', count: 4 },
      { day: '2026-11-02', count: 0 },
    ]);

    assert.deepEqual(stats.latest, { day: '2026-10-30', count: 4 });
  });
});
