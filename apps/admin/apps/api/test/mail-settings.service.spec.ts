import { BadRequestException } from '@nestjs/common';
import { openDatabase } from '@tilawa-admin/core';
import type { Db } from '@tilawa-admin/core';
import { SettingsService } from '../src/settings/settings.service';
import { encryptSecret } from '../src/settings/mail-secret';

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);

function build(): { db: Db; settings: SettingsService } {
  const db = openDatabase(':memory:');
  return { db, settings: new SettingsService(db) };
}

beforeEach(() => {
  process.env.MAIL_SECRET = KEY.toString('base64');
});

afterAll(() => {
  delete process.env.MAIL_SECRET;
});

describe('mail settings', () => {
  it('round-trips the transport fields', () => {
    const { settings } = build();
    settings.setMailConfig({
      host: 'smtp.fastmail.com',
      port: 465,
      tls: 'ssl',
      user: 'ops@tilawah.cc',
      from: 'Tilawa <ops@tilawah.cc>',
    });
    const config = settings.getMailConfig();
    expect(config).toMatchObject({
      host: 'smtp.fastmail.com',
      port: 465,
      tls: 'ssl',
      user: 'ops@tilawah.cc',
      from: 'Tilawa <ops@tilawah.cc>',
      hasPassword: false,
      password: null,
      verifiedAt: null,
    });
  });

  it('starts unconfigured rather than throwing', () => {
    const { settings } = build();
    expect(settings.getMailConfig()).toMatchObject({ host: null, hasPassword: false });
  });

  it('encrypts the password and never stores it in clear', () => {
    const { db, settings } = build();
    settings.setMailConfig({
      host: 'smtp.example.com',
      port: 587,
      tls: 'starttls',
      password: 'hunter2',
    });

    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'mail.pass'").get() as {
      value: string;
    };
    expect(row.value.startsWith('v1:')).toBe(true);
    expect(row.value).not.toContain('hunter2');
    expect(settings.getMailConfig().password).toBe('hunter2');
    expect(settings.getMailConfig().hasPassword).toBe(true);
  });

  it('keeps the stored password when password is undefined, clears on null', () => {
    const { settings } = build();
    const base = { host: 'smtp.example.com', port: 587, tls: 'starttls' as const };

    settings.setMailConfig({ ...base, password: 'first' });
    expect(settings.getMailConfig().hasPassword).toBe(true);

    settings.setMailConfig(base);
    expect(settings.getMailConfig().hasPassword).toBe(true);
    expect(settings.getMailConfig().password).toBe('first');

    settings.setMailConfig({ ...base, password: null });
    expect(settings.getMailConfig().hasPassword).toBe(false);
    expect(settings.getMailConfig().password).toBeNull();
  });

  it('treats an empty-string password as keep, not clear', () => {
    const { settings } = build();
    const base = { host: 'smtp.example.com', port: 587, tls: 'starttls' as const };
    settings.setMailConfig({ ...base, password: 'hunter2' });
    settings.setMailConfig({ ...base, password: '' });
    expect(settings.getMailConfig().hasPassword).toBe(true);
    expect(settings.getMailConfig().password).toBe('hunter2');
  });

  it('refuses a password with no MAIL_SECRET, naming the variable', () => {
    const { db, settings } = build();
    delete process.env.MAIL_SECRET;
    expect(() =>
      settings.setMailConfig({
        host: 'smtp.example.com',
        port: 587,
        tls: 'starttls',
        password: 'x',
      }),
    ).toThrow(/MAIL_SECRET/);
    expect(() =>
      settings.setMailConfig({
        host: 'smtp.example.com',
        port: 587,
        tls: 'starttls',
        password: 'x',
      }),
    ).toThrow(BadRequestException);
    const rows = db.prepare("SELECT value FROM app_settings WHERE key LIKE 'mail.%'").all();
    expect(rows).toHaveLength(0);
  });

  it('reports password null instead of throwing when the key was rotated', () => {
    const { settings } = build();
    settings.setMailConfig({
      host: 'smtp.example.com',
      port: 587,
      tls: 'starttls',
      password: 'hunter2',
    });

    process.env.MAIL_SECRET = OTHER_KEY.toString('base64');
    const config = settings.getMailConfig();
    expect(config.password).toBeNull();
    expect(config.hasPassword).toBe(true);
  });

  it('rejects an out-of-range port and an unknown tls mode', () => {
    const { settings } = build();
    expect(() => settings.setMailConfig({ host: 'h', port: 70000, tls: 'ssl' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      settings.setMailConfig({ host: 'h', port: 587, tls: 'ssl3' as unknown as 'ssl' }),
    ).toThrow(BadRequestException);
  });

  it('requires a host', () => {
    const { settings } = build();
    expect(() => settings.setMailConfig({ host: '  ', port: 587, tls: 'starttls' })).toThrow(
      BadRequestException,
    );
  });
});

describe('notification settings', () => {
  it('returns the defaults', () => {
    const { settings } = build();
    expect(settings.getNotifySettings()).toEqual({
      enabled: ['service.down', 'seeder.offline', 'seeder.disk', 'seeder.update_failed'],
      serviceFailures: 3,
      diskFloorBytes: 21_474_836_480,
      extraRecipients: [],
    });
  });

  it('round-trips overrides and dedupes recipients', () => {
    const { settings } = build();
    const saved = settings.setNotifySettings({
      enabled: ['service.down'],
      serviceFailures: 5,
      diskFloorBytes: 1024,
      extraRecipients: [' a@b.c ', 'a@b.c', 'ops@tilawah.cc'],
    });
    expect(saved).toEqual({
      enabled: ['service.down'],
      serviceFailures: 5,
      diskFloorBytes: 1024,
      extraRecipients: ['a@b.c', 'ops@tilawah.cc'],
    });
    expect(settings.getNotifySettings()).toEqual(saved);
  });

  it('rejects an unknown kind', () => {
    const { settings } = build();
    expect(() =>
      settings.setNotifySettings({ enabled: ['nope' as unknown as 'service.down'] }),
    ).toThrow(BadRequestException);
  });
});

describe('mail secret format', () => {
  it('produces a versioned, non-deterministic ciphertext', () => {
    const first = encryptSecret('same', KEY);
    const second = encryptSecret('same', KEY);
    expect(first).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(first).not.toBe(second);
  });
});
