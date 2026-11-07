import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MESSAGES } from '../src/i18n/messages.ts';

/**
 * `en` is typed against `ar`, so a missing key is a compile error — but a key
 * added to one tree with a different shape (an array of three against four, a
 * string against an object) compiles and then renders half the page. This walks
 * both trees and compares the leaf paths.
 */
function keys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => keys(entry, `${prefix}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      keys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

test('every seedPage string exists in both locales', () => {
  assert.deepEqual(keys(MESSAGES.en.seedPage).sort(), keys(MESSAGES.ar.seedPage).sort());
});
