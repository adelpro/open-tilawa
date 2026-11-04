import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clampVolume,
  DEFAULT_VOLUME,
  readVolume,
  toggleVolume,
  writeVolume,
  type VolumeStorage,
} from '../src/utils/volume.ts';

function fakeStorage(initial: Record<string, string> = {}): VolumeStorage & { value: () => string | null } {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    value: () => map.get('tilawah:volume') ?? null,
  };
}

test('volume is clamped to 0–1, and a non-number is the default', () => {
  assert.equal(clampVolume(-1), 0);
  assert.equal(clampVolume(2), 1);
  assert.equal(clampVolume(0.4), 0.4);
  assert.equal(clampVolume(Number.NaN), DEFAULT_VOLUME);
});

test('an absent or unreadable store reads as full volume', () => {
  assert.equal(readVolume(null), DEFAULT_VOLUME);
  assert.equal(readVolume(fakeStorage()), DEFAULT_VOLUME);
  assert.equal(readVolume(fakeStorage({ 'tilawah:volume': 'loud' })), DEFAULT_VOLUME);
  assert.equal(readVolume(fakeStorage({ 'tilawah:volume': '1.7' })), 1);
});

test('a stored level is read and written back', () => {
  const storage = fakeStorage({ 'tilawah:volume': '0.4' });
  assert.equal(readVolume(storage), 0.4);
  writeVolume(0.25, storage);
  assert.equal(storage.value(), '0.25');
  writeVolume(0, storage);
  assert.equal(storage.value(), '0');
});

test('toggling mutes to zero and remembers the level it left', () => {
  assert.deepEqual(toggleVolume(0.6, 1), { volume: 0, lastVolume: 0.6 });
  assert.deepEqual(toggleVolume(0, 0.6), { volume: 0.6, lastVolume: 0.6 });
  assert.deepEqual(toggleVolume(0, 0), { volume: 1, lastVolume: 1 });
});
