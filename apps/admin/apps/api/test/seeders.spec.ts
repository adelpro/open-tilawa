import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { bootHarness, type Harness } from './harness';

/**
 * The seeder proxy, driven over HTTP.
 *
 * A local stand-in seeder speaks the real admin API (Basic auth, GET/POST
 * /api/torrents, DELETE by infohash, /api/files) so this suite proves the proxy
 * contract — including that the stored password is used but never returned.
 */
function fakeSeeder(
  options: { user?: string } = {},
): Promise<{ url: string; server: Server; seen: string[] }> {
  const user = options.user ?? 'adm';
  const pass = 'secret-pass';
  const seen: string[] = [];
  const server = createServer((req, res) => {
    const auth = req.headers.authorization ?? '';
    const decoded = auth.startsWith('Basic ')
      ? Buffer.from(auth.slice(6), 'base64').toString()
      : '';
    if (decodeURIComponent(req.url ?? '').startsWith('/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ status: 'ok', torrents: 2, peers: 5, uploadSpeed: 10, downloadSpeed: 2 }),
      );
      return;
    }
    if (req.url === '/api/torrents' && req.method === 'GET') {
      if (decoded !== `${user}:${pass}`) {
        res.writeHead(401).end('Unauthorized');
        return;
      }
      seen.push('inventory');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          torrents: [
            {
              name: 'al-fatiha',
              infoHash: 'abc123',
              size: 1024,
              progress: '100.00',
              peers: 3,
              uploadSpeed: 1,
              downloadSpeed: 0,
              uploaded: 10,
              downloaded: 1024,
              files: 2,
              done: true,
            },
          ],
          stats: { totalTorrents: 1, totalPeers: 3, uploadSpeed: 1, downloadSpeed: 0 },
        }),
      );
      return;
    }
    if (req.url === '/api/torrents' && req.method === 'POST') {
      if (decoded !== `${user}:${pass}`) {
        res.writeHead(401).end('Unauthorized');
        return;
      }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen.push(`add:${body}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, name: 'al-baqara', infoHash: 'def456' }));
      });
      return;
    }
    if (req.url?.startsWith('/api/torrents/') && req.method === 'DELETE') {
      const hash = req.url.split('/').pop();
      if (decoded !== `${user}:${pass}`) {
        res.writeHead(401).end('Unauthorized');
        return;
      }
      if (hash !== 'abc123') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
        return;
      }
      seen.push(`delete:${hash}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url === '/api/files' && req.method === 'GET') {
      if (decoded !== `${user}:${pass}`) {
        res.writeHead(401).end('Unauthorized');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: ['al-fatiha.torrent'] }));
      return;
    }
    res.writeHead(404).end('nope');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, server, seen });
    });
  });
}

describe('seeder proxy', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;
  let csrf: string;
  let seederId: number;
  let fake: Awaited<ReturnType<typeof fakeSeeder>>;
  let fakeB: Awaited<ReturnType<typeof fakeSeeder>>;

  beforeAll(async () => {
    fake = await fakeSeeder();
    fakeB = await fakeSeeder();
    h = await bootHarness();
    agent = h.agent();
    csrf = (await agent.get('/api/csrf').expect(200)).body.token as string;
    await agent
      .post('/api/auth/local/signin')
      .set('x-csrf-token', csrf)
      .set('X-Fingerprint', 'seeder-a')
      .send({ user: { email: h.ownerEmail, password: 'OwnerPass123' } })
      .expect(200);
    const { body } = await agent
      .post('/api/seeders')
      .set('x-csrf-token', csrf)
      .send({ name: 'node-1', url: fake.url, adminUser: 'adm', adminPass: 'secret-pass' })
      .expect(201);
    seederId = body.id as number;
  });

  afterAll(async () => {
    fake.server.close();
    fakeB.server.close();
    await h.close();
  });

  it('never returns the stored password in the seeder list', async () => {
    const { body } = await agent.get('/api/seeders').expect(200);
    expect(body[0].hasCredentials).toBe(true);
    expect(JSON.stringify(body)).not.toContain('secret-pass');
  });

  it('proxies the inventory through the row credentials', async () => {
    const { body } = await agent.get(`/api/seeders/${seederId}/torrents`).expect(200);
    expect(body.torrents[0].infoHash).toBe('abc123');
    expect(body.stats.totalPeers).toBe(3);
  });

  it('forwards an add request and reports the new infohash', async () => {
    const { body } = await agent
      .post(`/api/seeders/${seederId}/torrents`)
      .set('x-csrf-token', csrf)
      .send({ magnet: 'magnet:?xt=urn:btih:def456' })
      .expect(201);
    expect(body).toMatchObject({ ok: true, infoHash: 'def456' });
  });

  it('deletes by infohash and maps the seeder 404 to its own', async () => {
    await agent
      .delete(`/api/seeders/${seederId}/torrents/abc123`)
      .set('x-csrf-token', csrf)
      .expect(204);
    await agent
      .delete(`/api/seeders/${seederId}/torrents/zzz999`)
      .set('x-csrf-token', csrf)
      .expect(404);
  });

  it('lists the torrent files available on the node', async () => {
    const { body } = await agent.get(`/api/seeders/${seederId}/files`).expect(200);
    expect(body.files).toEqual(['al-fatiha.torrent']);
  });

  it('explains a credential mismatch instead of leaking the seeder answer', async () => {
    const { body } = await agent
      .post('/api/seeders')
      .set('x-csrf-token', csrf)
      .send({ name: 'node-2', url: fakeB.url, adminUser: 'adm', adminPass: 'wrong-pass' })
      .expect(201);
    const res = await agent.get(`/api/seeders/${body.id}/torrents`).expect(502);
    expect(res.body.message).toContain('refused the stored credentials');
  });

  it('reports an unreachable seeder as a gateway failure', async () => {
    const { body } = await agent
      .post('/api/seeders')
      .set('x-csrf-token', csrf)
      .send({ name: 'node-3', url: 'http://127.0.0.1:1', adminUser: 'a', adminPass: 'b' })
      .expect(201);
    await agent.get(`/api/seeders/${body.id}/torrents`).expect(502);
  });
});
