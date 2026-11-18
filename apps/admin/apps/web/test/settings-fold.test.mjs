import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_SETTINGS_FOLDS,
  STORAGE_KEY,
  readFolds,
  writeFolds,
} from '../src/lib/settings-fold.ts';

function storage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(STORAGE_KEY, initial);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('settings fold memory', () => {
  it('opens the panel with no stored value', () => {
    assert.deepEqual(readFolds(storage()), DEFAULT_SETTINGS_FOLDS);
  });

  it('folds only on an explicit true', () => {
    assert.deepEqual(readFolds(storage('{"recentAlerts":true}')), { recentAlerts: true });
    assert.deepEqual(readFolds(storage('{"recentAlerts":false}')), DEFAULT_SETTINGS_FOLDS);
  });

  it('opens the panel on corrupt or unknown values', () => {
    assert.deepEqual(readFolds(storage('{oops')), DEFAULT_SETTINGS_FOLDS);
    assert.deepEqual(readFolds(storage('{"other":true}')), DEFAULT_SETTINGS_FOLDS);
  });

  it('writes the fold under its own key', () => {
    const store = storage();
    writeFolds({ recentAlerts: true }, store);
    assert.equal(JSON.parse(store.values.get(STORAGE_KEY)).recentAlerts, true);
  });

  it('keeps working when the browser refuses to store', () => {
    const store = { getItem: () => null, setItem: () => { throw new Error('denied'); } };
    assert.doesNotThrow(() => writeFolds({ recentAlerts: true }, store));
  });
});
