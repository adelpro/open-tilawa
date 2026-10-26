import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextIndex, permute, playOrder, previousIndex, splitQueue } from '../src/utils/queue.ts';

const seeded = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('permute is a permutation of the full range', () => {
  const order = permute(10, seeded([0.1, 0.9, 0.4, 0.7]));
  assert.equal(order.length, 10);
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('permute is deterministic for a given rng', () => {
  assert.deepEqual(permute(6, seeded([0.3, 0.6])), permute(6, seeded([0.3, 0.6])));
});

test('playOrder is mushaf order when shuffle is off', () => {
  assert.deepEqual(playOrder(4, false, []), [0, 1, 2, 3]);
});

test('playOrder reuses a stored permutation when it matches the length', () => {
  assert.deepEqual(playOrder(3, true, [2, 0, 1]), [2, 0, 1]);
});

test('playOrder rebuilds when the stored permutation is stale', () => {
  const order = playOrder(3, true, [2, 0]);
  assert.equal(order.length, 3);
});

test('nextIndex wraps and tolerates an unknown current index', () => {
  assert.equal(nextIndex(2, [0, 1, 2]), 0);
  assert.equal(nextIndex(0, [0, 1, 2]), 1);
  assert.equal(nextIndex(9, [0, 1, 2]), 0);
  assert.equal(nextIndex(0, []), 0);
});

test('previousIndex wraps backwards', () => {
  assert.equal(previousIndex(0, [0, 1, 2]), 2);
  assert.equal(previousIndex(2, [0, 1, 2]), 1);
  assert.equal(previousIndex(9, [0, 1, 2]), 2);
});

test('splitQueue puts the current row in neither half', () => {
  assert.deepEqual(splitQueue([0, 1, 2, 3], 1), { upcoming: [2, 3], previous: [0] });
});

test('splitQueue returns everything as upcoming when nothing is current', () => {
  assert.deepEqual(splitQueue([0, 1], -1), { upcoming: [0, 1], previous: [] });
});

test('splitQueue reverses history so the last-played sits on top', () => {
  assert.deepEqual(splitQueue([0, 1, 2, 3], 3), { upcoming: [], previous: [2, 1, 0] });
});
