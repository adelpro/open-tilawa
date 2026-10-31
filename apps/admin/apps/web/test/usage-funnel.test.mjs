import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { funnelRows, playedShare } from '../src/lib/usage-funnel.ts';

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
