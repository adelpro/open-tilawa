import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { bootHarness, type Harness } from './harness';

/**
 * The console-facing configuration surface.
 *
 * A save that cannot connect must be refused *before* it replaces a working
 * transport, and no response — success or failure — may carry the password.
 */
describe('mail settings API', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;
  let csrf = '';

  const SECRET = 'hunter2-test-secret';
  const UNREACHABLE = { host: '127.0.0.1', port: 1, tls: 'none' as const };

  beforeAll(async () => {
    process.env.MAIL_SECRET = Buffer.alloc(32, 3).toString('base64');
    h = await bootHarness();
    agent = h.agent();
    csrf = (await agent.get('/api/csrf').expect(200)).body.token as string;
    await agent
      .post('/api/auth/local/signin')
      .set('x-csrf-token', csrf)
      .set('X-Fingerprint', 'mail-a')
      .send({ user: { email: h.ownerEmail, password: 'OwnerPass123' } })
      .expect(200);
  });

  afterAll(async () => {
    delete process.env.MAIL_SECRET;
    await h.close();
  });

  it('starts unconfigured', async () => {
    const { body } = await agent.get('/api/settings/mail').expect(200);
    expect(body).toMatchObject({ host: null, hasPassword: false, source: 'none' });
  });

  it('refuses a save whose verify fails, and writes nothing', async () => {
    const { body } = await agent
      .put('/api/settings/mail')
      .set('x-csrf-token', csrf)
      .send({ ...UNREACHABLE, password: SECRET })
      .expect(400);
    expect(String(body.message)).toMatch(/SMTP verify failed/);

    const after = await agent.get('/api/settings/mail').expect(200);
    expect(after.body.host).toBeNull();
  });

  it('saves with force and reports the console as the source', async () => {
    const { body } = await agent
      .put('/api/settings/mail')
      .set('x-csrf-token', csrf)
      .send({ ...UNREACHABLE, user: 'ops', password: SECRET, force: true })
      .expect(200);

    expect(body).toMatchObject({ host: '127.0.0.1', source: 'db', hasPassword: true, verifiedAt: null });
  });

  it('never returns the password or its ciphertext', async () => {
    const { body } = await agent.get('/api/settings/mail').expect(200);
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain(SECRET);
    expect(serialised).not.toContain('v1:');
    expect(body.password).toBeUndefined();
  });

  it('keeps the stored password when the body omits it', async () => {
    const { body } = await agent
      .put('/api/settings/mail')
      .set('x-csrf-token', csrf)
      .send({ ...UNREACHABLE, user: 'ops', force: true })
      .expect(200);
    expect(body.hasPassword).toBe(true);
  });

  it('sends the test mail to the caller and nobody else', async () => {
    h.mail.clear();
    await agent.post('/api/settings/mail/test').set('x-csrf-token', csrf).expect(201);
    expect(h.mail.sent).toHaveLength(1);
    expect(h.mail.last().to).toBe(h.ownerEmail);
  });

  it('audits the change without the secret', async () => {
    const rows = h.db
      .prepare("SELECT action, after_json FROM audit_log WHERE action LIKE 'settings.mail%'")
      .all() as { action: string; after_json: string | null }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain(SECRET);
  });

  it('clears the console configuration back to the environment', async () => {
    const { body } = await agent.delete('/api/settings/mail').set('x-csrf-token', csrf).expect(200);
    expect(body).toMatchObject({ host: null, hasPassword: false, source: 'none' });
  });

  it('answers 403 for a user role', async () => {
    const id = await h.seedUser({
      name: 'Plain User',
      email: 'plain-user@example.com',
      password: 'PlainPass123',
    });
    expect(id).toBeGreaterThan(0);

    const plain = h.agent();
    const token = (await plain.get('/api/csrf').expect(200)).body.token as string;
    await plain
      .post('/api/auth/local/signin')
      .set('x-csrf-token', token)
      .set('X-Fingerprint', 'mail-plain')
      .send({ user: { email: 'plain-user@example.com', password: 'PlainPass123' } })
      .expect(200);

    await plain.get('/api/settings/mail').expect(403);
    await plain.get('/api/settings/notifications').expect(403);
    await plain
      .put('/api/settings/mail')
      .set('x-csrf-token', token)
      .send({ ...UNREACHABLE, force: true })
      .expect(403);
  });

  it('saves and reads the notification rules', async () => {
    const { body } = await agent
      .put('/api/settings/notifications')
      .set('x-csrf-token', csrf)
      .send({ enabled: ['service.down'], serviceFailures: 4, extraRecipients: ['ops@tilawah.cc'] })
      .expect(200);
    expect(body).toMatchObject({
      enabled: ['service.down'],
      serviceFailures: 4,
      extraRecipients: ['ops@tilawah.cc'],
    });

    const read = await agent.get('/api/settings/notifications').expect(200);
    expect(read.body.serviceFailures).toBe(4);
  });
});
