import { authenticator as otplibAuth } from 'otplib';
import { bootHarness } from './harness';

const owner = {
  name: 'Pending Owner',
  email: 'pending-audit@adelpro.us.kg',
  password: 'Audit-p4ss-2026',
};

describe('pending-2FA grant (audit fixes)', () => {
  let h: Awaited<ReturnType<typeof bootHarness>>;
  let agent: ReturnType<typeof h.agent>;
  let agentUntrusted: ReturnType<typeof h.agent>;

  beforeAll(async () => {
    h = await bootHarness();
    await h.seedUser(owner);
    agent = h.agent();
    agentUntrusted = h.agent();
  });
  afterAll(async () => {
    await h.close();
  });

  it('enrols from a full session then signs back in to a 430 with a minimum-grant cookie', async () => {
    // enrol: full session, request QR, verify code, trusted now
    await agent
      .set('X-Fingerprint', 'enrol-fp')
      .post('/api/auth/local/signin')
      .send({ user: owner })
      .expect(200);
    const en = await agent.get('/api/2fa/enable').expect(200);
    expect(en.body.qrcode).toContain('data:image/png');
    // The QR encodes the secret visually; tests read it from the store.
    const userRow = h.db
      .prepare('SELECT twofa_secret AS twoFASecrect FROM users WHERE email = ?')
      .get(owner.email) as { twoFASecrect: string };
    expect(userRow.twoFASecrect).toBeTruthy();

    // a correct code enrols 2FA and trusts enrol-fp
    await agent
      .set('X-Fingerprint', 'enrol-fp')
      .post('/api/2fa/verify')
      .send({ TOTP: code(userRow.twoFASecrect) })
      .expect(200);

    // sign in again from an untrusted agent: 430, and the cookie must NOT authorise
    const res = await agentUntrusted
      .set('X-Fingerprint', 'fresh-fp')
      .post('/api/auth/local/signin')
      .send({ user: owner });
    expect(res.body.message).toBe('2FA verification required');
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join('; ');
    expect(cookie).toContain('token=');

    // the pending cookie must fail on everyday guarded routes
    await agentUntrusted.set('X-Fingerprint', 'fresh-fp').get('/api/me').expect(401);
    await agentUntrusted.get('/api/2fa/enable').expect(401);
    // ...and must not reach admin routes
    await agentUntrusted.get('/api/admin/users').expect(401);

    // but it must complete the challenge
    const v = await agentUntrusted
      .set('X-Fingerprint', 'fresh-fp')
      .post('/api/2fa/verify')
      .send({ TOTP: code(userRow.twoFASecrect) })
      .expect(200);
    expect(v.body.message).toContain('trusted');
    const after = await agentUntrusted.set('X-Fingerprint', 'fresh-fp').get('/api/me').expect(200);
    expect(after.body.email).toBe(owner.email);
  });

  it('locks repeated wrong codes out', async () => {
    const en = await agent.get('/api/2fa/enable').expect(200);
    expect(en.body.qrcode).toBeTruthy();
    for (let i = 0; i < 12; i++) {
      const res = await agent.post('/api/2fa/verify').send({ TOTP: '000000' });
      if (res.status === 400) {
        expect(res.body.message).toMatch(/too many|wait 15/i);
        return;
      }
      if (res.status === 401) continue;
      throw new Error(`unexpected status ${res.status}`);
    }
    throw new Error('never locked out');
  });

  it('signs in with an emailed code once, without trusting the device', async () => {
    const devicesBefore = (
      h.db
        .prepare(
          'SELECT COUNT(*) AS n FROM trusted_devices WHERE user_id = (SELECT id FROM users WHERE email = ?)',
        )
        .get(owner.email) as { n: number }
    ).n;

    h.mail.clear();
    const emailAgent = h.agent();
    const pending = await emailAgent
      .set('X-Fingerprint', 'email-fp')
      .post('/api/auth/local/signin')
      .send({ user: owner });
    expect(pending.body.message).toBe('2FA verification required');

    const requested = await emailAgent.post('/api/2fa/email-code');
    expect(requested.status).toBe(202);
    expect(requested.body.message).not.toMatch(/sent|delivered/i);

    const mail = h.mail.last();
    const code = (mail.html.match(/>(\d{6})</) ?? [])[1];
    expect(code).toMatch(/^\d{6}$/);

    const verified = await emailAgent
      .set('X-Fingerprint', 'email-fp')
      .post('/api/2fa/email-code/verify')
      .send({ code })
      .expect(200);
    expect(verified.body.message).toContain('not added');
    await emailAgent.set('X-Fingerprint', 'email-fp').get('/api/me').expect(200);

    // Single use: the same code cannot mint a second session.
    await emailAgent
      .set('X-Fingerprint', 'email-fp')
      .post('/api/2fa/email-code/verify')
      .send({ code })
      .expect(401);

    // A mailbox buys one session, not ninety days of quiet sign-ins.
    const devicesAfter = (
      h.db
        .prepare(
          'SELECT COUNT(*) AS n FROM trusted_devices WHERE user_id = (SELECT id FROM users WHERE email = ?)',
        )
        .get(owner.email) as { n: number }
    ).n;
    expect(devicesAfter).toBe(devicesBefore);
    expect(
      (
        h.db
          .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth:2fa_email'")
          .get() as {
          n: number;
        }
      ).n,
    ).toBeGreaterThan(0);
  });

  it('says nothing and sends nothing for an account without a second factor', async () => {
    const plainEmail = 'plain@uslub.test';
    const plainPassword = 'Plain-p4ss-2026';
    const plainId = await h.seedUser({ name: 'Plain', email: plainEmail, password: plainPassword });

    const plainAgent = h.agent();
    await plainAgent
      .set('X-Fingerprint', 'plain-fp')
      .post('/api/auth/local/signin')
      .send({ user: { name: 'Plain', email: plainEmail, password: plainPassword } })
      .expect(200);

    h.mail.clear();
    const res = await plainAgent.post('/api/2fa/email-code');
    expect(res.status).toBe(202);
    expect(h.mail.sent.length).toBe(0);
    expect(
      (
        h.db.prepare('SELECT COUNT(*) AS n FROM email_otp WHERE user_id = ?').get(plainId) as {
          n: number;
        }
      ).n,
    ).toBe(0);
  });

  it('retires the code after five wrong guesses', async () => {
    h.mail.clear();
    const guesser = h.agent();
    await guesser
      .set('X-Fingerprint', 'guess-fp')
      .post('/api/auth/local/signin')
      .send({ user: owner });

    await guesser.post('/api/2fa/email-code').expect(202);
    const code = (h.mail.last().html.match(/>(\d{6})</) ?? [])[1];
    expect(code).toMatch(/^\d{6}$/);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await guesser
        .set('X-Fingerprint', 'guess-fp')
        .post('/api/2fa/email-code/verify')
        .send({ code: wrong })
        .expect(401);
    }

    // The counter, not the clock, is what retires it: the right code is now dead.
    await guesser
      .set('X-Fingerprint', 'guess-fp')
      .post('/api/2fa/email-code/verify')
      .send({ code })
      .expect(401);
  });
  it('redeems a recovery code once and regenerates the set with a password', async () => {
    const recoveryOwner = {
      name: 'Recovery Owner',
      email: 'recovery-owner@uslub.test',
      password: 'Recovery-p4ss-2026',
    };
    await h.seedUser(recoveryOwner);

    // Enrol two-factor on a fresh account and capture the one-time codes.
    const enrolAgent = h.agent();
    await enrolAgent
      .set('X-Fingerprint', 'recovery-enrol-fp')
      .post('/api/auth/local/signin')
      .send({ user: recoveryOwner })
      .expect(200);
    await enrolAgent.get('/api/2fa/enable').expect(200);
    const enrolledUser = h.db
      .prepare('SELECT twofa_secret AS twoFASecrect FROM users WHERE email = ?')
      .get(recoveryOwner.email) as { twoFASecrect: string };
    const enrolRes = await enrolAgent
      .set('X-Fingerprint', 'recovery-enrol-fp')
      .post('/api/2fa/verify')
      .send({ TOTP: code(enrolledUser.twoFASecrect) })
      .expect(200);
    const codes = enrolRes.body.recoveryCodes as string[];
    expect(Array.isArray(codes)).toBe(true);
    expect(codes).toHaveLength(10);

    // A pending (password-presented) session can redeem one code.
    const redeemer = h.agent();
    const pending = await redeemer
      .set('X-Fingerprint', 'recovery-redeem-fp')
      .post('/api/auth/local/signin')
      .send({ user: recoveryOwner });
    expect(pending.body.message).toBe('2FA verification required');

    const first = codes[0];
    const redeemed = await redeemer
      .set('X-Fingerprint', 'recovery-redeem-fp')
      .post('/api/2fa/recovery')
      .send({ code: first })
      .expect(200);
    expect(redeemed.body.message).toContain('recovery code');
    await redeemer.set('X-Fingerprint', 'recovery-redeem-fp').get('/api/me').expect(200);

    // Single use.
    await redeemer
      .set('X-Fingerprint', 'recovery-redeem-fp')
      .post('/api/2fa/recovery')
      .send({ code: first })
      .expect(401);

    // Regeneration requires a current authenticator code and invalidates the old set.
    const regenerated = await enrolAgent
      .post('/api/2fa/recovery/regenerate')
      .send({ code: code(enrolledUser.twoFASecrect) })
      .expect(200);
    expect(regenerated.body.codes).toHaveLength(10);
    expect(regenerated.body.codes).not.toContain(first);

    // An old code is dead after regeneration.
    const pending2 = await h
      .agent()
      .set('X-Fingerprint', 'recovery-redeem2-fp')
      .post('/api/auth/local/signin')
      .send({ user: recoveryOwner });
    expect(pending2.body.message).toBe('2FA verification required');
    await h
      .agent()
      .set('X-Fingerprint', 'recovery-redeem2-fp')
      .post('/api/2fa/recovery')
      .send({ code: first })
      .expect(401);
  });
});

/** A deterministic TOTP with a known secret; the harness clock is real. */
function code(secret: string): string {
  return otplibAuth.generate(secret);
}
