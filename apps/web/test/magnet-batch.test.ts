import assert from 'node:assert/strict';
import { test } from 'node:test';

import { magnetBatch } from '../src/utils/magnet-batch.ts';

test('one magnet per line, in the order given', () => {
  assert.equal(magnetBatch(['magnet:?a', 'magnet:?b']), 'magnet:?a\nmagnet:?b');
});

test('blank and padded entries do not become empty links', () => {
  assert.equal(magnetBatch(['  magnet:?a  ', '', '   ', 'magnet:?b']), 'magnet:?a\nmagnet:?b');
});

test('an empty roster is an empty string, not a newline', () => {
  assert.equal(magnetBatch([]), '');
  assert.equal(magnetBatch(['', '  ']), '');
});
