import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describePeers, maskAddress, MAX_PEERS_PER_TORRENT } from '../lib/peers.mjs';

/**
 * Connected peers, shaped for the console.
 *
 * Two rules make this worth its own tests. The first is privacy: a peer is a
 * listener, so the address that leaves the node is a masked prefix and never the
 * address itself. The second is honesty: a WebRTC peer has no meaningful port
 * direction, so it must read as "unknown" rather than be guessed at.
 */

function wire(overrides = {}) {
  const rate = (value) => () => value;
  return {
    type: 'tcpOutgoing',
    remoteAddress: '203.0.113.7',
    remotePort: 51413,
    uploadSpeed: rate(1200),
    downloadSpeed: rate(0),
    uploaded: 4096,
    downloaded: 0,
    ...overrides,
  };
}

function torrent(overrides = {}) {
  return { infoHash: 'abc123', name: 'al-fatiha', wires: [], ...overrides };
}

test('an IPv4 address leaves one octet short of identifying a household', () => {
  assert.equal(maskAddress('203.0.113.7'), '203.0.113.x');
  assert.equal(maskAddress(' 10.0.0.1 '), '10.0.0.x');
});

test('an IPv6 address keeps its prefix and drops the interface', () => {
  assert.equal(maskAddress('2a01:4f8:1:2::3'), '2a01:4f8:1::');
  assert.equal(maskAddress('fe80::1'), 'fe80::');
});

test('an address it cannot mask is reported as unknown, not verbatim', () => {
  for (const value of ['', null, undefined, 'localhost', '203.0.113', '::ffff:not-an-ip', 42]) {
    assert.equal(maskAddress(value), null, `expected null for ${String(value)}`);
  }
});

test('an IPv4 peer carried on a dual-stack socket is still an IPv4 peer', () => {
  // Node reports a v4 connection on a dual-stack listener as `::ffff:a.b.c.d`,
  // which is the shape most peers arrive in — and the one that used to read as
  // "address unknown".
  assert.equal(maskAddress('::ffff:203.0.113.7'), '203.0.113.x');
  assert.equal(maskAddress('[::ffff:198.51.100.9]:51413'.split(']')[0].slice(1)), '198.51.100.x');
});

test('no full address survives into the report', () => {
  const report = describePeers([
    torrent({
      wires: [wire(), wire({ type: 'tcpIncoming', remoteAddress: '198.51.100.42' })],
    }),
  ]);
  const text = JSON.stringify(report);
  assert.equal(text.includes('203.0.113.7'), false);
  assert.equal(text.includes('198.51.100.42'), false);
  assert.equal(text.includes('203.0.113.x'), true);
});

test('a WebRTC peer has no direction: the browser dialled the tracker, not a port', () => {
  const report = describePeers([
    torrent({
      wires: [
        wire({
          type: 'webrtc',
          remoteAddress: undefined,
          remotePort: undefined,
        }),
      ],
    }),
  ]);
  const peer = report.torrents[0].peers[0];
  assert.equal(peer.type, 'web');
  assert.equal(peer.direction, null);
  assert.equal(peer.address, null);
});

test('type and direction are separate facts', () => {
  const report = describePeers([
    torrent({
      wires: [
        wire({ type: 'tcpIncoming' }),
        wire({ type: 'tcpOutgoing' }),
        wire({ type: 'webrtc' }),
        wire({ type: 'webSeed' }),
      ],
    }),
  ]);
  assert.deepEqual(
    report.torrents[0].peers.map((peer) => [peer.type, peer.direction]),
    [
      ['tcp', 'in'],
      ['tcp', 'out'],
      ['web', null],
      ['other', null],
    ],
  );
});

test('a uTP peer is a torrent peer, not an unknown one', () => {
  // WebTorrent opens uTP (UDP) sockets by default, so on a real node most peers
  // arrive as utpIncoming/utpOutgoing. Bucketing those as "other" hid exactly
  // the traffic the screen exists to show.
  const report = describePeers([
    torrent({ wires: [wire({ type: 'utpIncoming' }), wire({ type: 'utpOutgoing' })] }),
  ]);
  assert.deepEqual(
    report.torrents[0].peers.map((peer) => [peer.type, peer.direction]),
    [
      ['tcp', 'in'],
      ['tcp', 'out'],
    ],
  );
  assert.equal(report.tcp, 2);
  assert.equal(report.inbound + report.outbound, 2);
});

test('the node totals count every torrent', () => {
  const report = describePeers([
    torrent({
      wires: [wire({ type: 'tcpIncoming' }), wire({ type: 'webrtc' })],
    }),
    torrent({ infoHash: 'def456', wires: [wire({ type: 'tcpOutgoing' })] }),
  ]);
  assert.deepEqual(
    {
      total: report.total,
      web: report.web,
      tcp: report.tcp,
      inbound: report.inbound,
      outbound: report.outbound,
    },
    { total: 3, web: 1, tcp: 2, inbound: 1, outbound: 1 },
  );
});

test('a swarm is not a directory: the list is capped, the counts are not', () => {
  const wires = Array.from({ length: MAX_PEERS_PER_TORRENT + 7 }, () => wire());
  const report = describePeers([torrent({ wires })]);
  const group = report.torrents[0];
  assert.equal(group.peers.length, MAX_PEERS_PER_TORRENT);
  assert.equal(group.truncated, true);
  assert.equal(group.total, MAX_PEERS_PER_TORRENT + 7);
});

test('an empty node answers with zeros rather than nothing', () => {
  assert.deepEqual(describePeers([]), {
    total: 0,
    web: 0,
    tcp: 0,
    inbound: 0,
    outbound: 0,
    torrents: [],
  });
});

test('a wire without a throughput function still yields a number', () => {
  const report = describePeers([
    torrent({ wires: [wire({ uploadSpeed: undefined, uploaded: undefined })] }),
  ]);
  const peer = report.torrents[0].peers[0];
  assert.equal(peer.uploadSpeed, 0);
  assert.equal(peer.uploaded, 0);
});
