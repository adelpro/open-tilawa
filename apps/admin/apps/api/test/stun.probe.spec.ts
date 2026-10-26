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
