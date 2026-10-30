import { describe, expect, it } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { AuditRepository, openDatabase } from '@tilawa-admin/core';
import { SeedersService } from '../src/seeders/seeders.service';
import { TelemetryService } from '../src/telemetry/telemetry.service';

/**
 * Update state has to outlive the process that observed it.
 *
 * The failure that motivated this: an update failed, the alert fired, the
 * container was recreated, and the next pass saw `updateError: null` from a fresh
 * in-memory map — so it mailed "update recovered" about a node nobody had fixed.
 */
describe('seeder update state', () => {
  function build() {
    const db = openDatabase(':memory:');
    const service = new SeedersService(
      db,
      new ConfigService({}),
      new AuditRepository(db),
      new TelemetryService(db),
    );
    return { db, service };
  }

  it('reports the last update error from the row, not from memory', () => {
    const { db, service } = build();
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO seeders (name, url, last_update_error, last_update_running) VALUES ('n', 'http://n:1', 'build exited 1', 0)",
      )
      .run();
    expect(Number(lastInsertRowid)).toBeGreaterThan(0);

    const row = service.list()[0];
    expect(row.updateError).toBe('build exited 1');
    expect(row.updating).toBe(false);
  });

  it('survives a restart: a second instance reads the same error', () => {
    const { db, service } = build();
    db.prepare(
      "INSERT INTO seeders (name, url, last_update_error) VALUES ('n', 'http://n:1', 'compose upstream')",
    ).run();
    expect(service.list()).toHaveLength(1);

    const restarted = new SeedersService(
      db,
      new ConfigService({}),
      new AuditRepository(db),
      new TelemetryService(db),
    );
    expect(restarted.list()[0].updateError).toBe('compose upstream');
  });

  it('clears a stale "running" flag on boot', () => {
    const { db } = build();
    db.prepare(
      "INSERT INTO seeders (name, url, last_update_running) VALUES ('n', 'http://n:1', 1)",
    ).run();

    const restarted = new SeedersService(
      db,
      new ConfigService({}),
      new AuditRepository(db),
      new TelemetryService(db),
    );
    expect(restarted.list()[0].updating).toBe(false);
  });
});
