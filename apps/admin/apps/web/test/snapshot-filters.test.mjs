import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filterSnapshots, sortSnapshots } from '../src/lib/snapshot-filters.ts';

const now = Date.parse('2026-11-18T12:00:00.000Z');
const files = [
  { name: 'tilawa-admin-20261118T100000Z.sqlite', size: 300, mtime: '2026-11-18T10:00:00.000Z' },
  { name: 'tilawa-admin-20261110T100000Z.sqlite', size: 100, mtime: '2026-11-10T10:00:00.000Z' },
  { name: 'tilawa-admin-20261117T100000Z.sqlite', size: 200, mtime: '2026-11-17T10:00:00.000Z' },
];

describe('snapshot filters', () => {
  it('returns every row for an empty filter', () => {
    assert.deepEqual(filterSnapshots(files, { query: '', olderThanDays: null }, now), files);
  });

  it('matches the file name case-insensitively', () => {
    const result = filterSnapshots(files, { query: '20261117', olderThanDays: null }, now);
    assert.deepEqual(result.map((row) => row.name), ['tilawa-admin-20261117T100000Z.sqlite']);
  });

  it('keeps only rows older than the chosen age', () => {
    const result = filterSnapshots(files, { query: '', olderThanDays: 7 }, now);
    assert.deepEqual(result.map((row) => row.name), ['tilawa-admin-20261110T100000Z.sqlite']);
  });
});

describe('snapshot sorting', () => {
  it('sorts newest and oldest first', () => {
    assert.deepEqual(sortSnapshots(files, 'newest').map((row) => row.size), [300, 200, 100]);
    assert.deepEqual(sortSnapshots(files, 'oldest').map((row) => row.size), [100, 200, 300]);
  });

  it('sorts largest and smallest first', () => {
    assert.deepEqual(sortSnapshots(files, 'largest').map((row) => row.size), [300, 200, 100]);
    assert.deepEqual(sortSnapshots(files, 'smallest').map((row) => row.size), [100, 200, 300]);
  });

  it('sorts by name and keeps equal values stable', () => {
    const tied = [
      { name: 'b.sqlite', size: 10, mtime: '2026-11-18T10:00:00.000Z' },
      { name: 'a.sqlite', size: 10, mtime: '2026-11-18T10:00:00.000Z' },
    ];
    assert.deepEqual(sortSnapshots(tied, 'name').map((row) => row.name), ['a.sqlite', 'b.sqlite']);
    assert.deepEqual(sortSnapshots(tied, 'largest').map((row) => row.name), ['b.sqlite', 'a.sqlite']);
  });
});
