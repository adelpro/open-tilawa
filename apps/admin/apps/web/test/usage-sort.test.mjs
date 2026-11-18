import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_USAGE_SORTS,
  STORAGE_KEY,
  readSorts,
  writeSort,
} from '../src/lib/usage-sort.ts';

function storage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(STORAGE_KEY, initial);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('usage sort memory', () => {
  it('opens every table on its default with no stored value', () => {
    assert.deepEqual(readSorts(storage()), DEFAULT_USAGE_SORTS);
  });

  it('restores one stored table and leaves the others at default', () => {
    const saved = { ...DEFAULT_USAGE_SORTS, reciters: { key: 'plays', dir: 'asc' } };
    assert.deepEqual(readSorts(storage(JSON.stringify({ reciters: saved.reciters }))), saved);
  });

  it('rejects an unknown key or direction for that table only', () => {
    const saved = JSON.stringify({
      reciters: { key: 'plays', dir: 'sideways' },
      errors: { key: 'nope', dir: 'asc' },
    });
    assert.deepEqual(readSorts(storage(saved)), DEFAULT_USAGE_SORTS);
  });

  it('opens every table when the stored JSON is corrupt', () => {
    assert.deepEqual(readSorts(storage('{not json')), DEFAULT_USAGE_SORTS);
  });

  it('writes one table without dropping the others', () => {
    const store = storage(JSON.stringify({ reciters: { key: 'plays', dir: 'asc' } }));
    writeSort('errors', { key: 'at', dir: 'asc' }, store);
    assert.deepEqual(JSON.parse(store.values.get(STORAGE_KEY)), {
      ...DEFAULT_USAGE_SORTS,
      reciters: { key: 'plays', dir: 'asc' },
      errors: { key: 'at', dir: 'asc' },
    });
  });

  it('keeps working when the browser refuses to store', () => {
    const store = { getItem: () => null, setItem: () => { throw new Error('denied'); } };
    assert.doesNotThrow(() => writeSort('surahs', { key: 'plays', dir: 'asc' }, store));
  });
});
