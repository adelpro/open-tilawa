import assert from 'node:assert/strict';
import { test } from 'node:test';

import { importDecision, shouldSkip, totalBytes, trackFileName, validFolderName } from '../lib/itqan.mjs';

test('track file names are the three-digit surah', () => {
  assert.equal(trackFileName(1), '001.mp3');
  assert.equal(trackFileName(9), '009.mp3');
  assert.equal(trackFileName(114), '114.mp3');
});

test('the total is the sum of the declared sizes', () => {
  assert.equal(totalBytes([{ size_bytes: 10 }, { size_bytes: 32 }]), 42);
  assert.equal(totalBytes([]), 0);
});

test('a file is skipped only when its size matches', () => {
  assert.equal(shouldSkip(10, 10), true);
  assert.equal(shouldSkip(9, 10), false);
  assert.equal(shouldSkip(null, 10), false);
  assert.equal(shouldSkip(10, 0), false);
});

test('folder names stay filesystem- and URL-safe', () => {
  assert.equal(validFolderName('Atef_Muftah_Hafs'), true);
  assert.equal(validFolderName('Atef-Muftah'), true);
  assert.equal(validFolderName('Atef Muftah'), false);
  assert.equal(validFolderName('../etc'), false);
  assert.equal(validFolderName(''), false);
});

test('an interrupted import resumes only when asked', () => {
  assert.equal(importDecision(0, false), 'start');
  assert.equal(importDecision(0, true), 'start');
  assert.equal(importDecision(5, false), 'refuse');
  assert.equal(importDecision(5, true), 'resume');
});
