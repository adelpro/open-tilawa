import { shouldAutoUpdate, AUTO_UPDATE_RETRY_MS } from '../src/seeders/auto-update';

/**
 * The unattended path, where the console restarts a machine nobody is watching.
 *
 * Every case here is a reason *not* to act: the default is off, and the rest is
 * about not turning a broken node into a rebuild loop.
 */
const base = {
  autoUpdate: true,
  capable: true,
  status: 'online' as const,
  version: '1.5.1',
  desiredVersion: '1.5.2',
  updating: false,
  lastAttemptAt: null,
  now: Date.parse('2026-10-31T10:00:00.000Z'),
};

describe('shouldAutoUpdate', () => {
  it('asks a node that opted in, can update, and is behind', () => {
    expect(shouldAutoUpdate(base)).toBe(true);
  });

  it('does nothing when the switch is off — the default for every node', () => {
    expect(shouldAutoUpdate({ ...base, autoUpdate: false })).toBe(false);
  });

  it('does nothing for a node that never accepted updates from the console', () => {
    expect(shouldAutoUpdate({ ...base, capable: false })).toBe(false);
  });

  it('does nothing to a node it cannot see', () => {
    for (const status of ['offline', 'unknown']) {
      expect(shouldAutoUpdate({ ...base, status })).toBe(false);
    }
  });

  it('never overlaps an update that is already running', () => {
    expect(shouldAutoUpdate({ ...base, updating: true })).toBe(false);
  });

  it('does nothing when the node already runs the target', () => {
    expect(shouldAutoUpdate({ ...base, version: '1.5.2' })).toBe(false);
  });

  it('does nothing when either version is unknown: "not equal" is not "behind"', () => {
    expect(shouldAutoUpdate({ ...base, version: null })).toBe(false);
    expect(shouldAutoUpdate({ ...base, desiredVersion: null })).toBe(false);
  });

  it('waits out the retry window after an attempt', () => {
    const lastAttemptAt = new Date(base.now - 60_000).toISOString();
    expect(shouldAutoUpdate({ ...base, lastAttemptAt })).toBe(false);
    const old = new Date(base.now - AUTO_UPDATE_RETRY_MS - 1000).toISOString();
    expect(shouldAutoUpdate({ ...base, lastAttemptAt: old })).toBe(true);
  });

  it('refuses to guess when the stored timestamp cannot be read', () => {
    expect(shouldAutoUpdate({ ...base, lastAttemptAt: 'not a date' })).toBe(false);
  });
});
