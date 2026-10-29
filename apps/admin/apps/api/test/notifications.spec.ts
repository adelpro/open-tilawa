import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { bootHarness, type Harness } from './harness';
import { AlertsService } from '../src/notifications/alerts.service';
import { NotificationsScheduler } from '../src/notifications/notifications.scheduler';

/**
 * Alerts end to end: the scheduler reads what the pollers wrote, `AlertsService`
 * persists the transition, and the mail goes out through the harness recorder.
 *
 * Thresholds are the defaults (three failures, 20 GiB), because the defaults are
 * what an operator who never opens the settings screen gets.
 */
describe('operator alerts', () => {
  let h: Harness;
  let alerts: AlertsService;
  let scheduler: NotificationsScheduler;
  let serviceId: number;

  function fail(times: number): void {
    const insert = h.db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, 0)');
    for (let index = 0; index < times; index += 1) insert.run(serviceId);
  }

  function pass(times: number): void {
    const insert = h.db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, 1)');
    for (let index = 0; index < times; index += 1) insert.run(serviceId);
  }

  beforeAll(async () => {
    h = await bootHarness();
    alerts = h.app.get(AlertsService);
    scheduler = h.app.get(NotificationsScheduler);
    const services = h.db.prepare('SELECT id FROM services ORDER BY id').all() as { id: number }[];
    serviceId = services[0].id;
  });

  afterAll(async () => {
    await h.close();
  });

  it('mails once when a service goes down, and stays quiet on the next pass', async () => {
    fail(3);
    await scheduler.run();
    expect(h.mail.sent).toHaveLength(1);
    expect(h.mail.last().to).toBe(h.ownerEmail);
    expect(h.mail.last().subject).toMatch(/Service down/);

    await scheduler.run();
    expect(h.mail.sent).toHaveLength(1);
  });

  it('mails again when the service recovers', async () => {
    // Older than the ten-minute damping window, so the mail is not suppressed.
    h.db
      .prepare(
        "UPDATE alerts SET opened_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 minutes') WHERE state = 'open'",
      )
      .run();
    pass(2);
    await scheduler.run();
    expect(h.mail.sent.map((mail) => mail.subject)).toEqual([
      expect.stringMatching(/Service down/),
      expect.stringMatching(/Service recovered/),
    ]);
  });

  it('suppresses the resolve mail when the alert was open under ten minutes', async () => {
    const other = (h.db.prepare('SELECT id FROM services ORDER BY id').all() as { id: number }[])[1]
      .id;
    const insertFail = h.db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, 0)');
    const insertPass = h.db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, 1)');
    for (let index = 0; index < 3; index += 1) insertFail.run(other);
    await scheduler.run();
    const before = h.mail.sent.length;

    // Backdate the open alert so the damping threshold is what decides, not the clock.
    h.db
      .prepare(
        "UPDATE alerts SET opened_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 minutes') WHERE subject = ? AND state = 'open'",
      )
      .run(`service:${other}`);
    insertPass.run(other);
    insertPass.run(other);
    await scheduler.run();

    expect(h.mail.sent.map((mail) => mail.subject)).toHaveLength(before);
  });

  it('writes the alert even with no recipients, and does not throw', async () => {
    h.db.prepare("UPDATE users SET status = 'disabled'").run();
    const other = (h.db.prepare('SELECT id FROM services ORDER BY id').all() as { id: number }[])[2]
      .id;
    const insertFail = h.db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, 0)');
    for (let index = 0; index < 3; index += 1) insertFail.run(other);
    const before = h.mail.sent.length;

    await expect(scheduler.run()).resolves.toBeUndefined();
    expect(h.mail.sent).toHaveLength(before);
    const row = alerts.recent(50).find((entry) => entry.subject === `service:${other}`);
    expect(row?.state).toBe('open');
  });

  it('mails one resolve when two passes race', async () => {
    h.db.prepare("UPDATE users SET status = 'active', locale = 'en'").run();
    const target = (
      h.db.prepare('SELECT id FROM services ORDER BY id').all() as { id: number }[]
    )[3].id;
    const insertFail = h.db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, 0)');
    const insertPass = h.db.prepare('INSERT INTO service_checks (service_id, ok) VALUES (?, 1)');
    for (let index = 0; index < 3; index += 1) insertFail.run(target);
    await scheduler.run();
    h.db
      .prepare(
        "UPDATE alerts SET opened_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 minutes') WHERE subject = ?",
      )
      .run(`service:${target}`);
    insertPass.run(target);
    insertPass.run(target);

    h.mail.clear();
    await Promise.all([scheduler.run(), scheduler.run()]);
    const resolved = h.mail.sent.filter((mail) => mail.subject.includes('recovered'));
    expect(resolved).toHaveLength(1);
  });

  it('delivers an alert whose first attempt never happened', async () => {
    h.db.prepare("UPDATE users SET status = 'active', locale = 'en'").run();
    h.mail.clear();
    h.db
      .prepare(
        `INSERT INTO alerts (kind, subject, title, detail, name, params, opened_at)
         VALUES ('seeder.disk','seeder:abandoned','Disk low: abandoned',NULL,'abandoned',?, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 minutes'))`,
      )
      .run(JSON.stringify({ headroomBytes: 1024 ** 3 }));

    await alerts.apply([]);

    expect(h.mail.sent).toHaveLength(1);
    const row = alerts.recent(50).find((entry) => entry.subject === 'seeder:abandoned');
    expect(row?.notifiedAt).not.toBeNull();
  });

  it('absorbs a duplicate open instead of throwing', async () => {
    const event = {
      action: 'open' as const,
      kind: 'seeder.disk' as const,
      subject: 'seeder:slice',
      name: 'slice',
      title: 'Disk low: slice',
      detail: null,
    };
    await alerts.apply([event]);
    await expect(alerts.apply([event])).resolves.toBeUndefined();
    expect(alerts.recent(50).filter((entry) => entry.subject === 'seeder:slice')).toHaveLength(1);
  });

  it('escapes HTML in the detail', async () => {
    h.db.prepare("UPDATE users SET status = 'active'").run();
    h.mail.clear();
    await alerts.apply([
      {
        action: 'open',
        kind: 'seeder.update_failed',
        subject: 'seeder:escape',
        name: 'escape',
        title: 'Update failed: escape',
        detail: '<img src=x onerror=alert(1)>',
      },
    ]);

    expect(h.mail.sent).toHaveLength(1);
    expect(h.mail.last().html).toContain('&lt;img');
    expect(h.mail.last().html).not.toContain('<img');
  });

  it('sends the Arabic template to an Arabic admin', async () => {
    h.db.prepare("UPDATE users SET locale = 'ar'").run();
    h.mail.clear();
    await alerts.apply([
      {
        action: 'open',
        kind: 'seeder.offline',
        subject: 'seeder:ar',
        name: 'test',
        title: 'Node offline: test',
        detail: null,
      },
    ]);

    expect(h.mail.sent).toHaveLength(1);
    expect(h.mail.last().subject).toMatch(/[\u0600-\u06FF]/);
    expect(h.mail.last().html).toContain('dir="rtl"');
  });
});
