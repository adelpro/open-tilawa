import { bootHarness, type Harness } from './harness';

/**
 * The account's default master step (A3 hybrid, 4b).
 *
 * Two columns, one preference: it is sent as a pair, cleared as a pair, and a
 * profile without a master runs it instead. The editor shows it; the MCP tool
 * compiles it. These tests pin the edge — a half-filled pair is refused by name,
 * and clearing writes NULL rather than an empty prompt.
 */
describe('me: default master step', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;
  const account = { email: 'master@example.com', password: 'Password123' };

  beforeAll(async () => {
    h = await bootHarness();
    await h.seedUser({ name: 'Master User', email: account.email, password: account.password });
    agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'master-device')
      .send({ user: account })
      .expect(200);
  });

  afterAll(async () => {
    await h.close();
  });

  it('starts empty and round-trips a name and instructions on /me', async () => {
    const before = await agent.get('/api/me').expect(200);
    expect(before.body.masterName).toBeNull();
    expect(before.body.masterBody).toBeNull();

    await agent
      .patch('/api/me')
      .send({ user: { masterName: '  house-master  ', masterBody: 'Compose one revision.' } })
      .expect(200);

    const after = await agent.get('/api/me').expect(200);
    expect(after.body.masterName).toBe('house-master');
    expect(after.body.masterBody).toBe('Compose one revision.');
  });

  it('refuses half a pair with a message that names the rule', async () => {
    const onlyName = await agent
      .patch('/api/me')
      .send({ user: { masterName: 'half' } })
      .expect(400);
    expect(onlyName.body.message).toMatch(/both/);

    // The refused write did not touch the stored pair.
    const me = await agent.get('/api/me').expect(200);
    expect(me.body.masterName).toBe('house-master');
  });

  it('clears the pair with two empty strings', async () => {
    await agent
      .patch('/api/me')
      .send({ user: { masterName: '', masterBody: '' } })
      .expect(200);

    const me = await agent.get('/api/me').expect(200);
    expect(me.body.masterName).toBeNull();
    expect(me.body.masterBody).toBeNull();
  });

  it('caps the name at 40 and the instructions at 4,000 characters', async () => {
    await agent
      .patch('/api/me')
      .send({ user: { masterName: 'x'.repeat(41), masterBody: 'Compose.' } })
      .expect(400);
    await agent
      .patch('/api/me')
      .send({ user: { masterName: 'too-long', masterBody: 'x'.repeat(4001) } })
      .expect(400);
  });
});
