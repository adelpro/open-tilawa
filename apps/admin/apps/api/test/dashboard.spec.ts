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

  describe('profiles', () => {
    it('seeds the bundled default on first visit', async () => {
      const res = await agent.get('/api/profiles').expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('voice-default');
      expect(res.body[0].isDefault).toBe(true);
    });

    it('creates a profile and refuses a duplicate name', async () => {
      const created = await agent
        .post('/api/profiles')
        .send({ name: 'docs-tone', houseStyle: { oxford: true } })
        .expect(201);
      expect(created.body.name).toBe('docs-tone');
      expect(created.body.isDefault).toBe(false);

      await agent.post('/api/profiles').send({ name: 'docs-tone' }).expect(400);
    });

    it('previews generation without writing anything', async () => {
      const before = (await agent.get('/api/profiles').expect(200)).body.length;
      const res = await agent
        .post('/api/profiles/generate')
        .send({ name: 'from-samples', samples: [SAMPLE] })
        .expect(200);

      expect(res.body.manifest.name).toBeTruthy();
      expect(res.body.voiceCard).toContain('I write short sentences');
      // The pipeline line is reported, not silently kept.
      expect(res.body.excluded.length).toBeGreaterThan(0);
      expect(res.body.excluded[0].why).toBeTruthy();

      const after = (await agent.get('/api/profiles').expect(200)).body.length;
      expect(after).toBe(before);
    });

    it('applies the same generation when asked to store it', async () => {
      const preview = await agent
        .post('/api/profiles/generate')
        .send({ name: 'stored-tone', samples: [SAMPLE] })
        .expect(200);
      const stored = await agent
        .post('/api/profiles/from-samples')
        .send({ name: 'stored-tone', samples: [SAMPLE], isDefault: true })
        .expect(201);

      // Same engine, same output. `isDefault` is the one key the loader adds when
      // it reads a stored manifest, so it is excluded from the comparison rather
      // than pretended away.
      const { isDefault: _stored, ...storedManifest } = stored.body.manifest;
      expect(storedManifest).toEqual(preview.body.manifest);
      expect(stored.body.sampleCount).toBe(1);
      expect(stored.body.isDefault).toBe(true);

      const list = (await agent.get('/api/profiles').expect(200)).body;
      expect(list.filter((p: { isDefault: boolean }) => p.isDefault)).toHaveLength(1);
    });

    it('moves the default without leaving two behind', async () => {
      const list = (await agent.get('/api/profiles').expect(200)).body;
      const target = list.find((p: { name: string }) => p.name === 'docs-tone');
      await agent.post(`/api/profiles/${target.id}/default`).expect(200);

      const after = (await agent.get('/api/profiles').expect(200)).body;
      const defaults = after.filter((p: { isDefault: boolean }) => p.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].name).toBe('docs-tone');
    });

    it('refuses to delete the last profile', async () => {
      const solo = await h.seedUser({
        name: 'Solo',
        email: 'solo@example.com',
        password: 'Password123',
      });
      const soloAgent = h.agent();
      await soloAgent
        .post('/api/auth/local/signin')
        .set('X-Fingerprint', `solo-${solo}`)
        .send({ user: { email: 'solo@example.com', password: 'Password123' } })
        .expect(200);

      const list = (await soloAgent.get('/api/profiles').expect(200)).body;
      await soloAgent.delete(`/api/profiles/${list[0].id}`).expect(400);
    });

    it('never shows another account the same profile', async () => {
      const mine = (await agent.get('/api/profiles').expect(200)).body;
      const otherAgent = h.agent();
      await h.seedUser({ name: 'Other', email: 'other@example.com', password: 'Password123' });
      await otherAgent
        .post('/api/auth/local/signin')
        .set('X-Fingerprint', 'other-device')
        .send({ user: { email: 'other@example.com', password: 'Password123' } })
        .expect(200);

      await otherAgent.get(`/api/profiles/${mine[0].id}`).expect(404);
      const theirs = (await otherAgent.get('/api/profiles').expect(200)).body;
      expect(theirs.map((p: { name: string }) => p.name)).not.toContain('docs-tone');
    });
  });

  describe('usage', () => {
    it('returns only the caller’s own activity', async () => {
      const me = (await agent.get('/api/me').expect(200)).body as { id: number };
      const res = await agent.get('/api/usage').expect(200);

      expect(Array.isArray(res.body.audit)).toBe(true);
      expect(typeof res.body.total).toBe('number');
      expect(res.body.limits['sign-in attempts']).toContain('15 minutes');

      // Every row belongs to the caller: the route scopes by user id, and this is
      // the assertion that would fail if that scope were dropped.
      for (const entry of res.body.audit as { user_id: number | null }[]) {
        expect(entry.user_id).toBe(me.id);
      }
    });

    it('refuses an anonymous caller', async () => {
      await h.agent().get('/api/usage').expect(401);
    });

    it('aggregates stats over the range and stays scoped to the caller', async () => {
      const res = await agent.get('/api/usage/stats?range=7').expect(200);

      expect(res.body.range).toBe(7);
      expect(res.body.days).toHaveLength(7);
      const days = res.body.days as { date: string; total: number; fail: number }[];
      const dates = days.map((d) => d.date);
      expect(new Set(dates).size).toBe(7);
      for (const d of days) {
        expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(d.total).toBeGreaterThanOrEqual(0);
        expect(typeof d.fail).toBe('number');
      }
      expect(typeof res.body.errorRate).toBe('number');
      expect(Array.isArray(res.body.tools)).toBe(true);

      // tool-call rows never leak the other account: scoped by user id
      const other = h.agent();
      await h.seedUser({
        name: 'Stats Other',
        email: 'statsother@example.com',
        password: 'Password123',
      });
      await other
        .post('/api/auth/local/signin')
        .set('X-Fingerprint', 'stats-other-device')
        .send({ user: { email: 'statsother@example.com', password: 'Password123' } })
        .expect(200);
      const theirs = (await other.get('/api/usage/stats?range=90').expect(200)).body;
      expect(theirs.range).toBe(90);
      expect(theirs.days).toHaveLength(90);
      expect(theirs.total).toBe(0);

      // unknown ranges fall back, they do not widen the window
      const fallback = await agent.get('/api/usage/stats?range=123456').expect(200);
      expect(fallback.body.range).toBe(30);
    });
  });

  describe('keys', () => {
    let keyId: number;
    let plaintext: string;

    it('mints a key and returns the secret exactly once', async () => {
      const res = await agent
        .post('/api/api-keys')
        .send({ label: 'Claude Code', scopes: ['profile:read', 'gate:run'] })
        .expect(201);

      plaintext = res.body.key;
      keyId = res.body.record.id;
      expect(plaintext).toMatch(/^usl_[A-Za-z0-9]+/);
      expect(res.body.record.prefix).toBe(plaintext.slice(0, res.body.record.prefix.length));
      expect(res.body.record.status).toBe('active');

      const list = await agent.get('/api/api-keys').expect(200);
      const stored = list.body.find((k: { id: number }) => k.id === keyId);
      expect(stored.scopes).toEqual(['profile:read', 'gate:run']);
      // Nothing secret reaches the list: no hash, no plaintext.
      expect(JSON.stringify(list.body)).not.toContain(plaintext);
      expect(stored).not.toHaveProperty('key_hash');
    });

    it('rotates: the old key is revoked and the new one works', async () => {
      const res = await agent.post(`/api/api-keys/${keyId}/rotate`).expect(200);
      expect(res.body.key).not.toBe(plaintext);
      expect(res.body.replaced).toBe(plaintext.slice(0, res.body.replaced.length));

      const list = (await agent.get('/api/api-keys').expect(200)).body;
      const old = list.find((k: { id: number }) => k.id === keyId);
      expect(old.status).toBe('revoked');
      expect(list.filter((k: { status: string }) => k.status === 'active')).toHaveLength(1);
    });

    it('renames a key without touching its secret or scopes', async () => {
      const before = (await agent.get('/api/api-keys').expect(200)).body.find(
        (k: { id: number }) => k.id === keyId,
      );

      const renamed = await agent
        .patch(`/api/api-keys/${keyId}`)
        .send({ label: 'Claude Code — laptop' })
        .expect(200);
      expect(renamed.body).toMatchObject({
        id: keyId,
        label: 'Claude Code — laptop',
        prefix: before.prefix,
        scopes: before.scopes,
      });

      const after = (await agent.get('/api/api-keys').expect(200)).body.find(
        (k: { id: number }) => k.id === keyId,
      );
      expect(after.label).toBe('Claude Code — laptop');
      expect(after.prefix).toBe(before.prefix);
    });

    it('refuses an empty label', async () => {
      await agent.patch(`/api/api-keys/${keyId}`).send({ label: '   ' }).expect(400);
    });

    it('cannot rename a key belonging to another account', async () => {
      const otherAgent = h.agent();
      await otherAgent
        .post('/api/auth/local/signin')
        .set('X-Fingerprint', 'other-device-3')
        .send({ user: { email: 'other@example.com', password: 'Password123' } })
        .expect(200);

      await otherAgent.patch(`/api/api-keys/${keyId}`).send({ label: 'Not mine' }).expect(404);
    });

    it('revokes, and says so on the next read', async () => {
      const list = (await agent.get('/api/api-keys').expect(200)).body;
      const active = list.find((k: { status: string }) => k.status === 'active');
      await agent.delete(`/api/api-keys/${active.id}`).expect(200).expect({ revoked: true });

      const after = (await agent.get('/api/api-keys').expect(200)).body;
      expect(after.every((k: { status: string }) => k.status === 'revoked')).toBe(true);
    });

    it('cannot revoke a key belonging to another account', async () => {
      const otherAgent = h.agent();
      await otherAgent
        .post('/api/auth/local/signin')
        .set('X-Fingerprint', 'other-device-2')
        .send({ user: { email: 'other@example.com', password: 'Password123' } })
        .expect(200);

      await otherAgent.delete(`/api/api-keys/${keyId}`).expect(404);
    });
  });
});
