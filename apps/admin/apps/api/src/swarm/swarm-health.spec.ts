import { HEALTHY_SEEDERS, SWARM_FRESH_MS, UNKNOWN_SWARM, swarmHealth } from './swarm-health';

const now = Date.parse('2026-11-17T12:00:00Z');
const sampled = (offsetMs = 0): string => new Date(now + offsetMs).toISOString();

describe('swarmHealth', () => {
  it('a fresh zero is thin: nobody serves this recitation', () => {
    expect(swarmHealth({ seeders: 0, sampledAt: sampled(), now })).toBe('thin');
  });

  it('one or two seeders is ok, not healthy', () => {
    expect(swarmHealth({ seeders: 1, sampledAt: sampled(), now })).toBe('ok');
    expect(swarmHealth({ seeders: HEALTHY_SEEDERS - 1, sampledAt: sampled(), now })).toBe('ok');
  });

  it('three seeders survive a browser closing', () => {
    expect(swarmHealth({ seeders: HEALTHY_SEEDERS, sampledAt: sampled(), now })).toBe('healthy');
  });

  it('a sample older than the window is unknown, never thin', () => {
    expect(swarmHealth({ seeders: 0, sampledAt: sampled(-SWARM_FRESH_MS), now })).toBe('thin');
    expect(swarmHealth({ seeders: 0, sampledAt: sampled(-SWARM_FRESH_MS - 1), now })).toBe('unknown');
  });

  it('a release that was never sampled is unknown', () => {
    expect(swarmHealth({ seeders: null, sampledAt: null, now })).toBe('unknown');
    expect(swarmHealth({ seeders: 0, sampledAt: null, now })).toBe('unknown');
    expect(UNKNOWN_SWARM.health).toBe('unknown');
  });

  it('an unreadable timestamp is unknown, not a guess', () => {
    expect(swarmHealth({ seeders: 5, sampledAt: 'yesterday-ish', now })).toBe('unknown');
  });
});
