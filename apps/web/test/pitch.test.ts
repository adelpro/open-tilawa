import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  acceptFrame,
  findHolds,
  hzToMidi,
  INITIAL_JUMP,
  median3,
  midiToHz,
  shouldResetContour,
  type Sample,
} from '../src/utils/pitch.ts';

test('MIDI to Hz is the inverse of the detector scale', () => {
  assert.equal(Math.round(midiToHz(69)), 440);
  assert.equal(Math.round(midiToHz(57)), 220);
  assert.equal(Math.round(midiToHz(45)), 110);
  assert.equal(Math.round(midiToHz(60)), 262);
});

test('Hz to MIDI uses A4 = 440', () => {
  assert.equal(Math.round(hzToMidi(440)), 69);
  assert.equal(Math.round(hzToMidi(220)), 57);
});

test('median3 rejects a one-frame spike', () => {
  assert.equal(median3(60, 72, 60), 60);
  assert.equal(median3(60, 61, 62), 61);
});

test('an octave error snaps down; a 14-semitone leap does not', () => {
  const snapped = acceptFrame(72, 60, INITIAL_JUMP);
  assert.equal(snapped.midi, 60);
  const leap = acceptFrame(74, 60, INITIAL_JUMP);
  assert.equal(leap.midi, null);
  assert.equal(leap.state.pending, 74);
});

test('a jump is accepted only on the fourth agreeing frame', () => {
  let state = INITIAL_JUMP;
  let midi: number | null = null;
  for (let i = 0; i < 4; i += 1) {
    const out = acceptFrame(65, 60, state);
    midi = out.midi;
    state = out.state;
  }
  assert.equal(midi, 65);
});

test('a sliding madd is one hold, not three boxes', () => {
  const samples: Sample[] = [];
  for (let i = 0; i < 30; i += 1) {
    samples.push({ t: i / 30, midi: 60 + i * 0.2, rms: 0.2 });
  }
  const holds = findHolds(samples, 0.35);
  assert.equal(holds.length, 1);
  assert.ok(holds[0].end - holds[0].start > 0.8);
});

test('a 0.2 s silence splits two holds', () => {
  const samples: Sample[] = [];
  for (let i = 0; i < 15; i += 1) samples.push({ t: i / 30, midi: 60, rms: 0.2 });
  for (let i = 21; i < 36; i += 1) samples.push({ t: i / 30, midi: 60, rms: 0.2 });
  assert.equal(findHolds(samples, 0.35).length, 2);
});

test('a hold shorter than the floor is not a madd', () => {
  const samples: Sample[] = [];
  for (let i = 0; i < 9; i += 1) samples.push({ t: i / 30, midi: 60, rms: 0.2 });
  assert.deepEqual(findHolds(samples, 0.35), []);
});

test('a seek or a track change resets the contour', () => {
  assert.equal(shouldResetContour(30, 30.033), false);
  assert.equal(shouldResetContour(30, 33), true);
  assert.equal(shouldResetContour(30, 2), true);
  assert.equal(shouldResetContour(null, 5), false);
});

test('a single unvoiced frame does not split a madd', () => {
  const samples: Sample[] = [];
  for (let i = 0; i < 30; i += 1) samples.push({ t: i / 30, midi: 60, rms: 0.2 });
  samples[15] = { t: 15 / 30, midi: null, rms: 0.2 };
  assert.equal(findHolds(samples, 0.35).length, 1);
});

test('a 0.2 s run of unvoiced frames splits two holds', () => {
  const samples: Sample[] = [];
  for (let i = 0; i < 30; i += 1) samples.push({ t: i / 30, midi: 60, rms: 0.2 });
  for (let i = 15; i < 18; i += 1) samples[i] = { t: i / 30, midi: null, rms: 0.2 };
  assert.equal(findHolds(samples, 0.35).length, 2);
});
