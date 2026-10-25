import { fingerprintHash } from '@tilawa-admin/core';
import { describeDevice } from '../src/tokens/device-label';
import { bootHarness, type Harness } from './harness';

describe('device labels', () => {
  it('turns a user agent into a browser and platform', () => {
    const chrome =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
    expect(describeDevice(chrome).label).toBe('Chrome 141 · Android');

    const safari =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
    expect(describeDevice(safari).label).toBe('Safari 18 · macOS');

    // Edge advertises Chrome; the more specific rule has to win.
    const edge =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';
    expect(describeDevice(edge).label).toBe('Edge 141 · Windows');
  });

  it('keeps an unparseable header instead of saying "unknown"', () => {
    expect(describeDevice('curl/8.4.0').label).toBe('curl/8.4.0');
    expect(describeDevice('').label).toBe('');
    expect(describeDevice(null).label).toBe('');
  });
});

/**
 * The signed-in devices table is only useful if a row can be identified, dated,
 * and removed. These assertions are deliberately HTTP-level: the point is the
 * JSON the account screen receives, not the repository underneath it.
 */
describe('signed-in devices', () => {
  let h: Harness;
  const credentials = {
    name: 'Device Owner',
    email: 'devices@example.com',
    password: 'Password123',
  };

  beforeAll(async () => {
    h = await bootHarness();
    await h.seedUser(credentials);
  });

  afterAll(async () => {
    await h.close();
  });

  const signIn = async (
    agent: ReturnType<Harness['agent']>,
    fingerprint: string,
    label: string,
  ) => {
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', fingerprint)
      .set('User-Agent', label)
      .send({ user: { email: credentials.email, password: credentials.password } })
      .expect(200);
  };

  it('labels the rows, dates them, and marks the request device', async () => {
    const agent = h.agent();
    await signIn(agent, 'device-a', 'Browser A');

    const res = await agent.get('/api/tokens').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      label: 'Browser A',
      isCurrent: true,
      isTrusted: false,
    });
    expect(typeof res.body[0].createdAt).toBe('string');
    expect(res.body[0].createdAt).not.toBe('never');
  });

  it('reports 2FA trust for a device that has passed the second factor', async () => {
    const agentA = h.agent();
    await signIn(agentA, 'device-a', 'Browser A');
    const agentB = h.agent();
    await signIn(agentB, 'device-b', 'Browser B');

    const fingerprint = { label: 'Browser B', value: 'device-b' };
    h.db
      .prepare(
        `INSERT INTO trusted_devices (user_id, fingerprint_hash, fingerprint_json, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        h.users.getByEmail(credentials.email)!.id,
        fingerprintHash(fingerprint),
        JSON.stringify(fingerprint),
        new Date(Date.now() + 86_400_000).toISOString(),
      );

    const res = await agentA.get('/api/tokens').expect(200);
    const second = res.body.find((row: { label: string }) => row.label === 'Browser B');
    expect(second).toMatchObject({ isCurrent: false, isTrusted: true });
  });

  it('deletes a device session and forgets its 2FA trust', async () => {
    const agentA = h.agent();
    await signIn(agentA, 'device-a', 'Browser A');
    const list = await agentA.get('/api/tokens').expect(200);
    const other = list.body.find((row: { label: string }) => row.label === 'Browser B');
    expect(other).toBeTruthy();

    await agentA.delete(`/api/tokens/${other.id}`).expect(200);

    const after = await agentA.get('/api/tokens').expect(200);
    expect(after.body.map((row: { label: string }) => row.label)).toEqual(['Browser A']);

    const trusted = h.db
      .prepare('SELECT COUNT(*) AS count FROM trusted_devices WHERE user_id = ?')
      .get(h.users.getByEmail(credentials.email)!.id) as { count: number };
    expect(trusted.count).toBe(0);
  });

  it('lets the current device delete itself', async () => {
    const agent = h.agent();
    await signIn(agent, 'device-a', 'Browser A');
    const list = await agent.get('/api/tokens').expect(200);
    expect(list.body[0].isCurrent).toBe(true);

    await agent.delete(`/api/tokens/${list.body[0].id}`).expect(200);
    await agent.get('/api/me').expect(401);
  });
});
