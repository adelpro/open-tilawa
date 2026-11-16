import assert from 'node:assert/strict';
import test from 'node:test';

import { isContrast, resolveContrast } from '../src/utils/contrast.ts';

test('system follows the OS in both directions', () => {
  assert.equal(resolveContrast('system', true), 'more');
  assert.equal(resolveContrast('system', false), 'off');
});

test('an untouched device is on system', () => {
  // Absent, not written: every device that never opened settings.
  assert.equal(resolveContrast(undefined, true), 'more');
  assert.equal(resolveContrast(undefined, false), 'off');
});

test('an explicit choice beats the OS', () => {
  // The whole reason the media query is not a CSS block.
  assert.equal(resolveContrast('more', false), 'more');
  assert.equal(resolveContrast('off', true), 'off');
});

test('only the three literals are accepted from storage or the ring', () => {
  assert.equal(isContrast('system'), true);
  assert.equal(isContrast('more'), true);
  assert.equal(isContrast('off'), true);
  assert.equal(isContrast('sometimes'), false);
  assert.equal(isContrast(undefined), false);
  assert.equal(isContrast(null), false);
});
