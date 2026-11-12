import { describe, expect, it } from '@jest/globals';
import { probeReason } from '../src/status/status.service';

function timeoutError(): Error {
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  return error;
}

describe('probeReason', () => {
  it('names a timeout in seconds', () => {
    expect(probeReason(timeoutError(), 8_000)).toBe('no answer within 8s');
  });

  it('unwraps fetch failed to the socket error', () => {
    const cause = new Error('connect ECONNREFUSED 127.0.0.1:9410');
    const wrapped = new TypeError('fetch failed', { cause });
    expect(probeReason(wrapped)).toBe('connect ECONNREFUSED 127.0.0.1:9410');
  });

  it('finds a timeout behind a fetch failure', () => {
    const wrapped = new TypeError('fetch failed', { cause: timeoutError() });
    expect(probeReason(wrapped, 8_000)).toBe('no answer within 8s');
  });

  it('keeps a plain error message', () => {
    expect(probeReason(new Error('health answered 503'))).toBe('health answered 503');
  });

  it('falls back to the name, then to a fixed string', () => {
    expect(probeReason(new Error(''))).toBe('Error');
    expect(probeReason('boom')).toBe('unknown error');
  });
});
