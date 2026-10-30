import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  migrateStorageNamespace,
  STORAGE_EVENT,
  STORAGE_KEYS,
  type StorageLike,
} from '../src/utils/storage-keys.ts';

/** A Map-backed Storage: `key(i)` needs insertion order, which a Map keeps. */
function fakeStorage(entries: [string, string][] = []): StorageLike & { dump(): Map<string, string> } {
  const map = new Map(entries);
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    dump: () => map,
  };
}

test('every key and the event share the tilawah namespace', () => {
  for (const value of Object.values(STORAGE_KEYS)) {
    assert.match(value, /^tilawah:/, `${value} is in the new namespace`);
  }
  assert.equal(STORAGE_EVENT, 'tilawah:settings');
  assert.equal(STORAGE_KEYS.countedPrefix, 'tilawah:counted:');
});

test('an existing account key is carried forward, source and all', () => {
  const storage = fakeStorage([
    ['open-tilawa:account', '{"pub":"p"}'],
    ['open-tilawa:favorites', '["1","2"]'],
  ]);

  assert.equal(migrateStorageNamespace(storage), 2);

  const dump = storage.dump();
  assert.equal(dump.get('tilawah:account'), '{"pub":"p"}');
  assert.equal(dump.get('tilawah:favorites'), '["1","2"]');
  // Copy, not move: a tab on the previous bundle still reads the old key.
  assert.equal(dump.get('open-tilawa:account'), '{"pub":"p"}');
});

test('a nested suffix survives: counted and viewed keys keep their identity', () => {
  const storage = fakeStorage([['open-tilawa:counted:user:abc', '["3"]']]);
  migrateStorageNamespace(storage);
  assert.equal(storage.getItem('tilawah:counted:user:abc'), '["3"]');
});

test('a target that already exists wins, and the source is untouched', () => {
  const storage = fakeStorage([
    ['open-tilawa:v3', 'old'],
    ['tilawah:v3', 'new'],
  ]);

  assert.equal(migrateStorageNamespace(storage), 0);
  assert.equal(storage.getItem('tilawah:v3'), 'new');
  assert.equal(storage.getItem('open-tilawa:v3'), 'old');
});

test('unrelated keys are ignored', () => {
  const storage = fakeStorage([
    ['open-tilawa-theme', 'dark'],
    ['tilawa:state', 'legacy'],
    ['other:key', 'x'],
  ]);

  assert.equal(migrateStorageNamespace(storage), 0);
  assert.equal(storage.getItem('tilawah:theme'), null);
  assert.equal(storage.getItem('tilawah:state'), null);
});

test('it is idempotent: the second run copies nothing', () => {
  const storage = fakeStorage([['open-tilawa:recent', '[]']]);
  assert.equal(migrateStorageNamespace(storage), 1);
  assert.equal(migrateStorageNamespace(storage), 0);
});

test('a storage that throws on read does not escape', () => {
  const hostile: StorageLike = {
    length: 1,
    key: () => 'open-tilawa:account',
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };

  assert.equal(migrateStorageNamespace(hostile), 0);
});
