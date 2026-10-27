import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeRecent, normaliseRecent, RECENT_LIMIT } from '../src/utils/recent-local.ts';

const entry = (id: string, at: number) => ({ id, at });

test('recent history is newest first', () => {
  const list = normaliseRecent([entry('a', 10), entry('b', 30), entry('c', 20)]);
  assert.deepEqual(
    list.map((e) => e.id),
    ['b', 'c', 'a'],
  );
});

test('listening to a reciter again moves it to the front, not a second row', () => {
  const list = normaliseRecent([entry('a', 10), entry('b', 20), entry('a', 30)]);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'a');
  assert.equal(list[0].at, 30);
});

test('history stops at ten', () => {
  const many = Array.from({ length: 25 }, (_, i) => entry(`r${i}`, i + 1));
  const list = normaliseRecent(many);
  assert.equal(list.length, RECENT_LIMIT);
  assert.equal(list[0].id, 'r24');
});

test('merging a second device keeps one row per reciter and the newest stamp', () => {
  const merged = mergeRecent([entry('a', 10), entry('b', 20)], [entry('a', 40), entry('c', 5)]);
  assert.deepEqual(
    merged.map((e) => e.id),
    ['a', 'b', 'c'],
  );
  assert.equal(merged[0].at, 40);
});

test('an empty history is not an error', () => {
  assert.deepEqual(normaliseRecent([]), []);
  assert.deepEqual(mergeRecent([], []), []);
});
