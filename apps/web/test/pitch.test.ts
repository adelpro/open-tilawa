import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  acceptFrame,
  countReversals,
  findSegments,
  hzToMidi,
  INITIAL_JUMP,
  median3,
  midiToHz,
  midiToName,
  percentile,
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

test('a seek or a track change resets the contour', () => {
  assert.equal(shouldResetContour(30, 30.033), false);
  assert.equal(shouldResetContour(30, 33), true);
  assert.equal(shouldResetContour(30, 2), true);
  assert.equal(shouldResetContour(null, 5), false);
});



test('note names are scientific, Do = C, sharp as #', () => {
  assert.equal(midiToName(60), 'Do4');
  assert.equal(midiToName(61), 'Do#4');
  assert.equal(midiToName(59), 'Si3');
  assert.equal(midiToName(45), 'La2');
});

test('percentile reads the sorted array and clamps at both ends', () => {
  const values = Array.from({ length: 11 }, (_, i) => i);
  assert.equal(percentile(values, 0), 0);
  assert.equal(percentile(values, 0.5), 5);
  assert.equal(percentile(values, 1), 10);
});

test('a stable stretch is one segment; a two-semitone step splits it', () => {
  const flat: Sample[] = [];
  for (let i = 0; i < 30; i += 1) flat.push({ t: i / 30, midi: 60, rms: 0.2, strong: true });
  const one = findSegments(flat, 0.45);
  assert.equal(one.length, 1);
  assert.ok(Math.abs(one[0].midi - 60) < 0.01);

  const step: Sample[] = [];
  for (let i = 0; i < 15; i += 1) step.push({ t: i / 30, midi: 60, rms: 0.2, strong: true });
  for (let i = 15; i < 30; i += 1) step.push({ t: i / 30, midi: 62, rms: 0.2, strong: true });
  assert.equal(findSegments(step, 0.45).length, 2);
});

test('a segment shorter than the floor is dropped', () => {
  const short: Sample[] = [];
  for (let i = 0; i < 9; i += 1) short.push({ t: i / 30, midi: 60, rms: 0.2, strong: true });
  assert.deepEqual(findSegments(short, 0.45), []);
});

test('reversals count direction changes, not samples', () => {
  assert.equal(countReversals([60, 60, 60]), 0);
  assert.equal(countReversals([60, 62, 60]), 1);
  assert.equal(countReversals([60, 62, 60, 62, 60]), 3);
});
