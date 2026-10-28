import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bytes } from '../src/lib/format.ts';

/**
 * The seeder reports fractional speeds — 0.8 B/s while it trickles a piece.
 * A negative exponent used to index off the start of the unit ladder and print
 * "819 undefined/s".
 */
describe('bytes', () => {
  it('formats sizes across the ladder', () => {
    assert.equal(bytes(0), '0 B');
    assert.equal(bytes(1536), '1.5 KB');
    assert.equal(bytes(5 * 1024 ** 2), '5 MB');
  });

  it('keeps a sub-byte rate at zero instead of a phantom unit', () => {
    assert.equal(bytes(0.8, 'en', true), '0 B/s');
    assert.equal(bytes(0.8, 'ar', true), '0 B/s');
  });
});
