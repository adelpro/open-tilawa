import { bootHarness, type Harness } from './harness';

/**
 * The status page's own surface: the defaults it seeds, the URL validation and
 * the delete cascade. The checks themselves are not run here — they would call
 * the public internet — but a manual check is exercised against a local server.
 */
describe('status api', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;
  let csrf: string;

  beforeAll(async () => {
    h = await bootHarness();
    agent = h.agent();
    csrf = (await agent.get('/api/csrf').expect(200)).body.token as string;
    await agent
      .post('/api/auth/local/signin')
      .set('x-csrf-token', csrf)
      .set('X-Fingerprint', 'status-a')
      .send({ user: { email: h.ownerEmail, password: 'OwnerPass123' } })
      .expect(200);
  });

  afterAll(async () => {
    await h.close();
  });

  it('seeds the stack it can check', async () => {
    const { body } = await agent.get('/api/status').expect(200);
    const names = body.services.map((service: { name: string }) => service.name);
    expect(names).toEqual(
      expect.arrayContaining(['Public site', 'Tracker', 'Admin API', 'Admin dashboard']),
    );
    expect(body.seeders).toEqual([]);
    expect(body.turns).toEqual([]);
  });

  it('refuses a service that is not an absolute http(s) URL', async () => {
    await agent
      .post('/api/status/services')
      .set('x-csrf-token', csrf)
      .send({ name: 'bad', url: 'file:///etc/passwd' })
      .expect(400);
    await agent
      .post('/api/status/services')
      .set('x-csrf-token', csrf)
      .send({ name: ' ', url: 'https://example.com' })
      .expect(400);
  });

  it('adds, checks against a local server, and removes a service', async () => {
    const http = await import('node:http');
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '9.9.9' }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as import('node:net').AddressInfo;
    try {
      const { body: added } = await agent
        .post('/api/status/services')
        .set('x-csrf-token', csrf)
        .send({ name: 'Local probe', url: `http://127.0.0.1:${address.port}/health` })
        .expect(201);

      const checked = await agent
        .post('/api/status/check')
        .set('x-csrf-token', csrf)
        .expect(200);
      const row = checked.body.services.find((s: { id: number }) => s.id === added.id);
      expect(row.ok).toBe(true);
      expect(row.version).toBe('9.9.9');
      expect(row.latencyMs).toBeGreaterThanOrEqual(0);
      expect(row.timeline).toHaveLength(24);

      await agent
        .delete(`/api/status/services/${added.id}`)
        .set('x-csrf-token', csrf)
        .expect(204);
      const after = await agent.get('/api/status').expect(200);
      expect(after.body.services.some((s: { id: number }) => s.id === added.id)).toBe(false);
    } finally {
      server.close();
    }
  }, 30_000);
});
