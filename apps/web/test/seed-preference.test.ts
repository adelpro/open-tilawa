import assert from 'node:assert/strict';
import { test } from 'node:test';

import { setSharesPieces, sharesPieces } from '../src/utils/seed-preference.ts';
import { STORAGE_KEYS } from '../src/utils/storage-keys.ts';

function storage(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(STORAGE_KEYS.seed, initial);
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    map,
  };
}

test('sharing is on until the listener turns it off', () => {
  assert.equal(sharesPieces(storage()), true);
  assert.equal(sharesPieces(storage('on')), true);
  assert.equal(sharesPieces(storage('off')), false);
});

test('the answer is written where the client reads it at creation', () => {
  const local = storage();
  setSharesPieces(false, local);
  assert.equal(local.map.get(STORAGE_KEYS.seed), 'off');
  assert.equal(sharesPieces(local), false);

  setSharesPieces(true, local);
  assert.equal(sharesPieces(local), true);
});

test('storage that refuses to answer is not a reason to stop listening', () => {
  const denied = {
    getItem(): string {
      throw new Error('denied');
    },
  };
  assert.equal(sharesPieces(denied), true);
});

test('the key is the app’s own, and nothing syncs it', () => {
  assert.equal(STORAGE_KEYS.seed, 'tilawah:seed');
});
