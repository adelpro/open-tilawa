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
  options: { user?: string; headroom?: number; peers?: boolean; selfUpdate?: boolean } = {},
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
        JSON.stringify({
          status: 'ok',
          service: 'tilawa-seeder',
          version: '1.2.0',
          sha: 'abc123',
          disk: { free: 40 * 1024 ** 3, total: 100 * 1024 ** 3 },
          quotaBytes: 60 * 1024 ** 3,
          usedBytes: 20 * 1024 ** 3,
          headroomBytes: options.headroom ?? 35 * 1024 ** 3,
          torrents: 2,
          peers: 5,
          uploadSpeed: 10,
          downloadSpeed: 2,
          // The capability the console keys its update button off.
          selfUpdate: options.selfUpdate === true,
        }),
      );
      return;
    }
    if (req.url === '/api/update') {
      if (decoded !== `${user}:${pass}`) {
        res.writeHead(401).end('Unauthorized');
        return;
      }
      if (req.method === 'POST') {
        if (options.selfUpdate !== true) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'self-update is not enabled on this node' }));
          return;
        }
        seen.push('update');
        // The real node answers before it starts and then recreates itself. The
        // stand-in answers as a node that already finished, which is the state
        // the console's wait loop is looking for.
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ started: true }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          enabled: options.selfUpdate === true,
          running: false,
          error: null,
          at: null,
        }),
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
    if (req.url === '/api/peers' && req.method === 'GET') {
      if (decoded !== `${user}:${pass}`) {
        res.writeHead(401).end('Unauthorized');
        return;
      }
      // A node built before this endpoint: the console must explain it rather
      // than report "the seeder answered with a non-JSON body".
      if (options.peers === false) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html>not found</html>');
        return;
      }
      seen.push('peers');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          total: 2,
          web: 1,
          tcp: 1,
          inbound: 1,
          outbound: 0,
          torrents: [
            {
              infoHash: 'abc123',
              name: 'al-fatiha',
              total: 2,
              web: 1,
              tcp: 1,
              inbound: 1,
              outbound: 0,
              truncated: false,
              peers: [
                {
                  type: 'web',
                  direction: null,
                  address: null,
                  uploadSpeed: 512,
                  downloadSpeed: 0,
                  uploaded: 1024,
                  downloaded: 0,
                },
                {
                  type: 'tcp',
                  direction: 'in',
                  // Already masked by the node: the console never sees a whole one.
                  address: '203.0.113.x',
                  uploadSpeed: 0,
                  downloadSpeed: 0,
                  uploaded: 0,
                  downloaded: 0,
                },
              ],
            },
          ],
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
  let fakeHtml: Awaited<ReturnType<typeof fakeSeeder>>;
  let fakeC: Awaited<ReturnType<typeof fakeSeeder>>;

  beforeAll(async () => {
    fake = await fakeSeeder();
    fakeB = await fakeSeeder();
    fakeHtml = await fakeSeeder();
    fakeC = await fakeSeeder();
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
    fakeHtml.server.close();
    fakeC.server.close();
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

  it('proxies the live peer report, masked at the node', async () => {
    const { body } = await agent.get(`/api/seeders/${seederId}/peers`).expect(200);
    expect(body.total).toBe(2);
    expect(body.torrents[0].peers[0]).toMatchObject({ type: 'web', direction: null });
    // The address arrived masked and stays that way: nothing here re-expands it.
    expect(body.torrents[0].peers[1].address).toBe('203.0.113.x');
    expect(fake.seen).toContain('peers');
  });

  it('explains a node whose seeder predates the peer report', async () => {
    const old = await fakeSeeder({ peers: false });
    try {
      const { body } = await agent
        .post('/api/seeders')
        .set('x-csrf-token', csrf)
        .send({ name: 'node-old', url: old.url, adminUser: 'adm', adminPass: 'secret-pass' })
        .expect(201);
      const res = await agent.get(`/api/seeders/${body.id}/peers`).expect(502);
      expect(res.body.message).toContain('does not report connected peers');
    } finally {
      old.server.close();
    }
  });

  it('keeps whether a node updates itself, and refuses the ones that do not', async () => {    const capable = await fakeSeeder({ selfUpdate: true });
    const stuck = await fakeSeeder({ selfUpdate: false });
    try {
      const mine = await agent
        .post('/api/seeders')
        .set('x-csrf-token', csrf)
        .send({ name: 'node-self', url: capable.url, adminUser: 'adm', adminPass: 'secret-pass' })
        .expect(201);
      const other = await agent
        .post('/api/seeders')
        .set('x-csrf-token', csrf)
        .send({ name: 'node-manual', url: stuck.url, adminUser: 'adm', adminPass: 'secret-pass' })
        .expect(201);
      await agent.post(`/api/seeders/${mine.body.id}/poll`).set('x-csrf-token', csrf).expect(201);
      await agent.post(`/api/seeders/${other.body.id}/poll`).set('x-csrf-token', csrf).expect(201);

      const fleet = (await agent.get('/api/seeders').expect(200)).body as {
        id: number;
        selfUpdate: boolean;
      }[];
      expect(fleet.find((row) => row.id === mine.body.id)?.selfUpdate).toBe(true);
      expect(fleet.find((row) => row.id === other.body.id)?.selfUpdate).toBe(false);

      const refused = await agent
        .post(`/api/seeders/${other.body.id}/update`)
        .set('x-csrf-token', csrf)
        .expect(400);
      expect(refused.body.message).toContain('does not update itself');
    } finally {
      capable.server.close();
      stuck.server.close();
    }
  });

  it('stores the auto-update switch, off by default', async () => {
    const own = await fakeSeeder({ selfUpdate: true });
    try {
      const { body } = await agent
        .post('/api/seeders')
        .set('x-csrf-token', csrf)
        .send({ name: 'node-auto', url: own.url, adminUser: 'adm', adminPass: 'secret-pass' })
        .expect(201);
      // The default is the whole point: nobody gets unattended restarts by accident.
      expect(body.autoUpdate).toBe(false);

      const on = await agent
        .patch(`/api/seeders/${body.id}`)
        .set('x-csrf-token', csrf)
        .send({ autoUpdate: true })
        .expect(200);
      expect(on.body.autoUpdate).toBe(true);

      const fleet = (await agent.get('/api/seeders').expect(200)).body as {
        id: number;
        autoUpdate: boolean;
      }[];
      expect(fleet.find((row) => row.id === body.id)?.autoUpdate).toBe(true);

      const off = await agent
        .patch(`/api/seeders/${body.id}`)
        .set('x-csrf-token', csrf)
        .send({ autoUpdate: false })
        .expect(200);
      expect(off.body.autoUpdate).toBe(false);
    } finally {
      own.server.close();
    }
  });

  it('asks a self-updating node, then waits for it to come back', async () => {
    const capable = await fakeSeeder({ selfUpdate: true });
    try {
      const { body } = await agent
        .post('/api/seeders')
        .set('x-csrf-token', csrf)
        .send({ name: 'node-run', url: capable.url, adminUser: 'adm', adminPass: 'secret-pass' })
        .expect(201);
      await agent.post(`/api/seeders/${body.id}/poll`).set('x-csrf-token', csrf).expect(201);

      await agent.post(`/api/seeders/${body.id}/update`).set('x-csrf-token', csrf).expect(202);

      // The request only asks. The row is what says it finished, so this waits the
      // way the screen does rather than assuming the POST did the work.
      let row: { updating: boolean; updateError: string | null } | undefined;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const fleet = (await agent.get('/api/seeders').expect(200)).body as {
          id: number;
          updating: boolean;
          updateError: string | null;
        }[];
        row = fleet.find((entry) => entry.id === body.id);
        if (row && row.updating === false) break;
      }
      expect(capable.seen).toContain('update');
      expect(row?.updating).toBe(false);
      expect(row?.updateError).toBeNull();
    } finally {
      capable.server.close();
    }
  }, 30000);

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

  it('adds credentials to a row that has none, then clears them again', async () => {
    // Register without credentials, as the pre-upgrade production row was.
    const { body } = await agent
      .post('/api/seeders')
      .set('x-csrf-token', csrf)
      .send({ name: 'node-4', url: fakeC.url })
      .expect(201);
    expect(body.hasCredentials).toBe(false);

    const refused = await agent.get(`/api/seeders/${body.id}/torrents`).expect(502);
    expect(refused.body.message).toContain('no credentials stored');

    const patched = await agent
      .patch(`/api/seeders/${body.id}`)
      .set('x-csrf-token', csrf)
      .send({ adminUser: 'adm', adminPass: 'secret-pass' })
      .expect(200);
    expect(patched.body.hasCredentials).toBe(true);
    // And the proxy now works — no delete-and-recreate needed.
    await agent.get(`/api/seeders/${body.id}/torrents`).expect(200);

    const cleared = await agent
      .patch(`/api/seeders/${body.id}`)
      .set('x-csrf-token', csrf)
      .send({ adminUser: null, adminPass: null })
      .expect(200);
    expect(cleared.body.hasCredentials).toBe(false);
  });

  it('refuses a URL that is not http(s)', async () => {
    await agent
      .post('/api/seeders')
      .set('x-csrf-token', csrf)
      .send({ name: 'junk', url: 'file:///etc/passwd' })
      .expect(400);
  });

  it('refuses to patch a row that does not exist', async () => {
    await agent
      .patch('/api/seeders/9999')
      .set('x-csrf-token', csrf)
      .send({ name: 'ghost' })
      .expect(404);
  });

  it('answers a non-JSON upstream with a gateway error, not a 500', async () => {
    const { body } = await agent
      .post('/api/seeders')
      .set('x-csrf-token', csrf)
      .send({
        name: 'node-html',
        url: `${fakeHtml.url}/html`,
        adminUser: 'adm',
        adminPass: 'secret-pass',
      })
      .expect(201);
    const res = await agent.get(`/api/seeders/${body.id}/torrents`).expect(502);
    expect(res.body.message).toContain('non-JSON');
  });

  it('refuses a proxy mutation that carries no CSRF header', async () => {
    await agent
      .post(`/api/seeders/${seederId}/torrents`)
      .send({ magnet: 'magnet:?xt=urn:btih:def456' })
      .expect(403);
  });

  it('refuses the ops surface to a plain user account', async () => {
    await h.seedUser({
      name: 'Viewer',
      email: 'viewer@example.com',
      password: 'Password123',
      role: 'user',
    });
    const viewer = h.agent();
    const token = (await viewer.get('/api/csrf').expect(200)).body.token as string;
    await viewer
      .post('/api/auth/local/signin')
      .set('x-csrf-token', token)
      .set('X-Fingerprint', 'viewer-a')
      .send({ user: { email: 'viewer@example.com', password: 'Password123' } })
      .expect(200);
    await viewer.get('/api/seeders').expect(403);
    await viewer.get('/api/turns').expect(403);
    await viewer.get('/api/reciters').expect(403);
  });

  it('keeps the version and disk space the node reports', async () => {
    await agent.post(`/api/seeders/${seederId}/poll`).set('x-csrf-token', csrf).expect(201);
    const { body } = await agent.get('/api/seeders').expect(200);
    const row = body.find((s: { id: number }) => s.id === seederId);
    expect(row.version).toBe('1.2.0');
    expect(row.sha).toBe('abc123');
    expect(row.freeBytes).toBe(40 * 1024 ** 3);
    expect(row.totalBytes).toBe(100 * 1024 ** 3);
    expect(row.quotaBytes).toBe(60 * 1024 ** 3);
    expect(row.usedBytes).toBe(20 * 1024 ** 3);
    expect(row.headroomBytes).toBe(35 * 1024 ** 3);
  });

  it('refuses to update a node that cannot update itself', async () => {
    const res = await agent
      .post(`/api/seeders/${seederId}/update`)
      .set('x-csrf-token', csrf)
      .expect(400);
    expect(res.body.message).toContain('does not update itself');
    await agent.post('/api/seeders/9999/update').set('x-csrf-token', csrf).expect(404);
  });

  it('refuses to update the host node unless the deployment enabled it', async () => {
    // The pinned node is the one whose URL host is SEEDER_SERVICE — the container
    // this console runs in. No request reaches it: the capability check comes
    // before the job starts.
    const { body } = await agent
      .post('/api/seeders')
      .set('x-csrf-token', csrf)
      .send({ name: 'self', url: 'http://seeder:8085' })
      .expect(201);
    const res = await agent
      .post(`/api/seeders/${body.id}/update`)
      .set('x-csrf-token', csrf)
      .expect(503);
    expect(res.body.message).toContain('SEEDER_UPDATE');
  });

  it('plans and applies a catalogue push without removing anything', async () => {
    // abc123 is already on the fake node; def456 is not.
    for (const [name, infohash] of [
      ['Al-Fatiha', 'abc123'],
      ['Al-Baqara', 'def456'],
    ]) {
      await agent
        .post('/api/reciters')
        .set('x-csrf-token', csrf)
        .send({
          name,
          riwaya: 'Hafs',
          infohash,
          magnet: `magnet:?xt=urn:btih:${infohash}`,
          fileCount: 114,
        })
        .expect(201);
    }

    const plan = await agent
      .post('/api/reciters/push/plan')
      .set('x-csrf-token', csrf)
      .send({ nodeIds: [seederId] })
      .expect(200);
    expect(plan.body.catalogue).toBe(2);
    const node = plan.body.nodes[0];
    expect(node.seederId).toBe(seederId);
    expect(node.skipReason).toBeNull();
    expect(node.toAdd.map((r: { infohash: string }) => r.infohash)).toEqual(['def456']);

    const applied = await agent
      .post('/api/reciters/push')
      .set('x-csrf-token', csrf)
      .send({ nodeIds: [seederId] })
      .expect(202);
    expect(applied.body.applied[0].added).toBe(1);
    // The add reached the node with the catalogue's magnet.
    expect(fake.seen.some((entry) => entry.includes('magnet:?xt=urn:btih:def456'))).toBe(true);
  });

  it('skips an offline node and reports why', async () => {
    const { body } = await agent
      .post('/api/seeders')
      .set('x-csrf-token', csrf)
      .send({ name: 'node-offline', url: 'http://127.0.0.1:2', adminUser: 'a', adminPass: 'b' })
      .expect(201);
    await agent.post(`/api/seeders/${body.id}/poll`).set('x-csrf-token', csrf).expect(201);

    const plan = await agent
      .post('/api/reciters/push/plan')
      .set('x-csrf-token', csrf)
      .send({ nodeIds: [body.id] })
      .expect(200);
    expect(plan.body.nodes[0].skipReason).toBe('offline');
    expect(plan.body.nodes[0].toAdd).toEqual([]);
  });

  it('skips a node whose own headroom is exhausted', async () => {
    const full = await fakeSeeder({ headroom: 0 });
    try {
      const { body } = await agent
        .post('/api/seeders')
        .set('x-csrf-token', csrf)
        .send({ name: 'node-full', url: full.url, adminUser: 'adm', adminPass: 'secret-pass' })
        .expect(201);
      await agent.post(`/api/seeders/${body.id}/poll`).set('x-csrf-token', csrf).expect(201);

      const plan = await agent
        .post('/api/reciters/push/plan')
        .set('x-csrf-token', csrf)
        .send({ nodeIds: [body.id] })
        .expect(200);
      expect(plan.body.nodes[0].skipReason).toBe('low_space');
      expect(plan.body.nodes[0].detail).toContain('no headroom');
    } finally {
      full.server.close();
    }
  });

  it('fills sizes from a node inventory and is idempotent', async () => {
    // The fake node holds one torrent (abc123, 1024 bytes); earlier tests put
    // that infohash in the catalogue without a size, so import sizes it.
    const res = await agent
      .post('/api/reciters/import')
      .set('x-csrf-token', csrf)
      .send({ seederId })
      .expect(200);
    expect(res.body.sized).toBe(1);
    expect(res.body.added).toBe(0);
    const { body: catalogue } = await agent.get('/api/reciters').expect(200);
    const imported = catalogue.find((r: { infohash: string }) => r.infohash === 'abc123');
    expect(imported.sizeBytes).toBe(1024);
    const again = await agent
      .post('/api/reciters/import')
      .set('x-csrf-token', csrf)
      .send({ seederId })
      .expect(200);
    expect(again.body.added).toBe(0);
    expect(again.body.sized).toBe(0);
  });

  it('edits a reciter row, including the size learned from a node', async () => {
    const { body } = await agent
      .post('/api/reciters')
      .set('x-csrf-token', csrf)
      .send({
        name: 'Half Known',
        riwaya: 'Hafs',
        infohash: 'fff000',
        magnet: 'magnet:?xt=urn:btih:fff000',
        fileCount: 10,
      })
      .expect(201);
    expect(body.sizeBytes).toBeNull();

    const patched = await agent
      .patch(`/api/reciters/${body.id}`)
      .set('x-csrf-token', csrf)
      .send({ name: 'Fully Known', sizeBytes: 5 * 1024 ** 3 })
      .expect(200);
    expect(patched.body.name).toBe('Fully Known');
    expect(patched.body.sizeBytes).toBe(5 * 1024 ** 3);

    await agent
      .patch(`/api/reciters/${body.id}`)
      .set('x-csrf-token', csrf)
      .send({ name: ' ' })
      .expect(400);
    await agent
      .patch('/api/reciters/9999')
      .set('x-csrf-token', csrf)
      .send({ name: 'x' })
      .expect(404);
  });

  it('deletes a reciter from the catalogue, and from the nodes when asked', async () => {
    const { body } = await agent
      .post('/api/reciters')
      .set('x-csrf-token', csrf)
      .send({
        name: 'To Purge',
        riwaya: 'Hafs',
        infohash: 'abc123',
        magnet: 'magnet:?xt=urn:btih:abc123',
        fileCount: 1,
      })
      .expect(201);

    const purged = await agent
      .delete(`/api/reciters/${body.id}?purge=all`)
      .set('x-csrf-token', csrf)
      .expect(200);
    expect(purged.body.removed).toBe(true);
    expect(purged.body.nodes[0]).toMatchObject({ seederId, removed: true, error: null });
    // The fake node saw the DELETE for that infohash.
    expect(fake.seen.some((entry) => entry === 'delete:abc123')).toBe(true);

    const catalogue = (await agent.get('/api/reciters').expect(200)).body as { id: number }[];
    expect(catalogue.some((row) => row.id === body.id)).toBe(false);
  });

  it('keeps the nodes untouched when the purge is not requested', async () => {
    const { body } = await agent
      .post('/api/reciters')
      .set('x-csrf-token', csrf)
      .send({
        name: 'Catalogue Only',
        riwaya: 'Hafs',
        infohash: 'def456',
        magnet: 'magnet:?xt=urn:btih:def456',
        fileCount: 1,
      })
      .expect(201);
    const before = fake.seen.length;
    await agent.delete(`/api/reciters/${body.id}`).set('x-csrf-token', csrf).expect(200);
    // No new seeder call was made.
    expect(fake.seen.length).toBe(before);
  });
});
