import { bootHarness, tokenFromMail, type Harness } from './harness';
import { authenticator } from 'otplib';

/**
 * The P5 exit criteria, driven over HTTP against a throwaway database:
 * signup → activation mail → activate → signin → 2FA enrol → signout → signin on
 * the same device without a code → a new device challenged with 430 → reset
 * password end-to-end. Nothing here reaches into a service to assert; every
 * assertion is a response a client would see.
 */
describe('account lifecycle', () => {
  let h: Harness;
  const credentials = { name: 'Nadia', email: 'nadia@example.com', password: 'Password123' };

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  it('creates an inactive account, mails the link and sets no session', async () => {
    const res = await h
      .agent()
      .post('/api/auth/local/signup')
      .send({ user: credentials })
      .expect(201);

    expect(res.body.email).toBe(credentials.email);
    expect(res.body.isActivated).toBe(false);
    expect(res.headers['set-cookie']).toBeUndefined();

    const mail = h.mail.last();
    expect(mail.to).toBe(credentials.email);
    expect(mail.subject).toContain('Activate');
    expect(tokenFromMail(mail)).toMatch(/\./);

    const row = h.users.getByEmail(credentials.email);
    expect(row?.isActivated).toBe(false);
  });

  it('refuses the same address twice', async () => {
    await h.agent().post('/api/auth/local/signup').send({ user: credentials }).expect(400);
  });

  it('refuses sign-in before activation, and starts no session', async () => {
    const agent = h.agent();
    const res = await agent
      .post('/api/auth/local/signin')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(403);
    expect(res.body.message).toContain('not activated');
    expect(res.headers['set-cookie']).toBeUndefined();

    await agent.get('/api/me').expect(401);
  });

  it('activates with the emailed token and opens a session', async () => {
    const token = tokenFromMail(h.mail.last());
    const agent = h.agent();
    const res = await agent
      .post('/api/auth/local/activate')
      .set('X-Fingerprint', 'device-a')
      .send({ token })
      .expect(200);

    expect(res.body.isActivated).toBe(true);
    expect(res.headers['set-cookie']?.[0]).toContain('token=');

    const me = await agent.set('X-Fingerprint', 'device-a').get('/api/me').expect(200);
    expect(me.body.email).toBe(credentials.email);
    expect(me.body.isActivated).toBe(true);
  });

  it('answers the same 401 for a wrong password and an unknown address', async () => {
    const wrongPassword = await h
      .agent()
      .post('/api/auth/local/signin')
      .send({ user: { email: credentials.email, password: 'WrongPassword1' } })
      .expect(401);

    const unknown = await h
      .agent()
      .post('/api/auth/local/signin')
      .send({ user: { email: 'nobody@example.com', password: 'WrongPassword1' } })
      .expect(401);

    expect(wrongPassword.body.message).toBe(unknown.body.message);
    expect(wrongPassword.body.message).toBe('Invalid email or password');
  });

  it('signs in on a fresh device', async () => {
    const res = await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-b')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(200);
    expect(res.body.isTwoFAEnabled).toBe(false);
  });

  it('enrols 2FA and trusts the device that enrolled', async () => {
    const agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-a')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(200);

    const enable = await agent.set('X-Fingerprint', 'device-a').get('/api/2fa/enable').expect(200);
    expect(enable.body.qrcode).toContain('data:image/png');

    const user = h.users.getByEmail(credentials.email);
    expect(user?.twoFASecrect).toBeTruthy();

    authenticator.options = { window: 15 };
    const code = authenticator.generate(user?.twoFASecrect as string);

    await agent
      .post('/api/2fa/verify')
      .set('X-Fingerprint', 'device-a')
      .send({ TOTP: code })
      .expect(200);

    const me = await agent.set('X-Fingerprint', 'device-a').get('/api/me').expect(200);
    expect(me.body.isTwoFAEnabled).toBe(true);
    expect(me.body.isDeviceTrusted).toBe(true);
  });

  it('re-signs in on the trusted device without a code', async () => {
    const agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-a')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(200);
  });

  it('challenges an untrusted device with 430', async () => {
    const agent = h.agent();
    const res = await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-new')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(430);

    expect(res.body.message).toContain('2FA');
    // The cookie is set on the 430 so the client can post the code that trusts it.
    expect(res.headers['set-cookie']?.[0]).toContain('token=');

    const user = h.users.getByEmail(credentials.email);
    authenticator.options = { window: 15 };
    const code = authenticator.generate(user?.twoFASecrect as string);
    await agent
      .post('/api/2fa/verify')
      .set('X-Fingerprint', 'device-new')
      .send({ TOTP: code })
      .expect(200);

    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-new')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(200);
  });

  it('answers 202 for a reset request whether or not the address exists', async () => {
    h.mail.clear();
    const generic = await h
      .agent()
      .post('/api/reset-password/send-email')
      .send({ email: 'nobody@example.com' })
      .expect(202);
    expect(h.mail.sent).toHaveLength(0);

    const known = await h
      .agent()
      .post('/api/reset-password/send-email')
      .send({ email: credentials.email })
      .expect(202);

    expect(known.body.message).toBe(generic.body.message);
    expect(h.mail.sent).toHaveLength(1);
  });

  it('resets the password and revokes every session with it', async () => {
    const resident = h.agent();
    await resident
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-a')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(200);
    await resident.set('X-Fingerprint', 'device-a').get('/api/me').expect(200);

    const token = tokenFromMail(h.mail.last());
    await h
      .agent()
      .post('/api/reset-password/validate')
      .send({ token, password: 'BrandNewPass1' })
      .expect(200);

    // The session that existed before the reset is dead…
    await resident.set('X-Fingerprint', 'device-a').get('/api/me').expect(401);
    // …the old password no longer signs in…
    await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-a')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(401);
    // …and the new one does.
    await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-a')
      .send({ user: { email: credentials.email, password: 'BrandNewPass1' } })
      .expect(200);

    credentials.password = 'BrandNewPass1';
  });

  it('changes the password, killing the other sessions and keeping this one', async () => {
    const other = h.agent();
    await other
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-other')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(430); // 2FA is on and this device is not trusted; the session still exists

    const mine = h.agent();
    await mine
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-a')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(200);

    await mine
      .post('/api/me/update-password')
      .set('X-Fingerprint', 'device-a')
      .send({ oldPassword: credentials.password, newPassword: 'ThirdPassword1' })
      .expect(200);

    await other.set('X-Fingerprint', 'device-other').get('/api/me').expect(401);
    await mine.set('X-Fingerprint', 'device-a').get('/api/me').expect(200);
    credentials.password = 'ThirdPassword1';
  });

  it('signs out and immediately refuses the old cookie', async () => {
    const agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'device-a')
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(200);

    await agent.get('/api/me').expect(200);
    await agent.set('X-Fingerprint', 'device-a').post('/api/auth/signout').expect(200);
    await agent.get('/api/me').expect(401);
  });
});
