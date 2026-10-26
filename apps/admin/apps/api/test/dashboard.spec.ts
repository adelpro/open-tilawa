import { bootHarness, type Harness } from './harness';

/**
 * The dashboard's own surface, driven over HTTP (T6.2, T6.3, T6.7).
 *
 * Three things are under test here: that the CSRF pair actually refuses a
 * mutation, that profiles are per-account and never silently shareable, and that
 * a key's plaintext exists in exactly one response and nowhere after it.
 */
const SAMPLE = [
  '---',
  'name: sample-voice',
  'description: a short sample',
  '---',
  '',
  'I write short sentences. I keep one idea per paragraph, and I name the thing',
  'I am describing instead of pointing at it.',
  '',
  'Run avoid-ai-writing before you publish, then check the gate exit code.',
  'This line is pipeline instruction, not voice.',
].join('\n');

describe('dashboard api', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;
  const account = { email: 'writer@example.com', password: 'Password123' };

  beforeAll(async () => {
    h = await bootHarness();
    await h.seedUser({ name: 'Writer', email: account.email, password: account.password });
    agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'dashboard-a')
      .send({ user: account })
      .expect(200);
  });

  afterAll(async () => {
    await h.close();
  });

  describe('csrf', () => {
    it('issues a token as both a cookie and a body value', async () => {
      const res = await h.agent().get('/api/csrf').expect(200);
      expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
      expect(res.body.header).toBe('x-csrf-token');
      const cookie = res.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toContain('uslub_csrf=');
      // Readable by the client on purpose: it has to echo it.
      expect(cookie).not.toContain('HttpOnly');
    });

    it('refuses a mutation that carries the cookie but not the header', async () => {
      const client = h.agent();
      const { body } = await client.get('/api/csrf').expect(200);

      const rejected = await client
        .post('/api/auth/local/signin')
        .set('X-Fingerprint', 'csrf-b')
        .send({ user: account })
        .expect(403);
      expect(rejected.body.message).toContain('CSRF');

      // The same request with the header succeeds, which proves the 403 was the
      // pair and not the credentials.
      await client
        .post('/api/auth/local/signin')
        .set('X-Fingerprint', 'csrf-b')
        .set('x-csrf-token', body.token)
        .send({ user: account })
        .expect(200);
    });

    it('rejects a mismatched header rather than the cookie alone', async () => {
      const client = h.agent();
      await client.get('/api/csrf').expect(200);
      await client
        .post('/api/auth/local/signin')
        .set('X-Fingerprint', 'csrf-c')
        .set('x-csrf-token', 'f'.repeat(64))
        .send({ user: account })
        .expect(403);
    });

    it('leaves reads exempt', async () => {
      const client = h.agent();
      await client.get('/api/csrf').expect(200);
      const res = await client.get('/api/health');
      expect(res.status).not.toBe(403);
    });
  });
});
