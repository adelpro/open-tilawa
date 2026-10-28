import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  downsample,
  mixHex,
  normaliseVisualiser,
  VISUALISERS,
  waveTints,
} from '../src/utils/visualiser-models.ts';

test('an unknown stored model falls back to waves, the default shape', () => {
  assert.equal(normaliseVisualiser('bars'), 'bars');
  assert.equal(normaliseVisualiser('ribbon'), 'ribbon');
  assert.equal(normaliseVisualiser('waterfall'), 'ribbon');
  assert.equal(normaliseVisualiser('nope'), 'ribbon');
  assert.equal(normaliseVisualiser(undefined), 'ribbon');
  assert.equal(VISUALISERS.length, 3);
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

test('mixHex walks one colour toward another and clamps its position', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0), '#000000');
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mixHex('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mixHex('#000000', '#ffffff', -3), '#000000');
  assert.equal(mixHex('#000000', '#ffffff', 4), '#ffffff');
  // Shorthand in, long form out: canvas takes neither, but the ramp does.
  assert.equal(mixHex('#fff', '#000', 0), '#ffffff');
});

test('waveTints lays four even steps from the front tint to the back one', () => {
  const tints = waveTints('#1c4d78', '#5d97c9');
  assert.deepEqual(tints, ['#1c4d78', '#326693', '#477eae', '#5d97c9']);
  // Never one flat colour: the layers have to be tellable apart.
  assert.equal(new Set(tints).size, 4);
  assert.equal(tints.at(0), '#1c4d78');
  assert.equal(tints.at(-1), '#5d97c9');
});
