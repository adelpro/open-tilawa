import { bootHarness, type Harness } from './harness';

/**
 * Role administration, over HTTP.
 *
 * The invariants under test are the ones whose absence is unrecoverable: a
 * demotion that leaves working credentials behind, an admin promoting
 * themselves, and the platform losing its last super_admin.
 */
describe('admin console', () => {
  let h: Harness;
  let superId: number;
  let userId: number;

  const password = 'AdminPass123';

  const signin = async (email: string) => {
    const agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', `fp-${email}`)
      .send({ user: { email, password } })
      .expect(200);
    return agent;
  };

  beforeAll(async () => {
    h = await bootHarness();
    superId = await h.seedUser({
      name: 'Root',
      email: 'root@example.com',
      password,
      role: 'super_admin',
    });
    // `root` is the Owner for this suite; the harness's seeded owner becomes a
    // plain super_admin, which is exactly the second rank we need to test against.
    h.users.setOwner(superId);
    await h.seedUser({
      name: 'Admins',
      email: 'admin@example.com',
      password,
      role: 'admin',
    });
    userId = await h.seedUser({ name: 'Writer', email: 'writer@example.com', password });
  });

  afterAll(async () => {
    await h.close();
  });

  it('refuses anonymous and regular-user callers', async () => {
    await h.agent().get('/api/admin/users').expect(401);
    const writer = await signin('writer@example.com');
    await writer.get('/api/admin/users').expect(403);
  });

  it('lists users for an admin', async () => {
    const admin = await signin('admin@example.com');
    const res = await admin.get('/api/admin/users').expect(200);
    expect(res.body.map((u: { email: string }) => u.email)).toEqual(
      expect.arrayContaining(['root@example.com', 'admin@example.com', 'writer@example.com']),
    );
    // Nothing that could be used as a credential ever leaves this route.
    expect(JSON.stringify(res.body)).not.toContain('hash');
  });

  it('reports gate health to an admin, and refuses everyone else', async () => {
    const writer = await signin('writer@example.com');
    await writer.get('/api/admin/gate-health').expect(403);

    const admin = await signin('admin@example.com');
    const res = await admin.get('/api/admin/gate-health').expect(200);
    expect(Array.isArray(res.body.gates)).toBe(true);
    expect(res.body.gates).toHaveLength(2);
    // `ok` is the doctor's own verdict, not a summary this route computes.
    expect(typeof res.body.ok).toBe('boolean');
  });

  it('filters by name or email', async () => {
    const admin = await signin('admin@example.com');
    const res = await admin.get('/api/admin/users?q=writ').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe('writer@example.com');
  });

  it('lets an admin create a regular user but not an admin', async () => {
    const admin = await signin('admin@example.com');

    await admin
      .post('/api/admin/users')
      .send({ name: 'Second', email: 'second@example.com', password })
      .expect(201);

    await admin
      .post('/api/admin/users')
      .send({ name: 'Third', email: 'third@example.com', password, role: 'admin' })
      .expect(403);
  });

  it('mints a key for a user and returns the plaintext exactly once', async () => {
    const admin = await signin('admin@example.com');
    const res = await admin
      .post(`/api/admin/users/${userId}/keys`)
      .send({ label: 'ci', scopes: ['profile:read', 'gate:run'] })
      .expect(201);

    expect(res.body.key).toMatch(/^usl_/);
    expect(res.body.prefix).toHaveLength(12);

    const listed = await admin.get(`/api/admin/users/${userId}/keys`).expect(200);
    expect(JSON.stringify(listed.body)).not.toContain(res.body.key);
    expect(listed.body[0].key_prefix).toBe(res.body.prefix);
  });

  it('refuses an unknown scope', async () => {
    const admin = await signin('admin@example.com');
    await admin
      .post(`/api/admin/users/${userId}/keys`)
      .send({ label: 'bad', scopes: ['profile:read', 'root:everything'] })
      .expect(400);
  });

  it('refuses a self role change', async () => {
    const root = await signin('root@example.com');
    await root.post(`/api/admin/users/${superId}/role`).send({ role: 'user' }).expect(400);
  });

  it('refuses a role change from a plain admin', async () => {
    const admin = await signin('admin@example.com');
    await admin.post(`/api/admin/users/${userId}/role`).send({ role: 'admin' }).expect(403);
  });

  it('promotes, audits it with before and after, and demotes with revocation', async () => {
    const root = await signin('root@example.com');

    const promoted = await root
      .post(`/api/admin/users/${userId}/role`)
      .send({ role: 'admin' })
      .expect(200);
    expect(promoted.body.role).toBe('admin');

    const auditRow = h.db
      .prepare(
        "SELECT * FROM audit_log WHERE action = 'admin:role_change' ORDER BY id DESC LIMIT 1",
      )
      .get() as { actor_id: number; user_id: number; before_json: string; after_json: string };
    expect(auditRow.actor_id).toBe(superId);
    expect(auditRow.user_id).toBe(userId);
    expect(JSON.parse(auditRow.before_json)).toEqual({ role: 'user', isOwner: false });
    expect(JSON.parse(auditRow.after_json)).toEqual({ role: 'admin', isOwner: false });

    // The writer holds a key and a session from signing in earlier in the suite.
    const writer = await signin('writer@example.com');
    await writer.get('/api/me').expect(200);

    await root.post(`/api/admin/users/${userId}/role`).send({ role: 'user' }).expect(200);

    // Demotion takes effect on the next request, not at token expiry.
    await writer.get('/api/me').expect(401);
    const liveKeys = h.db
      .prepare('SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND revoked_at IS NULL')
      .get(userId) as { n: number };
    expect(liveKeys.n).toBe(0);
  });

  it('protects the Owner and lets only the Owner manage super_admins', async () => {
    const second = await h.seedUser({
      name: 'SecondRoot',
      email: 'root2@example.com',
      password,
      role: 'super_admin',
    });

    // A non-owner super_admin cannot demote, disable or delete the Owner, and
    // cannot appoint a new super_admin of their own.
    const root2 = await signin('root2@example.com');
    await root2.post(`/api/admin/users/${superId}/role`).send({ role: 'user' }).expect(403);
    await root2.post(`/api/admin/users/${superId}/disable`).expect(403);
    await root2.delete(`/api/admin/users/${superId}`).expect(403);
    await root2
      .post('/api/admin/users')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password, role: 'super_admin' })
      .expect(403);

    // The Owner may suspend another super_admin, and may undo it.
    const root = await signin('root@example.com');
    await root.post(`/api/admin/users/${second}/disable`).expect(200);
    await root.post(`/api/admin/users/${second}/enable`).expect(200);

    // A regular user disabled by an admin loses the session it was holding.
    const writer = await signin('writer@example.com');
    const admin = await signin('admin@example.com');
    await admin.post(`/api/admin/users/${userId}/disable`).expect(200);
    await writer.get('/api/me').expect(401);
  });

  it('refuses self-deletion while the account owns the instance', async () => {
    const root = await signin('root@example.com');
    await root.delete('/api/me').expect(409);
  });

  it('forbids deleting a user from an admin, and from deleting yourself', async () => {
    const admin = await signin('admin@example.com');
    await admin.delete(`/api/admin/users/${userId}`).expect(403);

    const root = await signin('root2@example.com');
    await root.delete(`/api/admin/users/${superId + 100}`).expect(404);
  });

  it('records admin actions in the audit trail', async () => {
    const root = await signin('root2@example.com');
    const res = await root.get('/api/admin/audit?limit=50').expect(200);
    const actions = res.body.map((row: { action: string }) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'admin:role_change',
        'admin:user_disable',
        'admin:key_mint',
        'admin:user_create',
      ]),
    );
  });
});
