import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  downsample,
  normaliseVisualiser,
  VISUALISERS,
} from '../src/utils/visualiser-models.ts';

test('an unknown stored model falls back to bars', () => {
  assert.equal(normaliseVisualiser('bars'), 'bars');
  assert.equal(normaliseVisualiser('waterfall'), 'waterfall');
  assert.equal(normaliseVisualiser('nope'), 'bars');
  assert.equal(normaliseVisualiser(undefined), 'bars');
  assert.equal(VISUALISERS.length, 5);
});

test('downsample keeps the peak of each bucket and normalises it', () => {
  const bins = new Uint8Array(64);
  bins[0] = 255;
  bins[31] = 51;
  const out = downsample(bins, 4);
  assert.equal(out.length, 4);
  assert.equal(out[0], 1);
  assert.ok(out.every((v) => v >= 0 && v <= 1));
});
