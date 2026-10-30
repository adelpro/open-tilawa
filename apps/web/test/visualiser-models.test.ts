import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  downsample,
  follow,
  logBands,
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

// The bars' buckets are nearly linear in frequency, which is fine for 28 columns
// of a display. The ribbon needs a log axis: a recitation has nothing above
// ~8 kHz, so a linear map spends half the strip on silence.
test('logBands spreads the axis by octave and puts the middle of the voice at the middle', () => {
  const bins = new Uint8Array(512);
  const columns = 56;
  const rate = 48000;
  const band = logBands(bins, columns, rate);
  assert.equal(band.length, columns);
  assert.ok(band.every((v) => v === 0));

  // Five and a half octaves from 90 Hz to the top of the voice, so the middle
  // column sits near 640 Hz — not near 7 kHz, where a linear axis put it.
  const binHz = rate / 2 / bins.length;
  const middle = Math.round(Math.sqrt(90 * 4500) / binHz);
  bins[middle] = 255;
  const lit = logBands(bins, columns, rate);
  const hottest = lit.indexOf(Math.max(...lit));
  assert.ok(hottest >= 24 && hottest <= 31, `640 Hz landed in column ${hottest}`);
});

// Bin 0 is DC. Drawing it leaves a notch at the bass edge of the ribbon — the
// very edge the eye reads as "the wave stops short".
test('logBands never spends a column on the DC bin', () => {
  const bins = new Uint8Array(512);
  bins[0] = 255;
  assert.ok(logBands(bins, 56, 48000).every((v) => v === 0));
});

test('logBands clamps its top band to the bins it was given', () => {
  const bins = new Uint8Array(64);
  const band = logBands(bins, 8, 48000);
  assert.equal(band.length, 8);
  assert.ok(band.every((v) => v >= 0 && v <= 1));
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

