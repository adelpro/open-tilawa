import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nextSort, sortRows, summaryQuery } from '../src/lib/usage-filters.ts';

/**
 * The usage screen's arithmetic, kept out of the route so it can be reasoned about
 * without a browser: what a header click does, how a table is ordered, and what the
 * summary request looks like.
 */

const plays = [
  { surah: 2, plays: 9 },
  { surah: 18, plays: 40 },
  { surah: 36, plays: 9 },
];

const comparators = {
  surah: (a, b) => a.surah - b.surah,
  plays: (a, b) => a.plays - b.plays,
};

describe('nextSort', () => {
  it('flips the direction when the same column is asked for again', () => {
    assert.deepEqual(nextSort({ key: 'plays', dir: 'desc' }, 'plays'), {
      key: 'plays',
      dir: 'asc',
    });
  });

  it('starts a new column ascending, the way the rest of the console does', () => {
    assert.deepEqual(nextSort({ key: 'plays', dir: 'desc' }, 'surah'), {
      key: 'surah',
      dir: 'asc',
    });
  });
});

describe('sortRows', () => {
  it('orders by the chosen column without touching the input', () => {
    const rows = [...plays];
    const sorted = sortRows(rows, comparators, { key: 'plays', dir: 'desc' });

    assert.deepEqual(
      sorted.map((row) => row.surah),
      [18, 2, 36],
    );
    assert.deepEqual(rows, plays, 'the caller array was sorted in place');
  });

  it('keeps ties in the order they arrived, so a re-render cannot reshuffle them', () => {
    const sorted = sortRows(plays, comparators, { key: 'plays', dir: 'desc' });
    assert.deepEqual(
      sorted.filter((row) => row.plays === 9).map((row) => row.surah),
      [2, 36],
    );
  });

  it('leaves the rows alone for a column it does not know', () => {
    const sorted = sortRows(plays, comparators, { key: 'reciter', dir: 'asc' });
    assert.deepEqual(sorted, plays);
  });
});

describe('summaryQuery', () => {
  it('asks for the window alone when nothing is filtered', () => {
    assert.equal(summaryQuery(7, {}), '/admin/telemetry/summary?days=7');
  });

  it('carries every filter that is set, in a stable order', () => {
    assert.equal(
      summaryQuery(30, { reciter: 'abdul-basit', source: 'webseed', version: '1.12.2' }),
      '/admin/telemetry/summary?days=30&source=webseed&version=1.12.2&reciter=abdul-basit',
    );
  });

  it('leaves an empty filter out instead of asking for an empty string', () => {
    assert.equal(summaryQuery(90, { version: '' }), '/admin/telemetry/summary?days=90');
  });

  it('encodes a value that would otherwise break the query', () => {
    const query = summaryQuery(7, { reciter: 'a&b c' });
    // The point is that the value survives the trip, not which escaper was used.
    assert.equal(new URLSearchParams(query.split('?')[1]).get('reciter'), 'a&b c');
  });
});
