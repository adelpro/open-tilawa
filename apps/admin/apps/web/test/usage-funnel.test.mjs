import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { funnelRows, playedShare, returningDevices } from '../src/lib/usage-funnel.ts';

/**
 * The launch funnel: devices that opened the app, devices that played, and the
 * share between them.
 *
 * The two series are separate daily counters that cannot be joined to each
 * other, so all this module does is line them up by day and divide one by the
 * other — and be explicit about the days where dividing would be a lie.
 */

describe('funnelRows', () => {
  it('lines both series up by day and keeps every day either one knows about', () => {
    const rows = funnelRows(
      [
        { day: '2026-10-29', devices: 10 },
        { day: '2026-10-30', devices: 12 },
      ],
      [{ day: '2026-10-30', listeners: 3 }],
    );

    assert.deepEqual(rows, [
      { day: '2026-10-29', devices: 10, listeners: 0 },
      { day: '2026-10-30', devices: 12, listeners: 3 },
    ]);
  });

  it('keeps a day that only a listener reported, rather than dropping the row', () => {
    const rows = funnelRows([], [{ day: '2026-10-31', listeners: 2 }]);

    assert.deepEqual(rows, [{ day: '2026-10-31', devices: 0, listeners: 2 }]);
  });

  it('orders the days oldest first, whatever order the server returned', () => {
    const rows = funnelRows(
      [{ day: '2026-10-31', devices: 1 }],
      [{ day: '2026-10-30', listeners: 1 }],
    );

    assert.deepEqual(
      rows.map((row) => row.day),
      ['2026-10-30', '2026-10-31'],
    );
  });
});

describe('playedShare', () => {
  it('is the share of opening devices that played', () => {
    assert.equal(playedShare(3, 12), 0.25);
    assert.equal(playedShare(10, 10), 1);
  });

  it('is nothing to show when no device opened the app', () => {
    assert.equal(playedShare(0, 0), null);
  });

  it('never reports more than all of them, even when the counters disagree', () => {
    // A device that cleared its storage can report a second "first play" without
    // a second "device": the honest reading is a floor, not 150%.
    assert.equal(playedShare(6, 4), 1);
  });
});

describe('returningDevices', () => {
  it('reads the latest day that reported an age, not the window total', () => {
    const result = returningDevices([
      { day: '2026-10-31', age: 'new', devices: 5 },
      { day: '2026-11-01', age: 'new', devices: 2 },
      { day: '2026-11-01', age: '7-13', devices: 3 },
      { day: '2026-11-01', age: '30+', devices: 1 },
    ]);
    assert.deepEqual(result, { day: '2026-11-01', returning: 4, known: 6 });
  });

  it('counts an unknown age as known but not as returning', () => {
    const result = returningDevices([
      { day: '2026-11-01', age: 'new', devices: 1 },
      { day: '2026-11-01', age: 'unknown', devices: 4 },
    ]);
    assert.deepEqual(result, { day: '2026-11-01', returning: 0, known: 5 });
  });

  it('says nothing when no device reported an age', () => {
    assert.equal(returningDevices([]), null);
    assert.equal(returningDevices([{ day: '2026-11-01', age: 'new', devices: 0 }]), null);
  });
});

describe('returningDevices', () => {
  it('says whether any device in the window ever reported a 7-day age', () => {
    const young = returningDevices([
      { day: '2026-11-11', age: 'new', devices: 1 },
      { day: '2026-11-10', age: '4-6', devices: 2 },
    ]);
    // Zero here is the sample talking, not the product: no device has crossed a week.
    assert.equal(young?.returning, 0);
    assert.equal(young?.anyReturning, false);

    const old = returningDevices([
      { day: '2026-11-11', age: 'new', devices: 1 },
      { day: '2026-11-09', age: '7-13', devices: 2 },
    ]);
    assert.equal(old?.anyReturning, true);
  });
});
