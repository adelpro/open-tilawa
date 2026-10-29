import { bootHarness, type Harness } from './harness';

/**
 * The status registry decides how a service is checked from its scheme, and the
 * decision has to survive the round trip: the GunDB relay has no HTTP surface, so a
 * `wss://` row that came back as `http` would be probed with a GET that proves
 * nothing. These assertions are about that stored kind, not about the network.
 */
describe('status services', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;

  beforeAll(async () => {
    h = await bootHarness();
    agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'status-a')
      .send({ user: { email: h.ownerEmail, password: 'OwnerPass123' } })
      .expect(200);
  });

  afterAll(async () => {
    await h.close();
  });

  const csrf = async (): Promise<{ header: string; token: string }> => {
    const res = await agent.get('/api/csrf').expect(200);
    return { header: res.body.header, token: res.body.token };
  };

  it('seeds the relay as a WebSocket service', async () => {
    const res = await agent.get('/api/status').expect(200);
    const relay = (
      res.body.services as { url: string; kind: string; name: string }[]
    ).find((service) => service.url.startsWith('wss://'));
    expect(relay).toBeDefined();
    expect(relay?.kind).toBe('ws');
  });

  it('stores a wss:// service as kind ws', async () => {
    const { header, token } = await csrf();
    const res = await agent
      .post('/api/status/services')
      .set(header, token)
      .send({ name: 'Relay b', url: 'wss://relay.example/gun' })
      .expect(201);
    expect(res.body.kind).toBe('ws');
  });

  it('keeps http(s) as kind http', async () => {
    const { header, token } = await csrf();
    const res = await agent
      .post('/api/status/services')
      .set(header, token)
      .send({ name: 'Docs', url: 'https://example.com/health' })
      .expect(201);
    expect(res.body.kind).toBe('http');
  });

  it('refuses a scheme it cannot check', async () => {
    const { header, token } = await csrf();
    await agent
      .post('/api/status/services')
      .set(header, token)
      .send({ name: 'FTP', url: 'ftp://example.com/x' })
      .expect(400);
  });
});
