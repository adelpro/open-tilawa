/**
 * Who is connected to this node, shaped for the console.
 *
 * A peer here is a listener — a person reciting or listening — so this module is
 * the only place that touches an address, and it never lets a whole one out. The
 * console gets a masked prefix: enough to tell two peers apart, not enough to
 * identify a household. Nothing is stored; the report exists for the length of
 * one request.
 *
 * Direction is a TCP question. A WebRTC peer reached us through the tracker, so
 * "inbound" and "outbound" say nothing about it and are reported as null rather
 * than guessed.
 */

/** How many peers one torrent may list. A swarm is not a directory. */
export const MAX_PEERS_PER_TORRENT = 50;

const EMPTY_COUNTS = { total: 0, web: 0, tcp: 0, inbound: 0, outbound: 0 };

/**
 * `203.0.113.7` -> `203.0.113.x`, `2a01:4f8:1:2::3` -> `2a01:4f8:1::`.
 * Anything that does not parse confidently is null: an address we cannot mask
 * is one we must not print.
 */
export function maskAddress(address) {
  if (typeof address !== 'string') return null;
  const value = address.trim();
  if (!value) return null;
  // A zone id (`fe80::1%eth0`) is host configuration, not part of the address.
  // Brackets are the `[addr]:port` form, and the port is never part of the answer.
  const bare = value.split('%')[0].replace(/^\[|\]$/g, '');

  // Node reports an IPv4 peer on a dual-stack listener as `::ffff:a.b.c.d`.
  // That is an IPv4 address wearing an IPv6 costume: masking it as IPv6 would
  // hide nothing and leak the octets that identify the connection.
  const mapped = bare.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return maskAddress(mapped[1]);

  if (bare.includes(':')) {
    // Keep the leading groups only: the interface identifier is what identifies
    // the machine. A compressed head (`::1`, or an address that is all prefix)
    // cannot be masked without guessing, so it reads as unknown.
    const head = bare.split('::')[0].split(':').filter(Boolean);
    if (head.length === 0) return null;
    return `${head.slice(0, 3).join(':')}::`;
  }

  const octets = bare.split('.');
  if (octets.length !== 4) return null;
  if (!octets.every((octet) => /^\d{1,3}$/.test(octet))) return null;
  return `${octets.slice(0, 3).join('.')}.x`;
}

/** A `throughput()` counter is callable; a plain number is already the answer. */
function rate(counter) {
  const value = typeof counter === 'function' ? counter() : Number(counter);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function bytes(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * `tcpIncoming` / `utpOutgoing` / `webrtc` / `webSeed` -> the three buckets.
 *
 * uTP is BitTorrent over UDP: the same torrent peer reached by a different
 * socket, and the shape most peers arrive in, so it belongs with TCP rather
 * than in "other".
 */
function typeOf(wireType) {
  if (wireType === 'webrtc') return 'web';
  if (typeof wireType === 'string' && /^(tcp|utp)/.test(wireType)) return 'tcp';
  return 'other';
}

function directionOf(wireType) {
  if (typeof wireType !== 'string') return null;
  if (/Incoming$/.test(wireType)) return 'in';
  if (/Outgoing$/.test(wireType)) return 'out';
  return null;
}

function describePeer(wire) {
  const type = typeOf(wire?.type);
  return {
    type,
    direction: directionOf(wire?.type),
    address: maskAddress(wire?.remoteAddress),
    uploadSpeed: rate(wire?.uploadSpeed),
    downloadSpeed: rate(wire?.downloadSpeed),
    uploaded: bytes(wire?.uploaded),
    downloaded: bytes(wire?.downloaded),
  };
}

function countPeers(peers) {
  const counts = { ...EMPTY_COUNTS, total: peers.length };
  for (const peer of peers) {
    if (peer.type === 'web') counts.web += 1;
    else if (peer.type === 'tcp') counts.tcp += 1;
    if (peer.direction === 'in') counts.inbound += 1;
    else if (peer.direction === 'out') counts.outbound += 1;
  }
  return counts;
}

function describeTorrent(torrent) {
  const wires = Array.isArray(torrent?.wires) ? torrent.wires : [];
  const peers = wires.map(describePeer);
  return {
    infoHash: torrent?.infoHash ?? null,
    name: torrent?.name ?? null,
    ...countPeers(peers),
    truncated: peers.length > MAX_PEERS_PER_TORRENT,
    peers: peers.slice(0, MAX_PEERS_PER_TORRENT),
  };
}

/**
 * @param {Array<{ infoHash?: string, name?: string, wires?: unknown[] }>} torrents
 *   `client.torrents` as WebTorrent holds it.
 */
export function describePeers(torrents = []) {
  const groups = (Array.isArray(torrents) ? torrents : []).map(describeTorrent);
  const counts = { ...EMPTY_COUNTS };
  for (const group of groups) {
    for (const key of Object.keys(counts)) counts[key] += group[key];
  }
  return { ...counts, torrents: groups };
}
