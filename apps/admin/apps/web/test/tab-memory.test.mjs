import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readTab, writeTab } from '../src/lib/tab-memory.ts';

/**
 * The tab a screen was left on, kept per screen and per browser.
 *
 * A preference, like the fold state: no request, no account fact, and a value
 * this build no longer knows falls back to the screen's own default rather than
 * opening a panel that is not there.
 */

const storage = (value) => ({ getItem: () => value });

describe('readTab', () => {
  it('returns the remembered tab when the screen still has it', () => {
    assert.equal(readTab('settings', ['mail', 'alerts'], 'mail', storage('alerts')), 'alerts');
  });

  it('falls back when nothing was stored', () => {
    assert.equal(readTab('settings', ['mail', 'alerts'], 'mail', storage(null)), 'mail');
  });

  it('falls back when a build removed the tab', () => {
    assert.equal(readTab('settings', ['mail', 'alerts'], 'mail', storage('templates')), 'mail');
  });

  it('falls back when storage is unavailable', () => {
    assert.equal(
      readTab('settings', ['mail', 'alerts'], 'mail', {
        getItem: () => {
          throw new Error('denied');
        },
      }),
      'mail',
    );
  });
});

describe('writeTab', () => {
  it('writes one key per screen so two screens cannot overwrite each other', () => {
    const seen = [];
    const writer = { setItem: (key, value) => seen.push([key, value]) };

    writeTab('settings', 'alerts', writer);
    writeTab('account', 'password', writer);

    assert.deepEqual(seen, [
      ['tilawa.tab.settings', 'alerts'],
      ['tilawa.tab.account', 'password'],
    ]);
  });

  it('survives storage being unavailable', () => {
    assert.doesNotThrow(() =>
      writeTab('settings', 'alerts', {
        setItem: () => {
          throw new Error('denied');
        },
      }),
    );
  });
});
