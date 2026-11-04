import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LAST_PATH_KEY,
  readLastPath,
  rememberablePath,
  restorablePath,
  writeLastPath,
} from '../src/lib/last-route.ts';

/**
 * Picking up where the console left off.
 *
 * The console is URL-driven, so "the page I was on" is already a path — the only
 * question is which stored paths are safe to reopen: a screen that exists, one
 * the signed-in role may see, and never a token link.
 */

const reader = (value) => ({ getItem: () => value });

describe('restorablePath', () => {
  it('reopens the screen that was stored', () => {
    assert.equal(restorablePath('/console/usage', 'admin'), '/console/usage');
  });

  it('keeps a detail screen, so a turn does not reopen as the list', () => {
    assert.equal(restorablePath('/console/turns/12', 'admin'), '/console/turns/12');
  });

  it('restores nothing when nothing was stored', () => {
    assert.equal(restorablePath(null, 'admin'), null);
    assert.equal(restorablePath('', 'admin'), null);
  });

  it('refuses a path that is not a console screen', () => {
    assert.equal(restorablePath('/reset-password/abc', 'admin'), null);
    assert.equal(restorablePath('/console/nonsense', 'admin'), null);
    assert.equal(restorablePath('https://example.com/console/usage', 'admin'), null);
  });

  it('refuses a screen the role cannot open', () => {
    // A plain user must not reopen an admin-only screen and then see Seeders
    // under a Usage address.
    assert.equal(restorablePath('/console/usage', 'user'), null);
    assert.equal(restorablePath('/console/seeders', 'user'), '/console/seeders');
  });

  it('refuses a stored value with a query or a fragment', () => {
    assert.equal(restorablePath('/console/usage?x=1', 'admin'), null);
    assert.equal(restorablePath('/console/usage#top', 'admin'), null);
  });
});

describe('rememberablePath', () => {
  it('remembers a console screen', () => {
    assert.equal(rememberablePath('/console/usage'), '/console/usage');
    assert.equal(rememberablePath('/console/torrents/abc'), '/console/torrents/abc');
  });

  it('does not remember the bare console, the landing page, or token links', () => {
    assert.equal(rememberablePath('/console'), null);
    assert.equal(rememberablePath('/'), null);
    assert.equal(rememberablePath('/setup'), null);
    assert.equal(rememberablePath('/activate/abc'), null);
  });
});

describe('last path storage', () => {
  it('writes under the stable key', () => {
    let seen = null;
    writeLastPath('/console/usage', { setItem: (key, value) => (seen = [key, value]) });
    assert.deepEqual(seen, [LAST_PATH_KEY, '/console/usage']);
  });

  it('reads what it wrote', () => {
    assert.equal(readLastPath(reader('/console/usage')), '/console/usage');
  });

  it('survives storage being unavailable', () => {
    assert.equal(
      readLastPath({
        getItem: () => {
          throw new Error('denied');
        },
      }),
      null,
    );
    assert.doesNotThrow(() =>
      writeLastPath('/console/usage', {
        setItem: () => {
          throw new Error('denied');
        },
      }),
    );
  });
});
