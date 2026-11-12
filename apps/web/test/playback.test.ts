import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isPlaybackMode,
  nextInQueue,
  previousInQueue,
  readPlaybackMode,
  shuffledOrder,
  writePlaybackMode,
} from '../src/utils/playback.ts';
import { STORAGE_KEYS } from '../src/utils/storage-keys.ts';

/** A store that records what the app wrote, and can be told to refuse. */
function store(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

test('the stored mode is read only when it is one of the three', () => {
  assert.equal(readPlaybackMode(store()), 'linear');
  assert.equal(readPlaybackMode(store({ [STORAGE_KEYS.playbackMode]: 'shuffle' })), 'shuffle');
  assert.equal(readPlaybackMode(store({ [STORAGE_KEYS.playbackMode]: 'repeat-one' })), 'repeat-one');
  assert.equal(readPlaybackMode(store({ [STORAGE_KEYS.playbackMode]: 'nonsense' })), 'linear');
  assert.equal(isPlaybackMode('nonsense'), false);
});

test('a blocked store is no preference, never a crash', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(readPlaybackMode(blocked), 'linear');
  assert.doesNotThrow(() => writePlaybackMode('shuffle', blocked));
});

test('writing the mode remembers it', () => {
  const storage = store();
  writePlaybackMode('repeat-one', storage);
  assert.equal(storage.map.get(STORAGE_KEYS.playbackMode), 'repeat-one');
});

test('a shuffle order is a permutation and leaves its input alone', () => {
  const ids = [1, 18, 19, 31, 49];
  const order = shuffledOrder(ids, () => 0.42);
  assert.deepEqual([...order].sort((a, b) => a - b), ids);
  assert.deepEqual(ids, [1, 18, 19, 31, 49]);
});

test('the queue wraps, and an unknown current starts at the near end', () => {
  assert.equal(nextInQueue(1, [1, 18, 19]), 18);
  assert.equal(nextInQueue(19, [1, 18, 19]), 1);
  assert.equal(nextInQueue(99, [1, 18, 19]), 1);
  assert.equal(previousInQueue(1, [1, 18, 19]), 19);
  assert.equal(previousInQueue(99, [1, 18, 19]), 19);
  assert.equal(nextInQueue(1, []), null);
  assert.equal(previousInQueue(1, []), null);
});
