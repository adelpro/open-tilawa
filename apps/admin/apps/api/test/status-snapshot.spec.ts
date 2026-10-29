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
});
