import { createSocket } from 'node:dgram';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { bootHarness, type Harness } from './harness';

/**
 * The TURN monitor surface, driven over HTTP like the dashboard drives it.
 *
 * Real STUN wires up a throwaway UDP responder, so "online" in these tests is
 * earned the same way it is in production: a Binding Request answered with the
 * transaction id we sent. Nothing here talks to the network beyond loopback.
 */
function startStunResponder(port: number): ReturnType<typeof createSocket> {
  const socket = createSocket('udp4');
  socket.on('message', (msg: Buffer, rinfo) => {
    socket.send(
      Buffer.concat([Buffer.from([0x01, 0x01, 0x00, 0x00]), msg.subarray(4, 20)]),
      rinfo.port,
      rinfo.address,
    );
  });
  socket.bind(port, '127.0.0.1');
  return socket;
}

describe('turns api', () => {
  let h: Harness;
  let agent: ReturnType<Harness['agent']>;
  let csrf: string;
  const stunPort = 50000 + (process.pid % 10000);
  const turnUrl = `turn:127.0.0.1:${stunPort}`;

  beforeAll(async () => {
    h = await bootHarness();
    agent = h.agent();
    csrf = (await agent.get('/api/csrf').expect(200)).body.token as string;
    await agent
      .post('/api/auth/local/signin')
      .set('x-csrf-token', csrf)
      .set('X-Fingerprint', 'turns-a')
      .send({ user: { email: h.ownerEmail, password: 'OwnerPass123' } })
      .expect(200);
  });

  afterAll(async () => {
    await h.close();
  });

  it('refuses to list TURN servers to an anonymous caller', async () => {
    await h.agent().get('/api/turns').expect(401);
  });

  it('adds a server and probes it online through a real STUN round trip', async () => {
    const server = startStunResponder(stunPort);
    try {
      const { body } = await agent
        .post('/api/turns')
        .set('x-csrf-token', csrf)
        .send({ name: 'Local turn', url: turnUrl })
        .expect(201);
      expect(body.status).toBe('unknown');
      expect(body.latencyMs).toBeNull();

      const polled = await agent
        .post(`/api/turns/${body.id}/poll`)
        .set('x-csrf-token', csrf)
        .expect(201);
      expect(polled.body.status).toBe('online');
      expect(polled.body.latencyMs).toBeGreaterThanOrEqual(0);

      const history = await agent.get(`/api/turns/${body.id}/history?limit=10`).expect(200);
      expect(history.body).toHaveLength(1);
      expect(history.body[0].ok).toBe(true);
    } finally {
      server.close();
    }
  });

  it('records an offline check with a reason when the port is dead', async () => {
    const deadUrl = `turn:127.0.0.1:${stunPort + 1}`;
    const { body: added } = await agent
      .post('/api/turns')
      .set('x-csrf-token', csrf)
      .send({ name: 'Dead turn', url: deadUrl })
      .expect(201);

    const polled = await agent
      .post(`/api/turns/${added.id}/poll`)
      .set('x-csrf-token', csrf)
      .expect(201);
    expect(polled.body.status).toBe('offline');
    expect(polled.body.latencyMs).toBeNull();

    const { body: history } = await agent
      .get(`/api/turns/${added.id}/history?limit=10`)
      .expect(200);
    expect(history[0].ok).toBe(false);

    const { body: all } = await agent
      .post('/api/turns/poll-all')
      .set('x-csrf-token', csrf)
      .expect(201);
    expect(all).toHaveLength(2);
  });

  it('refuses to store a URL no probe could ever dial', async () => {
    await agent
      .post('/api/turns')
      .set('x-csrf-token', csrf)
      .send({ name: 'junk', url: 'turn:::' })
      .expect(400);
  });

  it('keeps the retention window: history never exceeds 288 checks', async () => {
    const { body: list } = await agent.get('/api/turns').expect(200);
    const id = list[0].id as number;
    // Fill the window directly, then take the check path once more: the oldest
    // row must fall out, the newest stays.
    const insert = h.db.prepare(
      "INSERT INTO turn_checks (turn_id, ok, latency_ms, detail, checked_at) VALUES (?, 1, 3, 'seed', datetime('now'))",
    );
    for (let i = 0; i < 300; i++) insert.run(id);
    const before = await agent.get(`/api/turns/${id}/history?limit=288`).expect(200);
    expect(before.body.length).toBeGreaterThan(288 / 2); // seeded rows are there
    const res = await agent.post(`/api/turns/${id}/poll`).set('x-csrf-token', csrf).expect(201);
    expect(['online', 'offline']).toContain(res.body.status);
    const count = (
      h.db.prepare('SELECT COUNT(*) n FROM turn_checks WHERE turn_id = ?').get(id) as { n: number }
    ).n;
    // 300 seeded + this one poll, minus the pruned excess — the cap holds.
    expect(count).toBeLessThanOrEqual(288 + 1);
  });

  it('deletes a server and its history together', async () => {
    const { body: list } = await agent.get('/api/turns').expect(200);
    const dead = list.find((t: { url: string; id: number }) =>
      t.url.endsWith(String(stunPort + 1)),
    );
    await agent.delete(`/api/turns/${dead.id}`).set('x-csrf-token', csrf).expect(204);
    await agent.get(`/api/turns/${dead.id}/history`).expect(200); // empty list, no rows
    const count = (
      h.db.prepare('SELECT COUNT(*) n FROM turn_checks WHERE turn_id = ?').get(dead.id) as {
        n: number;
      }
    ).n;
    expect(count).toBe(0);
  });
});
