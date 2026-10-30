import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  autoGain,
  downsample,
  peakMagnitude,
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

// Recitation time-domain peaks land around 0.05-0.2 of full scale, so the wave
// drew a ripple on the floor. The gain lifts a quiet recording toward the block
// height, never attenuates a loud one, and leaves true silence alone.
test('autoGain lifts a quiet signal, caps the boost, and leaves silence flat', () => {
  assert.equal(autoGain(0), 1);
  assert.equal(autoGain(0.01), 1);
  assert.equal(autoGain(0.05), 3);
  assert.equal(autoGain(0.1), 3);
  assert.equal(autoGain(0.3), 3);
  assert.equal(autoGain(0.45), 2);
  assert.equal(autoGain(0.9), 1);
  assert.equal(autoGain(1), 1);
  assert.equal(autoGain(Number.NaN), 1);
  // Whatever the input, the gain stays within the block's budget.
  for (const peak of [0, 0.02, 0.08, 0.2, 0.5, 1, 4]) {
    const gain = autoGain(peak);
    assert.ok(gain >= 1 && gain <= 3, `gain ${gain} for peak ${peak}`);
  }
});

test('waveTints lays four even steps from the front tint to the back one', () => {
  const tints = waveTints('#1c4d78', '#5d97c9');
  assert.deepEqual(tints, ['#1c4d78', '#326693', '#477eae', '#5d97c9']);
  // Never one flat colour: the layers have to be tellable apart.
  assert.equal(new Set(tints).size, 4);
  assert.equal(tints.at(0), '#1c4d78');
  assert.equal(tints.at(-1), '#5d97c9');
});

test('peakMagnitude is the largest deviation from centre, either polarity', () => {
  const time = new Uint8Array(16).fill(128);
  assert.equal(peakMagnitude(time), 0);
  time[3] = 128 + 64;
  assert.equal(peakMagnitude(time), 0.5);
  time[9] = 0;
  assert.equal(peakMagnitude(time), 1);
});

// The ribbon used to smooth signed samples from unsynchronised snapshots, which
// aliased against the read rate and made the height follow pitch. A peak over a
// whole read is the same for any pitch and phase of a voice.
test('peakMagnitude gives the same loudness for any pitch and phase', () => {
  const peaks = [100, 143, 150, 157, 210, 320].flatMap((hz) =>
    [0, 0.7, 2.1, 4.4].map((phase) => {
      const time = new Uint8Array(1024);
      for (let i = 0; i < time.length; i += 1) {
        time[i] = Math.round(128 + 128 * 0.15 * Math.sin((2 * Math.PI * hz * i) / 48000 + phase));
      }
      return peakMagnitude(time);
    }),
  );
  assert.ok(Math.max(...peaks) - Math.min(...peaks) < 0.02, `spread ${Math.max(...peaks) - Math.min(...peaks)}`);
  assert.ok(Math.min(...peaks) > 0.14, 'a 0.15 tone still reads about 0.15');
});
