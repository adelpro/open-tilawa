import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  downsample,
  follow,
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

// The shape must lift on a syllable and sink after it, not mirror every read.
// Both the bars and the ribbon feed their columns through this one follower.
test('follow closes the attack fraction of the gap rising, and the release falling', () => {
  assert.equal(follow(0, 1, 0.5, 0.1), 0.5);
  assert.ok(Math.abs(follow(1, 0, 0.5, 0.1) - 0.9) < 1e-12);
  // Already there: neither rate moves it.
  assert.equal(follow(0.4, 0.4, 0.9, 0.9), 0.4);
  // A target of zero still lands on the floor, just slowly.
  let level = 1;
  for (let i = 0; i < 200; i += 1) level = follow(level, 0, 0.5, 0.14);
  assert.ok(level < 1e-6, `level ${level} after two hundred releases`);
});

// Rise fast, fall slow: over the same number of reads the rise is much further
// along than the fall, which is what keeps a column from flickering.
test('follow reaches a new level faster than it lets go of the old one', () => {
  let up = 0;
  let down = 1;
  for (let i = 0; i < 3; i += 1) {
    up = follow(up, 1, 0.5, 0.14);
    down = follow(down, 0, 0.5, 0.14);
  }
  assert.ok(up > 0.8, `up ${up}`);
  assert.ok(down > 0.4, `down ${down}`);
  // Progress made, either way: the rise has closed more than the fall has opened.
  assert.ok(up > 1 - down, `up ${up}, down ${down}`);
});

test('waveTints lays four even steps from the front tint to the back one', () => {
  const tints = waveTints('#1c4d78', '#5d97c9');
  assert.deepEqual(tints, ['#1c4d78', '#326693', '#477eae', '#5d97c9']);
  // Never one flat colour: the layers have to be tellable apart.
  assert.equal(new Set(tints).size, 4);
  assert.equal(tints.at(0), '#1c4d78');
  assert.equal(tints.at(-1), '#5d97c9');
});

