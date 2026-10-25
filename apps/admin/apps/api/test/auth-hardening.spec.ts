import { bootHarness, type Harness } from './harness';

const user = { name: 'Hardening Tester', email: 'harden@example.com', password: 'Password123' };
const flood = {
  name: 'Flooded Account',
  email: 'flood.unactivated@example.com',
  password: 'Password123',
};

describe('auth hardening (audit train)', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;
  let csrf = '';

  beforeAll(async () => {
    h = await bootHarness();
    await h.seedUser(user);
    agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'harden-device')
      .send({ user })
      .expect(200);
    csrf = (await agent.get('/api/csrf').expect(200)).body.token as string;
  });

  afterAll(async () => {
    await h.close();
  });

  it('refuses to destroy a session through a GET (logout CSRF)', async () => {
    // A cross-site <img src="/api/auth/signout"> used to work: sameSite=lax
    // forwards the session cookie on top-level navigations and a GET is outside
    // the CSRF middleware. The route must be POST-only — GET dies, POST lives.
    await agent.get('/api/auth/signout').expect(404);

    // The POST still works, and the destruction is real, not cosmetic.
    await agent.post('/api/auth/signout').set('x-csrf-token', csrf).expect(200);
    await agent.get('/api/me').set('X-Fingerprint', 'harden-device').expect(401);
    // The old cookie jar still carries a dead CSRF cookie; the sign-in continues
    // on a clean jar (the dashboards own a fresh tab after signout too).
    const fresh = h.agent();
    const token = (await fresh.get('/api/csrf').expect(200)).body.token as string;
    await fresh
      .post('/api/auth/local/signin')
      .set('x-csrf-token', token)
      .set('X-Fingerprint', 'harden-device')
      .send({ user })
      .expect(200);
    agent = fresh;
    csrf = token;
  });

  it('bounds activation mail to five send attempts per address per hour', async () => {
    // Signup itself is send attempt one for this address.
    await agent
      .post('/api/auth/local/signup')
      .set('x-csrf-token', csrf)
      .send({ user: flood })
      .expect(201);
    h.mail.clear();

    // resend-activation is IP-throttled at 5/15min on the route... so take the
    // four remaining budget slots with the four resends the honest case uses.
    // The five-resend budget: the honest "my link expired" case fits, the fifth
    // resend is the last one inside the hour, and the sixth is silently dropped
    // — same generic 202, zero mail. A rotated-IP campaign lands on the same
    // ledger because it is keyed by the ADDRESS, not the caller.
    for (let i = 0; i < 5; i += 1) {
      await agent
        .post('/api/auth/local/resend-activation')
        .set('x-csrf-token', csrf)
        .send({ email: flood.email })
        .expect(202);
    }
    expect(h.mail.sent.length).toBe(5);

    await agent
      .post('/api/auth/local/resend-activation')
      .set('x-csrf-token', csrf)
      .send({ email: flood.email })
      .expect(202);
    expect(h.mail.sent.length).toBe(5);
  });
});
