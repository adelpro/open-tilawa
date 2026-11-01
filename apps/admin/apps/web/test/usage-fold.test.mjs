import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FOLDED,
  USAGE_PANELS,
  readFolded,
  writeFolded,
} from '../src/lib/usage-fold.ts';

const reader = (value) => ({ getItem: () => value });

describe('usage panel folding', () => {
  it('opens every panel when nothing was stored', () => {
    assert.deepEqual(readFolded(reader(null)), DEFAULT_FOLDED);
    assert.equal(Object.keys(DEFAULT_FOLDED).length, USAGE_PANELS.length);
    assert.ok(Object.values(DEFAULT_FOLDED).every((open) => open === false));
  });

  it('remembers a folded panel and leaves the rest open', () => {
    const folded = readFolded(reader('{"surahs":true,"devices":true}'));
    assert.equal(folded.surahs, true);
    assert.equal(folded.devices, true);
    assert.equal(folded.reciters, false);
    assert.equal(folded.recent, false);
  });

  it('never leaves a panel folded because of a bad value', () => {
    assert.deepEqual(readFolded(reader('{oops')), DEFAULT_FOLDED);
    assert.deepEqual(readFolded(reader('null')), DEFAULT_FOLDED);
    assert.deepEqual(readFolded(reader('{"surahs":"yes"}')), DEFAULT_FOLDED);
    assert.deepEqual(readFolded(reader('{"unknown":true}')), DEFAULT_FOLDED);
  });

  it('writes every panel under one stable key', () => {
    let seen = null;
    writeFolded(
      { ...DEFAULT_FOLDED, volume: true },
      { setItem: (key, value) => (seen = [key, value]) },
    );
    assert.equal(seen[0], 'tilawa.usage.folded');
    assert.equal(JSON.parse(seen[1]).volume, true);
    assert.equal(JSON.parse(seen[1]).surahs, false);
  });

  it('survives storage being unavailable', () => {
    assert.doesNotThrow(() =>
      readFolded({
        getItem: () => {
          throw new Error('denied');
        },
      }),
    );
    assert.doesNotThrow(() =>
      writeFolded(DEFAULT_FOLDED, {
        setItem: () => {
          throw new Error('denied');
        },
      }),
    );
  });
});
