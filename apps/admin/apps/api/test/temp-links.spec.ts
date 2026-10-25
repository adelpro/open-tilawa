import { bootHarness, tokenFromMail, type Harness } from './harness';

/**
 * Email links after migration 009: single-use, purpose-bound.
 *
 * Before the ledger, an activation or reset link was a plain bearer JWT —
 * valid for the whole TTL, redeemable as many times as it was presented, and
 * interchangeable between the two flows because both mails signed the same
 * claim shape. Every test here exists because exactly that hole did.
 */
describe('temp links: single-use, purpose-bound', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  it('refuses to activate twice with one link', async () => {
    const agent = h.agent();
    const csrf = (await agent.get('/api/csrf').expect(200)).body.token as string;
    await agent
      .post('/api/auth/local/signup')
      .set('x-csrf-token', csrf)
      .send({
        user: { name: 'Replay Once', email: 'replay.once@example.com', password: 'Password123' },
      })
      .expect(201);
    const token = tokenFromMail(h.mail.last());
    h.mail.clear();

    await agent
      .post('/api/auth/local/activate')
      .set('x-csrf-token', csrf)
      .set('X-Fingerprint', 'replay-device')
      .send({ token })
      .expect(200);

    // The second presentation of the same mail is dead: the jti row flipped.
    await agent
      .post('/api/auth/local/activate')
      .set('x-csrf-token', csrf)
      .set('X-Fingerprint', 'replay-device')
      .send({ token })
      .expect(401);
  });

  it('refuses a reset token at the activation endpoint, and an activation token at the reset endpoint', async () => {
    // An activation token pointed at the reset endpoint...
    const first = h.agent();
    await first
      .post('/api/auth/local/signup')
      .set('x-csrf-token', (await first.get('/api/csrf').expect(200)).body.token as string)
      .send({
        user: { name: 'Purpose A', email: 'purpose.a@example.com', password: 'Password123' },
      })
      .expect(201);
    const activation = tokenFromMail(h.mail.last());

    await h
      .agent()
      .post('/api/reset-password/validate')
      .send({ token: activation, password: 'NewPassword987' })
      .expect(401);

    // ...and a real reset token, carried into the activation endpoint.
    await h.seedUser({
      name: 'Purpose B',
      email: 'purpose.b@example.com',
      password: 'orig-pass-123',
    });
    h.mail.clear();
    const mailAgent = h.agent();
    await mailAgent
      .post('/api/reset-password/send-email')
      .set('x-csrf-token', (await mailAgent.get('/api/csrf').expect(200)).body.token as string)
      .send({ email: 'purpose.b@example.com' })
      .expect(202);
    const reset = tokenFromMail(h.mail.last());
    h.mail.clear();

    await h
      .agent()
      .post('/api/auth/local/activate')
      .set('X-Fingerprint', 'purpose-b-device')
      .send({ token: reset })
      .expect(401);

    // ...and the cross-flow refusal did not burn the real reset link:
    // it is still worth its one use on its own flow.
    await h
      .agent()
      .post('/api/reset-password/validate')
      .send({ token: reset, password: 'NewPassword123' })
      .expect(200);
  });

  it('kills an outstanding activation link when a second one lands', async () => {
    const signup = h.agent();
    await signup
      .post('/api/auth/local/signup')
      .set('x-csrf-token', (await signup.get('/api/csrf').expect(200)).body.token as string)
      .send({
        user: { name: 'Two Links', email: 'two.links@example.com', password: 'Password123' },
      })
      .expect(201);
    const first = tokenFromMail(h.mail.last());
    h.mail.clear();

    const mailAgent = h.agent();
    await mailAgent
      .post('/api/auth/local/resend-activation')
      .set('x-csrf-token', (await mailAgent.get('/api/csrf').expect(200)).body.token as string)
      .send({ email: 'two.links@example.com' })
      .expect(202);
    const second = tokenFromMail(h.mail.last());
    expect(second).not.toBe(first);
    h.mail.clear();

    const activator = h.agent();
    await activator
      .post('/api/auth/local/activate')
      .set('X-Fingerprint', 'two-links-device')
      .send({ token: second })
      .expect(200);

    // Landing the transition purged the account's other activation link.
    await activator
      .post('/api/auth/local/activate')
      .set('X-Fingerprint', 'two-links-device')
      .send({ token: first })
      .expect(401);
  });

  it('kills an unspent reset link when the password changes without it', async () => {
    await h.seedUser({
      name: 'Stale Reset',
      email: 'stale.reset@example.com',
      password: 'Password123',
    });
    const resetAgent = h.agent();
    await resetAgent
      .post('/api/reset-password/send-email')
      .set('x-csrf-token', (await resetAgent.get('/api/csrf').expect(200)).body.token as string)
      .send({ email: 'stale.reset@example.com' })
      .expect(202);
    const stale = tokenFromMail(h.mail.last());
    h.mail.clear();

    // The owner changes the password themselves, from their own session.
    const owner = h.agent();
    await owner
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'stale-device')
      .send({ user: { email: 'stale.reset@example.com', password: 'Password123' } })
      .expect(200);
    const ownerCsrf = (await owner.get('/api/csrf').expect(200)).body.token as string;
    await owner
      .post('/api/me/update-password')
      .set('x-csrf-token', ownerCsrf)
      .set('X-Fingerprint', 'stale-device')
      .send({ oldPassword: 'Password123', newPassword: 'Password456' })
      .expect(200);

    // The forwarded reset mail is dead, not a key to the new password.
    await h
      .agent()
      .post('/api/reset-password/validate')
      .send({ token: stale, password: 'Password789' })
      .expect(401);
  });
});
