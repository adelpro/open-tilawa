import assert from 'node:assert/strict';
import { test } from 'node:test';

import { iconForSource, streamSourceFor, telemetrySource } from '../src/utils/stream-source.ts';

test('each stream state has exactly one glyph, shared by every surface', () => {
  assert.equal(iconForSource('waiting'), 'wifi-waiting');
  assert.equal(iconForSource('connected'), 'wifi');
  assert.equal(iconForSource('webseed'), 'server');
  // The drift this map removes: the footer drew `wifi` for a mixed stream
  // while the sheet drew `server`.
  assert.equal(iconForSource('mixed'), 'server');
});

test('one rule decides what is feeding the stream, so the glyph and the counter agree', () => {
  assert.equal(streamSourceFor({ webSeed: 'off', peers: 0 }), 'waiting');
  assert.equal(streamSourceFor({ webSeed: 'off', peers: 3 }), 'connected');
  assert.equal(streamSourceFor({ webSeed: 'active', peers: 0 }), 'webseed');
  assert.equal(streamSourceFor({ webSeed: 'active', peers: 2 }), 'mixed');
  assert.equal(streamSourceFor({}), 'waiting');
});

test('telemetry counts a web-seeded play as a fallback and everything else as a torrent', () => {
  assert.equal(telemetrySource('waiting'), 'torrent');
  assert.equal(telemetrySource('connected'), 'torrent');
  assert.equal(telemetrySource('webseed'), 'webseed');
  assert.equal(telemetrySource('mixed'), 'webseed');
});
