import { bootHarness, tokenFromMail, type Harness } from './harness';

/**
 * The password policy, where it belongs and nowhere else.
 *
 * Three DTOs touch a password and each had a different idea of the rules: signup
 * enforced a length and a character mix, sign-in enforced a length it had no business
 * enforcing — answering 400 "Password must contain at least 8 characters" inside a
 * sign-in form, and locking out any account whose real password was shorter — and
 * reset enforced nothing at all, so the emailed link could set a one-character
 * password on an account signup would have refused.
 *
 * These tests pin all three behaviours so the rules cannot drift apart again.
 */
describe('password policy', () => {
  let h: Harness;

  const strong = 'Shortcut2026Launch';

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  it('lets a short password sign in — sign-in is not where the policy lives', async () => {
    await h.seedUser({ name: 'Legacy User', email: 'legacy@example.com', password: 'abc' });

    const client = h.agent();
    await client
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'policy-short')
      .send({ user: { email: 'legacy@example.com', password: 'abc' } })
      .expect(200);
  });

  it('answers a wrong short password with 401, not a signup validation message', async () => {
    await h.seedUser({ name: 'Other User', email: 'other@example.com', password: strong });

    const rejected = await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'policy-wrong')
      .send({ user: { email: 'other@example.com', password: 'nope' } })
      .expect(401);

    const message = JSON.stringify(rejected.body.message);
    expect(message).toContain('Invalid email or password');
    expect(message).not.toContain('8 characters');
  });

  it('refuses a weak password on the reset route', async () => {
    await h.seedUser({ name: 'Reset Weak', email: 'weak@example.com', password: strong });

    const client = h.agent();
    const token = await client.get('/api/csrf').expect(200);
    const csrf = token.body.token as string;

    await client
      .post('/api/reset-password/send-email')
      .set('x-csrf-token', csrf)
      .send({ email: 'weak@example.com' })
      .expect(202);

    const resetToken = tokenFromMail(h.mail.last());

    const rejected = await client
      .post('/api/reset-password/validate')
      .set('x-csrf-token', csrf)
      .send({ token: resetToken, password: 'abc' })
      .expect(400);

    expect(JSON.stringify(rejected.body.message)).toMatch(/8 characters|uppercase/i);
  });

  it('resets with a strong password, and the old one stops working', async () => {
    await h.seedUser({ name: 'Reset Strong', email: 'strong@example.com', password: strong });

    const client = h.agent();
    const token = await client.get('/api/csrf').expect(200);
    const csrf = token.body.token as string;

    await client
      .post('/api/reset-password/send-email')
      .set('x-csrf-token', csrf)
      .send({ email: 'strong@example.com' })
      .expect(202);

    const resetToken = tokenFromMail(h.mail.last());
    const next = 'FreshPassword2027';

    await client
      .post('/api/reset-password/validate')
      .set('x-csrf-token', csrf)
      .send({ token: resetToken, password: next })
      .expect(200);

    await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'policy-new')
      .send({ user: { email: 'strong@example.com', password: next } })
      .expect(200);

    await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'policy-old')
      .send({ user: { email: 'strong@example.com', password: strong } })
      .expect(401);
  });

  it('rejects a reset token that was never issued', async () => {
    const client = h.agent();
    const token = await client.get('/api/csrf').expect(200);
    await client
      .post('/api/reset-password/validate')
      .set('x-csrf-token', token.body.token as string)
      .send({ token: 'not.a.token', password: strong })
      .expect(401);
  });
});
