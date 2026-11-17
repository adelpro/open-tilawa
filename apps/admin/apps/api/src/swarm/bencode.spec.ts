import { decodeBencode, latin1 } from './bencode';
import { hashFromKey, parseScrape, scrapeUrl } from './scrape';

/**
 * The tracker answers a scrape with a bencoded dictionary keyed by the info hash.
 * `bittorrent-tracker` encodes that key as UTF-8 over a 20-character binary
 * string, so the key on the wire is 21–40 bytes (`utf8Entry`); a tracker that
 * writes the raw bytes is covered by `entry`. Both have to reach the same hash —
 * the live tracker's own answer is what `utf8Entry` reproduces.
 */
const hash = (byte: string): string => byte.repeat(20);

const value = (complete: number, incomplete: number): Buffer =>
  Buffer.from(`d8:completei${complete}e10:incompletei${incomplete}e10:downloadedi0ee`);

const entry = (byte: string, complete: number, incomplete: number): Buffer =>
  Buffer.concat([Buffer.from('20:'), Buffer.from(hash(byte), 'hex'), value(complete, incomplete)]);

const utf8Entry = (byte: string, complete: number, incomplete: number): Buffer => {
  const key = Buffer.from(Buffer.from(hash(byte), 'hex').toString('latin1'), 'utf8');
  return Buffer.concat([Buffer.from(`${key.length}:`), key, value(complete, incomplete)]);
};

const scrape = (...entries: Buffer[]): Uint8Array =>
  new Uint8Array(Buffer.concat([Buffer.from('d5:filesd'), ...entries, Buffer.from('ee')]));

describe('parseScrape', () => {
  it('reads seeders and leechers per info hash', () => {
    const counts = parseScrape(scrape(entry('aa', 2, 1), entry('bb', 0, 0)));

    expect(counts.get(hash('aa'))).toEqual({ seeders: 2, leechers: 1 });
    expect(counts.get(hash('bb'))).toEqual({ seeders: 0, leechers: 0 });
  });

  it('reads the UTF-8 key the way the live tracker writes it', () => {
    // The real answer for one published hash is 26 bytes on the wire; the naive
    // raw-byte reading matches nothing and the map comes back empty.
    const counts = parseScrape(scrape(utf8Entry('81', 1, 0)));

    expect(counts.size).toBe(1);
    expect(counts.get(hash('81'))).toEqual({ seeders: 1, leechers: 0 });
  });

  it('keeps a hash whose bytes are not valid UTF-8', () => {
    // 0xFF is not a UTF-8 sequence; a decoder that refuses it must still read the
    // raw 20-byte form.
    const counts = parseScrape(scrape(entry('ff', 4, 0)));

    expect(counts.get(hash('ff'))).toEqual({ seeders: 4, leechers: 0 });
  });

  it('is an empty answer, not a throw, when the payload is unreadable', () => {
    expect(parseScrape(new Uint8Array(Buffer.from('not bencode'))).size).toBe(0);
    expect(parseScrape(new Uint8Array(Buffer.from('d5:filesdee'))).size).toBe(0);
  });

  it('a refusal is an error, never a fleet of zeros', () => {
    const refusal = new Uint8Array(Buffer.from('d14:failure reason11:temporarilye'));

    expect(() => parseScrape(refusal)).toThrow(/temporarily/);
  });
});

describe('decodeBencode', () => {
  it('round-trips a dictionary key through latin1', () => {
    const payload = scrape(entry('cc', 1, 1));
    const root = decodeBencode(payload);
    const files = (root as Record<string, Record<string, unknown>>)['files'];

    expect(Object.keys(files ?? {})).toHaveLength(1);
    expect(hashFromKey(Object.keys(files ?? {})[0]!)).toBe(hash('cc'));
    expect(latin1(Buffer.from([0xff, 0x00, 0x41]))).toBe('ÿ\u0000A');
  });

  it('decodes a UTF-8 key that is longer than the hash', () => {
    const root = decodeBencode(scrape(utf8Entry('ff', 2, 0)));
    const files = (root as Record<string, Record<string, unknown>>)['files'];
    const key = Object.keys(files ?? {})[0]!;

    expect(key.length).toBeGreaterThan(20);
    expect(hashFromKey(key)).toBe(hash('ff'));
  });
});

describe('scrapeUrl', () => {
  it('percent-encodes the raw bytes of every hash', () => {
    const url = scrapeUrl('https://tracker.tilawah.cc/', [hash('ab')]);

    expect(url.startsWith('https://tracker.tilawah.cc/scrape?info_hash=')).toBe(true);
    expect(url.slice(url.indexOf('info_hash=') + 'info_hash='.length)).toBe('%ab'.repeat(20));
  });

  it('asks for several releases in one request', () => {
    const url = scrapeUrl('https://tracker.example', [hash('aa'), hash('bb')]);

    expect(url.match(/info_hash=/g)).toHaveLength(2);
  });
});
