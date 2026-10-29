import { describe, expect, it } from '@jest/globals';
import { evaluate } from '../src/notifications/notifications.rules';
import type { Observation } from '../src/notifications/notifications.rules';

const NOW = new Date('2026-10-29T12:00:00.000Z');
const GiB = 1024 ** 3;

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    now: NOW,
    services: [],
    seeders: [],
    open: [],
    settings: {
      enabled: ['service.down', 'seeder.offline', 'seeder.disk', 'seeder.update_failed'],
      serviceFailures: 3,
      diskFloorBytes: 20 * GiB,
    },
    ...overrides,
  };
}

const service = (passed: boolean[]) => ({ id: 1, name: 'Tracker', passed });
const seeder = (overrides: Partial<Observation['seeders'][number]> = {}) => ({
  id: 7,
  name: 'node-1',
  status: 'online' as const,
  lastSeen: '2026-10-29T11:59:00.000Z',
  headroomBytes: 50 * GiB,
  updateError: null,
  ...overrides,
});

describe('evaluate', () => {
  it('opens service.down on the third consecutive failure, not the second', () => {
    expect(evaluate(observation({ services: [service([false, false])] }))).toEqual([]);
    const events = evaluate(observation({ services: [service([false, false, false])] }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'open', kind: 'service.down', subject: 'service:1' });
  });

  it('does not re-open while the alert is open', () => {
    expect(
      evaluate(
        observation({
          services: [service([false, false, false, false, false])],
          open: [{ kind: 'service.down', subject: 'service:1' }],
        }),
      ),
    ).toEqual([]);
  });

  it('resolves after two consecutive passes, not one', () => {
    expect(
      evaluate(
        observation({
          services: [service([true, false, false])],
          open: [{ kind: 'service.down', subject: 'service:1' }],
        }),
      ),
    ).toEqual([]);

    const events = evaluate(
      observation({
        services: [service([true, true, false])],
        open: [{ kind: 'service.down', subject: 'service:1' }],
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'resolve', kind: 'service.down' });
  });

  it('does not resolve something that was never open', () => {
    expect(evaluate(observation({ services: [service([true, true, true])] }))).toEqual([]);
  });

  it('ignores a kind that is not enabled', () => {
    expect(
      evaluate(
        observation({
          services: [service([false, false, false, false, false])],
          settings: { enabled: ['seeder.disk'], serviceFailures: 3, diskFloorBytes: 20 * GiB },
        }),
      ),
    ).toEqual([]);
  });

  it('opens seeder.offline only after fifteen minutes, and when lastSeen is null', () => {
    const recent = seeder({ status: 'offline', lastSeen: '2026-10-29T11:55:00.000Z' });
    expect(evaluate(observation({ seeders: [recent] }))).toEqual([]);

    const stale = seeder({ status: 'offline', lastSeen: '2026-10-29T11:40:00.000Z' });
    const events = evaluate(observation({ seeders: [stale] }));
    expect(events[0]).toMatchObject({
      action: 'open',
      kind: 'seeder.offline',
      subject: 'seeder:7',
    });

    const never = seeder({ status: 'offline', lastSeen: null });
    expect(evaluate(observation({ seeders: [never] }))[0]).toMatchObject({ action: 'open' });
  });

  it('resolves seeder.offline when a poll reports online', () => {
    const events = evaluate(
      observation({
        seeders: [seeder({ status: 'online' })],
        open: [{ kind: 'seeder.offline', subject: 'seeder:7' }],
      }),
    );
    expect(events[0]).toMatchObject({ action: 'resolve', kind: 'seeder.offline' });
  });

  it('applies disk hysteresis', () => {
    const low = seeder({ headroomBytes: 19 * GiB });
    expect(evaluate(observation({ seeders: [low] }))[0]).toMatchObject({
      action: 'open',
      kind: 'seeder.disk',
    });

    // Between the floor and floor * 1.1: holding is the point of hysteresis.
    const between = seeder({ headroomBytes: 21 * GiB });
    expect(
      evaluate(
        observation({ seeders: [between], open: [{ kind: 'seeder.disk', subject: 'seeder:7' }] }),
      ),
    ).toEqual([]);

    const recovered = seeder({ headroomBytes: 23 * GiB });
    expect(
      evaluate(
        observation({ seeders: [recovered], open: [{ kind: 'seeder.disk', subject: 'seeder:7' }] }),
      )[0],
    ).toMatchObject({ action: 'resolve', kind: 'seeder.disk' });
  });

  it('tracks update failure in both directions', () => {
    const failed = seeder({ updateError: 'build exited 1' });
    expect(evaluate(observation({ seeders: [failed] }))[0]).toMatchObject({
      action: 'open',
      kind: 'seeder.update_failed',
    });

    const clean = seeder({ updateError: null });
    expect(
      evaluate(
        observation({
          seeders: [clean],
          open: [{ kind: 'seeder.update_failed', subject: 'seeder:7' }],
        }),
      )[0],
    ).toMatchObject({ action: 'resolve', kind: 'seeder.update_failed' });
  });

  it('orders events by kind and then subject, so a log reads the same twice', () => {
    const events = evaluate(
      observation({
        services: [service([false, false, false])],
        seeders: [
          seeder({ status: 'offline', lastSeen: null }),
          { ...seeder({ id: 8 }), name: 'node-2', status: 'offline', lastSeen: null },
        ],
      }),
    );
    expect(events.map((event) => `${event.kind}:${event.subject}`)).toEqual([
      'seeder.offline:seeder:7',
      'seeder.offline:seeder:8',
      'service.down:service:1',
    ]);
  });
});
