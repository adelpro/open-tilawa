import { describe, expect, test } from 'vitest';

import { isEngineRequest } from '../src/lib/messages';

/**
 * The wire between the background and its host. Getting this wrong is silent:
 * a rejected question looks like "this browser cannot measure the thing", so the
 * pause rules never fire and nothing in the UI says why.
 */
describe('isEngineRequest', () => {
  test('every engine verb reaches the host', () => {
    for (const type of [
      'engine:start',
      'engine:add',
      'engine:remove',
      'engine:snapshot',
      'engine:pause',
      'engine:resume',
      'engine:upload',
    ]) {
      expect(isEngineRequest({ type })).toBe(true);
    }
  });

  test('the device question reaches the host', () => {
    expect(isEngineRequest({ type: 'state:device' })).toBe(true);
  });

  test('a UI request is not the host\'s to answer', () => {
    for (const type of ['state:snapshot', 'state:tick', 'state:pause', 'state:start']) {
      expect(isEngineRequest({ type })).toBe(false);
    }
  });

  test('junk is not a request at all', () => {
    expect(isEngineRequest(null)).toBe(false);
    expect(isEngineRequest({})).toBe(false);
    expect(isEngineRequest({ type: 3 })).toBe(false);
    expect(isEngineRequest('engine:snapshot')).toBe(false);
  });
});
