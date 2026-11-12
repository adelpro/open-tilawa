import { describe, expect, it } from '@jest/globals';
import { openDatabase } from '@tilawa-admin/core';
import { StatusService } from '../src/status/status.service';

function build(): { db: ReturnType<typeof openDatabase>; status: StatusService } {
  const db = openDatabase(':memory:');
  return { db, status: new StatusService(db) };
}

describe('StatusService.recentChecks', () => {
  it('returns the newest checks first, capped at the limit', () => {
    const { db, status } = build();
    const service = status.list()[0];
    const insert = db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, ?)');
    insert.run(service.id, 0);
    insert.run(service.id, 0);
    insert.run(service.id, 1);

    const history = status.recentChecks(3);

    expect(history[0]).toMatchObject({ id: service.id, name: service.name });
    expect(history[0].passed).toEqual([true, false, false]);
  });

  it('caps the history at the requested length', () => {
    const { db, status } = build();
    const service = status.list()[0];
    const insert = db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, ?)');
    insert.run(service.id, 0);
    insert.run(service.id, 0);
    insert.run(service.id, 1);

    expect(status.recentChecks(2)[0].passed).toEqual([true, false]);
  });

  it('skips disabled services', () => {
    const { db, status } = build();
    db.prepare('UPDATE services SET enabled = 0').run();
    expect(status.recentChecks(5)).toEqual([]);
  });

  it('returns an empty history for a service nobody has checked', () => {
    const { status } = build();
    expect(status.recentChecks(3).every((entry) => entry.passed.length === 0)).toBe(true);
  });

  it('carries the newest check detail as the reason', () => {
    const { db, status } = build();
    const service = status.list()[0];
    db.prepare('INSERT INTO service_checks (service_id, ok, detail) VALUES (?, 0, ?)').run(
      service.id,
      '503 Service Unavailable',
    );
    expect(status.recentChecks(3)[0].reason).toBe('503 Service Unavailable');
  });

  it('has no reason before the first check', () => {
    const { status } = build();
    expect(status.recentChecks(3)[0].reason).toBeNull();
  });

  it('returns one service history, newest first, capped', () => {
    const { db, status } = build();
    const service = status.list()[0];
    const insert = db.prepare(
      'INSERT INTO service_checks (service_id, ok, latency_ms, detail) VALUES (?, ?, ?, ?)',
    );
    insert.run(service.id, 0, null, '503 Service Unavailable');
    insert.run(service.id, 1, 42, '200');

    const rows = status.history(service.id, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ok: true, latencyMs: 42, detail: '200' });
  });

  it('normalises a bad limit instead of handing SQLite a datatype error', () => {
    const { db, status } = build();
    const service = status.list()[0];
    db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, 1)').run(service.id);

    expect(status.history(service.id, Number.NaN)).toHaveLength(1);
    expect(() => status.history(service.id, 2.5)).not.toThrow();
    expect(status.history(service.id, 0)).toHaveLength(1);
  });
});
