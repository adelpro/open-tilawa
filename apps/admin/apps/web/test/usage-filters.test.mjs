import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  nextSort,
  reciterLabel,
  sortRows,
  sortVolume,
  summaryQuery,
} from '../src/lib/usage-filters.ts';

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

describe('sortVolume', () => {
  const volume = [
    { reciter: 'Al-Husary', serverBytes: 0, torrentBytes: 900 },
    { reciter: 'Al-Minshawi', serverBytes: 500, torrentBytes: 100 },
    { reciter: 'Al-Muaiqly', serverBytes: 200, torrentBytes: 0 },
  ];

  it('opens on what is served most, whichever way it was served', () => {
    // 900 over torrent, 600 over the web seed, 200 over the web seed: the leading
    // row has no web-seed bytes at all, which is why the order cannot be a single
    // column.
    const rows = sortVolume(volume, { key: 'served', dir: 'desc' });
    assert.deepEqual(
      rows.map((row) => row.reciter),
      ['Al-Husary', 'Al-Minshawi', 'Al-Muaiqly'],
    );
  });

  it('orders each measured figure on its own', () => {
    assert.deepEqual(
      sortVolume(volume, { key: 'serverBytes', dir: 'desc' }).map((row) => row.serverBytes),
      [500, 200, 0],
    );
    assert.deepEqual(
      sortVolume(volume, { key: 'torrentBytes', dir: 'asc' }).map((row) => row.torrentBytes),
      [0, 100, 900],
    );
  });

  it('orders by name, and knows the difference between two alphabets', () => {
    const rows = sortVolume(volume, { key: 'reciter', dir: 'asc' });
    assert.deepEqual(
      rows.map((row) => row.reciter),
      ['Al-Husary', 'Al-Minshawi', 'Al-Muaiqly'],
    );
  });

  it('sorts named rows by what the locale prints, not by the slug', () => {
    const named = [
      { reciter: 'b', name: 'B', nameAr: 'ياسر', serverBytes: 0, torrentBytes: 0 },
      { reciter: 'a', name: 'A', nameAr: 'أحمد', serverBytes: 0, torrentBytes: 0 },
    ];
    assert.deepEqual(
      sortVolume(named, { key: 'reciter', dir: 'asc' }, 'ar').map((row) => row.nameAr),
      ['أحمد', 'ياسر'],
    );
    assert.deepEqual(
      sortVolume(named, { key: 'reciter', dir: 'asc' }, 'en').map((row) => row.name),
      ['A', 'B'],
    );
  });

  it('does not add the two figures to anything the screen shows', () => {
    // `served` ranks only: the rows keep their two separate numbers.
    const [first] = sortVolume(volume, { key: 'served', dir: 'desc' });
    assert.deepEqual(first, { reciter: 'Al-Husary', serverBytes: 0, torrentBytes: 900 });
  });
});

describe('reciterLabel', () => {
  it('prefers the audience name in Arabic and the catalogue title in English', () => {
    const row = { reciter: 'maher-al-muaiqly', name: 'Maher Al Muaiqly', nameAr: 'ماهر المعيقلي' };
    assert.equal(reciterLabel(row, 'ar'), 'ماهر المعيقلي');
    assert.equal(reciterLabel(row, 'en'), 'Maher Al Muaiqly');
  });

  it('falls back across languages rather than showing a blank', () => {
    assert.equal(reciterLabel({ reciter: 'x', nameAr: 'ياسر الدوسري' }, 'en'), 'ياسر الدوسري');
    assert.equal(reciterLabel({ reciter: 'x', name: 'Yasser Al Dosari' }, 'ar'), 'Yasser Al Dosari');
  });

  it('falls back to the slug when the catalogue has no row', () => {
    assert.equal(reciterLabel({ reciter: 'retired-slug' }, 'ar'), 'retired-slug');
    assert.equal(reciterLabel({ reciter: 'retired-slug' }, 'en'), 'retired-slug');
  });

  it('treats whitespace-only names as absent', () => {
    assert.equal(reciterLabel({ reciter: 'slug', name: '   ', nameAr: '  ' }, 'ar'), 'slug');
  });
});

describe('summaryQuery', () => {  it('asks for the window alone when nothing is filtered', () => {
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
