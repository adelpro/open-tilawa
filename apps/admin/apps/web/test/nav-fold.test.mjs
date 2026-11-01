import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_FOLDED, readFolded, writeFolded } from '../src/lib/nav-fold.ts';

const reader = (value) => ({ getItem: () => value });

describe('nav folding', () => {
  it('opens both categories when nothing was stored', () => {
    assert.deepEqual(readFolded(reader(null)), DEFAULT_FOLDED);
  });

  it('remembers a folded category', () => {
    assert.deepEqual(readFolded(reader('{"workspace":true,"admin":false}')), {
      workspace: true,
      admin: false,
    });
  });

  it('opens what a partial or corrupt value does not name', () => {
    // A build that only knew workspace must not fold management by accident.
    assert.deepEqual(readFolded(reader('{"workspace":true}')), {
      workspace: true,
      admin: false,
    });
    assert.deepEqual(readFolded(reader('{"admin":"yes"}')), DEFAULT_FOLDED);
    assert.deepEqual(readFolded(reader('{oops')), DEFAULT_FOLDED);
    assert.deepEqual(readFolded(reader('null')), DEFAULT_FOLDED);
  });

  it('writes under the stable key, as JSON', () => {
    let seen = null;
    writeFolded(
      { workspace: false, admin: true },
      { setItem: (key, value) => (seen = [key, value]) },
    );
    assert.deepEqual(seen, ['tilawa.nav.folded', '{"workspace":false,"admin":true}']);
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
      writeFolded(
        { workspace: true, admin: true },
        {
          setItem: () => {
            throw new Error('denied');
          },
        },
      ),
    );
  });
});
