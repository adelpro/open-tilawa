import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LAST_AUTH_KEY,
  isAuthMethod,
  readLastAuth,
  rememberAuthFromUrl,
  writeLastAuth,
} from '../src/lib/last-auth.ts';

const reader = (value) => ({ getItem: () => value });

function recorder() {
  const writes = [];
  const calls = [];
  return {
    storage: {
      setItem: (key, value) => writes.push([key, value]),
    },
    history: {
      replaceState: (_state, _title, url) => calls.push(url),
    },
    writes,
    calls,
  };
}

describe('last used sign-in method', () => {
  it('reads only the three methods it knows', () => {
    assert.equal(readLastAuth(reader('google')), 'google');
    assert.equal(readLastAuth(reader('local')), 'local');
    assert.equal(readLastAuth(reader('github')), 'github');
    assert.equal(readLastAuth(reader('facebook')), null);
    assert.equal(readLastAuth(reader('')), null);
    assert.equal(readLastAuth(reader(null)), null);
  });

  it('writes the method under one key', () => {
    const { storage, writes } = recorder();
    writeLastAuth('google', storage);
    assert.deepEqual(writes, [[LAST_AUTH_KEY, 'google']]);
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    assert.equal(readLastAuth(broken), null);
    assert.doesNotThrow(() => writeLastAuth('google', broken));
  });

  it('records a provider from the callback URL and removes the parameter', () => {
    const { storage, history, writes, calls } = recorder();
    const method = rememberAuthFromUrl(
      'http://localhost:9400/console?auth=google&x=1',
      history,
      storage,
    );

    assert.equal(method, 'google');
    assert.deepEqual(writes, [[LAST_AUTH_KEY, 'google']]);
    assert.deepEqual(calls, ['/console?x=1']);
  });

  it('strips an unknown auth value without remembering it', () => {
    const { storage, history, writes, calls } = recorder();
    const method = rememberAuthFromUrl('/signin?auth=facebook', history, storage);

    assert.equal(method, null);
    assert.equal(writes.length, 0);
    assert.deepEqual(calls, ['/signin']);
  });

  it('does nothing when the URL has no auth parameter', () => {
    const { storage, history, writes, calls } = recorder();
    assert.equal(rememberAuthFromUrl('/console?x=1', history, storage), null);
    assert.equal(writes.length, 0);
    assert.equal(calls.length, 0);
  });

  it('keeps the hash and the other parameters', () => {
    const { storage, history, calls } = recorder();
    rememberAuthFromUrl('/2fa?auth=github&next=%2Fconsole#top', history, storage);
    assert.deepEqual(calls, ['/2fa?next=%2Fconsole#top']);
  });

  it('rejects values that are not one of the three methods', () => {
    assert.equal(isAuthMethod('google'), true);
    assert.equal(isAuthMethod('GOOGLE'), false);
    assert.equal(isAuthMethod(undefined), false);
  });
});
