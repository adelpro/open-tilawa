import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { stunProbe } from '../src/turns/stun.probe';

/**
 * A minimal STUN server for the wire format the probe exercises.
 *
 * It is not a TURN stack: it reads the RFC 5389 transaction id from a Binding
 * Request and answers the Binding Success (XOR-MAPPED-ADDRESS) the probe's
 * parser expects. That is exactly the round trip a deployment check needs —
 * the probe proves the UDP path and its latency, not relay credentials.
 */
function stunResponder(port: number, opts: { drop?: boolean } = {}): Socket {
  const socket = createSocket('udp4');
  socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
    if (opts.drop) return;
    // header: Binding Success, zero length, then the echoed magic cookie + txid
    socket.send(
      Buffer.concat([Buffer.from([0x01, 0x01, 0x00, 0x00]), msg.subarray(4, 20)]),
      rinfo.port,
      rinfo.address,
    );
  });
  socket.bind(port);
  return socket;
}

describe('stun probe', () => {
  let server: Socket;
  const port = 53471;

  beforeAll(() => {
    server = stunResponder(port);
  });

  afterAll(() => {
    server.close();
  });

  it('gets a latency from a live TURN port', async () => {
    const probe = await stunProbe({ host: '127.0.0.1', port, timeoutMs: 3000 });
    expect(probe.ok).toBe(true);
    expect(probe.latencyMs).toBeGreaterThanOrEqual(0);
    expect(probe.latencyMs).toBeLessThan(3000);
  });

  it('reports offline with a reason for a dead port', async () => {
    const closed = 53472; // nothing listens here
    const probe = await stunProbe({ host: '127.0.0.1', port: closed, timeoutMs: 1000 });
    expect(probe.ok).toBe(false);
    expect(probe.errorText).toBeTruthy();
  });

  it('understands a full turn: URL', async () => {
    const probe = await stunProbe({
      host: '127.0.0.1',
      port,
      timeoutMs: 3000,
      url: `turn:test.example:${port}`,
    });
    expect(probe.ok).toBe(true);
  });

  it('honours the timeout against a black hole host', async () => {
    // RFC 5737 documentation address: routable-looking, guaranteed unanswered.
    const started = Date.now();
    const probe = await stunProbe({ host: '192.0.2.1', port: 3478, timeoutMs: 800 });
    expect(probe.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe('stun probe robustness', () => {
  it('survives a short, malformed reply and reports offline', async () => {
    // A misconfigured node with something else on the port can answer anything.
    // Before the guard, a reply shorter than a header threw a RangeError inside
    // the socket listener — an uncaught exception that took the API down.
    const junk = createSocket('udp4');
    junk.on('message', (_msg, rinfo) => junk.send(Buffer.from([0x01]), rinfo.port, rinfo.address));
    await new Promise<void>((resolve) => junk.bind(53473, '127.0.0.1', () => resolve()));
    try {
      const probe = await stunProbe({ host: '127.0.0.1', port: 53473, timeoutMs: 600 });
      expect(probe.ok).toBe(false);
      expect(probe.errorText).toBe('timeout');
    } finally {
      junk.close();
    }
  });

  it('ignores a reply with a foreign transaction id', async () => {
    const confused = createSocket('udp4');
    confused.on('message', (_msg, rinfo) =>
      confused.send(Buffer.alloc(20, 0).fill(0x01, 0, 2), rinfo.port, rinfo.address),
    );
    await new Promise<void>((resolve) => confused.bind(53474, '127.0.0.1', () => resolve()));
    try {
      const probe = await stunProbe({ host: '127.0.0.1', port: 53474, timeoutMs: 600 });
      expect(probe.ok).toBe(false);
    } finally {
      confused.close();
    }
  });

  it('decodes an IPv6 XOR-MAPPED-ADDRESS without crashing', async () => {
    const v6 = createSocket('udp4');
    v6.on('message', (msg, rinfo) => {
      // header + one XOR-MAPPED-ADDRESS, family 0x02, 16-byte address
      const header = Buffer.concat([
        Buffer.from([0x01, 0x01]),
        Buffer.from([0x00, 0x00]),
        msg.subarray(4, 20),
      ]);
      const attr = Buffer.alloc(24);
      attr.writeUInt16BE(0x0020, 0);
      attr.writeUInt16BE(20, 2);
      attr[4] = 0;
      attr[5] = 0x02;
      attr.writeUInt16BE(rinfo.port ^ 0x2112, 6);
      // XOR the address with the cookie then the transaction id
      const cookie = Buffer.from([0x21, 0x12, 0xa4, 0x42]);
      for (let i = 0; i < 4; i++) attr[8 + i] = cookie[i];
      for (let i = 0; i < 12; i++) attr[12 + i] = msg[8 + i];
      v6.send(Buffer.concat([header, attr]), rinfo.port, rinfo.address);
    });
    await new Promise<void>((resolve) => v6.bind(53475, '127.0.0.1', () => resolve()));
    try {
      const probe = await stunProbe({ host: '127.0.0.1', port: 53475, timeoutMs: 800 });
      expect(probe.ok).toBe(true);
    } finally {
      v6.close();
    }
  });
});
