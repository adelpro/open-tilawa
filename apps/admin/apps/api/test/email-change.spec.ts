import { bootHarness, tokenFromMail, type Harness } from './harness';

/**
 * A change of address is a takeover vector if it moves without proof of the new
 * mailbox. The contract here: the current password (and the second factor, when
 * it is on) starts the request, only the newest link is live, the address moves
 * only when that link is opened, and every session dies on the way through.
 */
describe('email change', () => {
  let h: Harness;
  let userId: number;

  const password = 'MailerPass123';

  const signin = async (email: string, pin = password, fingerprint = `fp-${email}`) => {
    const agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', fingerprint)
      .send({ user: { email, password: pin } })
      .expect(200);
    return agent;
  };

  beforeAll(async () => {
    h = await bootHarness();
    userId = await h.seedUser({
      name: 'Mailer',
      email: 'mailer@example.com',
      password,
      role: 'user',
    });
  });

  afterAll(async () => {
    await h.close();
  });

  it('requires a session, the current password, and a genuinely different address', async () => {
    await h
      .agent()
      .post('/api/me/email-change')
      .send({ newEmail: 'nobody@example.com', password })
      .expect(401);

    const agent = await signin('mailer@example.com');

    await agent
      .post('/api/me/email-change')
      .send({ newEmail: 'next@example.com', password: 'wrong-password' })
      .expect(401);

    await agent
      .post('/api/me/email-change')
      .send({ newEmail: 'mailer@example.com', password })
      .expect(400);

    // The seeded Owner already holds this address; the requester proved the
    // password, so naming the collision tells them nothing they could not learn
    // by trying to sign up with it.
    await agent.post('/api/me/email-change').send({ newEmail: h.ownerEmail, password }).expect(409);
  });

  it('retires an older link when a newer one is requested', async () => {
    const agent = await signin('mailer@example.com');

    h.mail.clear();
    await agent
      .post('/api/me/email-change')
      .send({ newEmail: 'first@example.com', password })
      .expect(202);
    const first = tokenFromMail(h.mail.last());

    await agent
      .post('/api/me/email-change')
      .send({ newEmail: 'second@example.com', password })
      .expect(202);
    const second = tokenFromMail(h.mail.last());

    expect(first).not.toBe(second);
    await h
      .agent()
      .post('/api/auth/local/confirm-email-change')
      .set('X-Fingerprint', 'fp-stale')
      .send({ token: first })
      .expect(401);
  });

  it('switches the address on confirmation and revokes every other session', async () => {
    // Two live sessions before the switch: the one that requested it and one
    // other device. Confirmation happens on a third, which gets the fresh cookie.
    const requester = await signin('mailer@example.com');
    const otherDevice = await signin('mailer@example.com', password, 'fp-other-device');

    h.mail.clear();
    await requester
      .post('/api/me/email-change')
      .send({ newEmail: 'verified@example.com', password })
      .expect(202);

    const token = tokenFromMail(h.mail.last());
    const confirming = h.agent();
    const confirmed = await confirming
      .post('/api/auth/local/confirm-email-change')
      .set('X-Fingerprint', 'fp-confirmed')
      .send({ token })
      .expect(200);

    expect(confirmed.body.email).toBe('verified@example.com');
    expect(h.users.getById(userId)?.email).toBe('verified@example.com');

    await requester.get('/api/me').expect(401);
    await otherDevice.get('/api/me').expect(401);

    const me = await confirming.get('/api/me').expect(200);
    expect(me.body.email).toBe('verified@example.com');

    // The old mailbox learns that it no longer receives the account.
    const notice = h.mail.sent.find((mail) => mail.to === 'mailer@example.com');
    expect(notice).toBeDefined();

    // Replaying the consumed link changes nothing.
    await h
      .agent()
      .post('/api/auth/local/confirm-email-change')
      .set('X-Fingerprint', 'fp-replay')
      .send({ token })
      .expect(401);

    // The new address signs in; the old one no longer names an account.
    await signin('verified@example.com');
    await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'fp-old')
      .send({ user: { email: 'mailer@example.com', password } })
      .expect(401);
  });
});
