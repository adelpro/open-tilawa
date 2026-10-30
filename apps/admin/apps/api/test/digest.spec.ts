import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { bootHarness, type Harness } from './harness';
import { DigestScheduler } from '../src/notifications/digest.scheduler';
import { SettingsService } from '../src/settings/settings.service';

/**
 * The daily status mail.
 *
 * It is deliberately not an alert: alerts fire on a change and stay quiet while a
 * condition holds, which means a quiet inbox cannot be told apart from a broken
 * mailer. One mail a day — green or not — is the heartbeat that makes silence
 * mean something.
 */
describe('daily status mail', () => {
  let h: Harness;
  let scheduler: DigestScheduler;
  let settings: SettingsService;

  const HOUR = new Date().getUTCHours();

  beforeAll(async () => {
    h = await bootHarness();
    scheduler = h.app.get(DigestScheduler);
    settings = h.app.get(SettingsService);
  });

  afterAll(async () => {
    await h.close();
  });

  it('sends once when the hour matches and nothing has been sent today', async () => {
    settings.setNotifyDigest({ enabled: true, hourUtc: HOUR });
    await scheduler.run();

    expect(h.mail.sent).toHaveLength(1);
    expect(h.mail.last().to).toBe(h.ownerEmail);
    expect(h.mail.last().html).toContain('Public site');
  });

  it('does not send a second time on the same day', async () => {
    await scheduler.run();
    expect(h.mail.sent).toHaveLength(1);
  });

  it('does not send outside the configured hour', async () => {
    h.db.prepare("DELETE FROM app_settings WHERE key = 'notify.digestLastSent'").run();
    settings.setNotifyDigest({ enabled: true, hourUtc: (HOUR + 1) % 24 });
    h.mail.clear();

    await scheduler.run();
    expect(h.mail.sent).toHaveLength(0);
  });

  it('does not send when it is switched off', async () => {
    h.db.prepare("DELETE FROM app_settings WHERE key = 'notify.digestLastSent'").run();
    settings.setNotifyDigest({ enabled: false, hourUtc: HOUR });
    h.mail.clear();

    await scheduler.run();
    expect(h.mail.sent).toHaveLength(0);
  });

  it('names the node that is down and says so in the subject', async () => {
    h.db.prepare("DELETE FROM app_settings WHERE key = 'notify.digestLastSent'").run();
    settings.setNotifyDigest({ enabled: true, hourUtc: HOUR });
    h.db
      .prepare(
        "INSERT INTO seeders (name, url, status, last_seen) VALUES ('node-dead', 'http://dead:8085', 'offline', NULL)",
      )
      .run();
    h.mail.clear();

    await scheduler.run();

    expect(h.mail.sent).toHaveLength(1);
    expect(h.mail.last().subject).toMatch(/degraded|down/i);
    expect(h.mail.last().html).toContain('node-dead');
  });

  it('writes the Arabic template for an Arabic admin', async () => {
    h.db.prepare("DELETE FROM app_settings WHERE key = 'notify.digestLastSent'").run();
    h.db.prepare("UPDATE users SET locale = 'ar'").run();
    h.mail.clear();

    await scheduler.run();

    expect(h.mail.sent).toHaveLength(1);
    expect(h.mail.last().html).toContain('dir="rtl"');
    expect(h.mail.last().subject).toMatch(/[\u0600-\u06FF]/);
  });

  it('records the day it sent, so a restart cannot double-send', async () => {
    const row = h.db
      .prepare("SELECT value FROM app_settings WHERE key = 'notify.digestLastSent'")
      .get() as { value: string };
    expect(row.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
