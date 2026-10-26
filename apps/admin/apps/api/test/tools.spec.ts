import { createHash } from 'node:crypto';
import { magnetFor, torrentInfo } from '../src/tools/bencode';

/** A deterministic encoder, so the test knows the exact infohash to expect. */
function enc(value: unknown): Buffer {
  if (typeof value === 'number') return Buffer.from(`i${value}e`);
  if (typeof value === 'string')
    return Buffer.concat([Buffer.from(`${Buffer.byteLength(value)}:`), Buffer.from(value)]);
  if (Buffer.isBuffer(value)) return Buffer.concat([Buffer.from(`${value.length}:`), value]);
  if (Array.isArray(value))
    return Buffer.concat([Buffer.from('l'), ...value.map(enc), Buffer.from('e')]);
  const dict = value as Record<string, unknown>;
  const keys = Object.keys(dict).sort();
  return Buffer.concat([
    Buffer.from('d'),
    ...keys.flatMap((k) => [enc(k), enc(dict[k])]),
    Buffer.from('e'),
  ]);
}

describe('torrent tooling', () => {
  const info = {
    length: 1024,
    name: 'Yassine — Warsh',
    'piece length': 16384,
    pieces: Buffer.alloc(20),
  };
  const file = enc({
    announce: 'udp://tracker.example:6969',
    'announce-list': [['udp://tracker.example:6969']],
    info,
  });

  it('computes the infohash from the original info bytes', () => {
    const expected = createHash('sha1').update(enc(info)).digest('hex').toUpperCase();
    const parsed = torrentInfo(file);
    expect(parsed.infoHash).toBe(expected);
    expect(parsed.infoHash).toHaveLength(40);
  });

  it('reports name, size and file count', () => {
    const parsed = torrentInfo(file);
    expect(parsed.name).toBe('Yassine — Warsh');
    expect(parsed.size).toBe(1024);
    expect(parsed.files).toBe(1);
    expect(parsed.trackers).toContain('udp://tracker.example:6969');
  });

  it('builds a magnet with the hash, the name and every tracker', () => {
    const parsed = torrentInfo(file);
    const url = new URL(parsed.magnet);
    expect(url.searchParams.get('xt')).toBe(`urn:btih:${parsed.infoHash}`);
    expect(url.searchParams.get('dn')).toBe('Yassine — Warsh');
    expect(url.searchParams.getAll('tr')).toEqual(['udp://tracker.example:6969']);
  });

  it('sums multi-file torrents', () => {
    const multi = enc({
      info: {
        name: 'release',
        files: [{ length: 100 }, { length: 50 }],
        'piece length': 16384,
        pieces: Buffer.alloc(20),
      },
    });
    expect(torrentInfo(multi).size).toBe(150);
    expect(torrentInfo(multi).files).toBe(2);
  });

  it('rejects something that is not a torrent', () => {
    expect(() => torrentInfo(Buffer.from('hello'))).toThrow();
    expect(() => torrentInfo(enc({ announce: 'x' }))).toThrow(/info/);
  });

  it('builds a magnet from a bare hash', () => {
    const magnet = magnetFor('ABCDEF0123456789ABCDEF0123456789ABCDEF01', 'Release');
    expect(magnet).toContain('xt=urn%3Abtih%3AABCDEF0123456789ABCDEF0123456789ABCDEF01');
    expect(magnet).toContain('dn=Release');
  });
});
