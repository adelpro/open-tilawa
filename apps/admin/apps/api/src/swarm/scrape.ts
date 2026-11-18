import { decodeBencode, hexOf, isDict, latin1Bytes } from './bencode';

/**
 * The tracker's scrape answer, as counts per reciter.
 *
 * The shape is `d5:filesd<20-byte hash>d8:completei…e10:incompletei…eee`. A hash
 * the tracker has never seen is simply absent — that is not an error, and the
 * caller decides what absence means. A payload that cannot be read is an empty
 * map for the same reason: one bad scrape must not take the sample down, and a
 * silence that looks like "zero seeders" is corrected by the next hour.
 *
 * A **refusal** is different. `failure reason` means the tracker heard us and said
 * no, and writing zeros for it would turn an outage into a fleet of thin releases.
 * That throws, and the scheduler keeps the last answer instead.
 */
export type ScrapeCounts = { seeders: number; leechers: number };

const INFO_HASH = /^[0-9a-f]{40}$/;

/**
 * A scrape key, back to the hex the catalogue speaks.
 *
 * `bittorrent-tracker` holds the info hash as a 20-character binary string and
 * bencodes it as UTF-8, so a 20-byte hash arrives as 21–40 bytes — the live
 * tracker answers 26 bytes for the hash `815cc72f…`. Reading those bytes as the
 * hash (the obvious thing) matches nothing, and an empty map then looks exactly
 * like "nobody seeds anything".
 *
 * So: the raw reading is accepted only when it is exactly 20 bytes; otherwise the
 * key is decoded as UTF-8 and each character code is the byte. A tracker that
 * writes the bytes verbatim hits the first branch, the one we run hits the
 * second, and anything else is not a hash.
 */
export function hashFromKey(key: string): string | null {
  const raw = latin1Bytes(key);
  if (raw.length === 20) return hexOf(raw);

  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    const codes = [...decoded].map((character) => character.codePointAt(0) ?? 0);
    if (codes.length !== 20 || codes.some((code) => code > 0xff)) return null;
    return hexOf(Uint8Array.from(codes));
  } catch {
    return null;
  }
}

export function parseScrape(payload: Uint8Array): Map<string, ScrapeCounts> {
  const counts = new Map<string, ScrapeCounts>();

  let root: unknown;
  try {
    root = decodeBencode(payload);
  } catch {
    return counts;
  }

  if (!isDict(root)) return counts;

  // A scrape that refused to answer says so in a `failure reason` key. That is not
  // "nobody seeds it": writing zeros here would turn a tracker outage into a fleet
  // of thin releases and send volunteers at a problem that does not exist.
  const failure = root['failure reason'] ?? root['failure'];
  if (failure !== undefined) {
    const reason =
      typeof failure === 'string'
        ? failure
        : failure instanceof Uint8Array
          ? new TextDecoder().decode(failure)
          : 'unknown';
    throw new Error(`scrape refused: ${reason}`);
  }

  if (!isDict(root['files'])) return counts;

  for (const [key, value] of Object.entries(root['files'])) {
    const infohash = hashFromKey(key);
    if (!infohash || !INFO_HASH.test(infohash) || !isDict(value)) continue;

    const seeders = Number(value['complete'] ?? 0);
    if (!Number.isFinite(seeders)) continue;
    const leechers = Number(value['incomplete'] ?? 0);

    counts.set(infohash, {
      seeders: Math.max(0, Math.trunc(seeders)),
      leechers: Number.isFinite(leechers) ? Math.max(0, Math.trunc(leechers)) : 0,
    });
  }

  return counts;
}

/** `?info_hash=` takes the raw 20 bytes, percent-encoded one byte at a time. */
export function scrapeUrl(base: string, infohashes: string[]): string {
  const query = infohashes
    .map((hash) => {
      const bytes = (hash.match(/../g) ?? []).map((pair) => `%${pair.toLowerCase()}`);
      return `info_hash=${bytes.join('')}`;
    })
    .join('&');
  return `${base.replace(/\/+$/, '')}/scrape?${query}`;
}
