import assert from 'node:assert/strict';
import { test } from 'node:test';

import { iconForSource, streamSourceFor } from '../src/utils/stream-source.ts';

test('each stream state has exactly one glyph, shared by every surface', () => {
  assert.equal(iconForSource('waiting'), 'wifi-waiting');
  assert.equal(iconForSource('connected'), 'wifi');
  assert.equal(iconForSource('webseed'), 'server');
  // The drift this map removes: the footer drew `wifi` for a mixed stream
  // while the sheet drew `server`.
  assert.equal(iconForSource('mixed'), 'server');
  // The rescued stream is HTTP from the node's own copy, so it draws the server
  // too — the glyph already exists, the state did not.
  assert.equal(iconForSource('direct'), 'server');
});

test('one rule decides what is feeding the stream, so the glyph and the counter agree', () => {
  assert.equal(streamSourceFor({ webSeed: 'off', peers: 0 }), 'waiting');
  assert.equal(streamSourceFor({ webSeed: 'off', peers: 3 }), 'connected');
  assert.equal(streamSourceFor({ webSeed: 'active', peers: 0 }), 'webseed');
  assert.equal(streamSourceFor({ webSeed: 'active', peers: 2 }), 'mixed');
  assert.equal(streamSourceFor({}), 'waiting');
});

test('a rescued stream is its own state, and it outranks the torrent', () => {
  // The element was re-pointed at /media after the service-worker stream failed.
  // Whatever the torrent still reports, no peer is feeding that element.
  assert.equal(streamSourceFor({ webSeed: 'off', peers: 0, direct: true }), 'direct');
  assert.equal(streamSourceFor({ webSeed: 'active', peers: 2, direct: true }), 'direct');
});
