import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sourceLabel } from '../src/lib/usage-source.ts';

/**
 * The console's name for a play's source, matching the words the player's own
 * stream sheet uses — the operator reads both screens about the same play.
 */

const t = (key) => `key:${key}`;

describe('sourceLabel', () => {
  it('names the five states the player can report', () => {
    assert.equal(sourceLabel('connected', t), 'key:usage.torrent');
    assert.equal(sourceLabel('waiting', t), 'key:usage.sourceWaiting');
    assert.equal(sourceLabel('webseed', t), 'key:usage.webseed');
    assert.equal(sourceLabel('mixed', t), 'key:usage.sourceMixed');
    assert.equal(sourceLabel('direct', t), 'key:usage.sourceDirect');
  });

  it('names the legacy pair so it cannot be read as the peer row twice', () => {
    // Both states can appear in one window: a client before 1.13.33 reports `torrent`
    // while a current one reports `connected`. Two rows labelled "Peers" is the bug
    // this name fixes; the pair keeps the filter's own words.
    assert.equal(sourceLabel('torrent', t), 'key:usage.legacyPair');
    assert.equal(sourceLabel('webseed', t), 'key:usage.webseed');
  });

  it('shows the raw value when it is a state this build does not know', () => {
    // A newer client can report a state this console has no word for. Printing
    // the value is honest; borrowing another state's name is not.
    assert.equal(sourceLabel('peer-relay', t), 'peer-relay');
  });
});
