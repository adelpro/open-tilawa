import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isCommitKey, nextOptionIndex } from '../src/utils/listbox.ts';

const COUNT = 7;

test('down and up move one option and stop at the ends', () => {
  assert.equal(nextOptionIndex(0, COUNT, 'ArrowDown'), 1);
  assert.equal(nextOptionIndex(3, COUNT, 'ArrowDown'), 4);
  assert.equal(nextOptionIndex(COUNT - 1, COUNT, 'ArrowDown'), COUNT - 1);
  assert.equal(nextOptionIndex(COUNT - 1, COUNT, 'ArrowUp'), COUNT - 2);
  assert.equal(nextOptionIndex(0, COUNT, 'ArrowUp'), 0);
});

test('home and end jump to the ends', () => {
  assert.equal(nextOptionIndex(4, COUNT, 'Home'), 0);
  assert.equal(nextOptionIndex(2, COUNT, 'End'), COUNT - 1);
});

test('a key that is not a movement key moves nothing', () => {
  // Enter commits the focused option, and Escape closes; neither re-focuses.
  assert.equal(nextOptionIndex(2, COUNT, 'Enter'), null);
  assert.equal(nextOptionIndex(2, COUNT, 'Escape'), null);
  assert.equal(nextOptionIndex(2, COUNT, 'Tab'), null);
  assert.equal(nextOptionIndex(2, COUNT, 'a'), null);
});

test('an out-of-range or empty list still answers with a real index', () => {
  assert.equal(nextOptionIndex(-3, COUNT, 'ArrowDown'), 1);
  assert.equal(nextOptionIndex(99, COUNT, 'ArrowUp'), COUNT - 2);
  assert.equal(nextOptionIndex(0, 0, 'ArrowDown'), null);
});

test('Enter and Space are the two commit keys', () => {
  assert.equal(isCommitKey('Enter'), true);
  assert.equal(isCommitKey(' '), true);
  assert.equal(isCommitKey('Spacebar'), false);
  assert.equal(isCommitKey('ArrowDown'), false);
});
