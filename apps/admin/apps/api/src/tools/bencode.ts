import { createHash } from 'node:crypto';

/**
 * A minimal bencode reader for .torrent files.
 *
 * Only the shapes a torrent metainfo file uses: sorted dictionaries, lists, byte
 * strings and integers. It reports the byte span of every dictionary value,
 * because a torrent's infohash is the SHA-1 of the original `info` bytes —
 * re-encoding a parsed object can differ in key order or integer spelling and
 * would yield a different hash.
 */
export interface Value {
  value: unknown;
  start: number;
  end: number;
  /** Byte spans of this dictionary's values, keyed by name (dicts only). */
  children?: Map<string, { start: number; end: number }>;
}

class Reader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  read(): Value {
    const start = this.offset;
    const marker = String.fromCharCode(this.buffer[this.offset]);
    if (marker === 'i') {
      const close = this.buffer.indexOf('e', this.offset);
      if (close === -1) throw new Error('truncated integer');
      const raw = this.buffer.subarray(this.offset + 1, close).toString('ascii');
      if (!/^-?\d+$/.test(raw)) throw new Error('malformed integer');
      this.offset = close + 1;
      return { value: Number(raw), start, end: this.offset };
    }
    if (marker === 'l') {
      this.offset += 1;
      const list: unknown[] = [];
      while (this.buffer[this.offset] !== 0x65) list.push(this.read().value);
      this.offset += 1;
      return { value: list, start, end: this.offset };
    }
    if (marker === 'd') {
      this.offset += 1;
      const dict: Record<string, unknown> = {};
      const children = new Map<string, { start: number; end: number }>();
      while (this.buffer[this.offset] !== 0x65) {
        const key = this.read().value;
        if (typeof key !== 'string') throw new Error('dictionary key must be a string');
        const entry = this.read();
        dict[key] = entry.value;
        children.set(key, { start: entry.start, end: entry.end });
      }
      this.offset += 1;
      return { value: dict, start, end: this.offset, children };
    }
    if (marker >= '0' && marker <= '9') {
      const colon = this.buffer.indexOf(':', this.offset);
      if (colon === -1) throw new Error('truncated string length');
      const length = Number(this.buffer.subarray(this.offset, colon).toString('ascii'));
      if (!Number.isInteger(length) || length < 0) throw new Error('malformed string length');
      const from = colon + 1;
      const to = from + length;
      if (to > this.buffer.length) throw new Error('truncated string');
      this.offset = to;
      return { value: this.buffer.subarray(from, to).toString('utf8'), start, end: this.offset };
    }
    throw new Error(`unexpected bencode marker at byte ${this.offset}`);
  }
}

export function bdecode(buffer: Buffer): Value {
  return new Reader(buffer).read();
}

export interface TorrentInfo {
  name: string;
  infoHash: string;
  magnet: string;
  /** Total bytes across the files; falls back to `length` for single-file torrents. */
  size: number;
  files: number;
  trackers: string[];
}

export function torrentInfo(file: Buffer): TorrentInfo {
  const root = bdecode(file);
  if (!root.children) throw new Error('not a torrent file: root is not a dictionary');
  const infoSpan = root.children.get('info');
  if (!infoSpan) throw new Error('not a torrent file: no info dictionary');

  const infoValue = (root.value as Record<string, unknown>).info as Record<string, unknown>;
  const infoHash = createHash('sha1')
    .update(file.subarray(infoSpan.start, infoSpan.end))
    .digest('hex')
    .toUpperCase();

  const name = typeof infoValue.name === 'string' ? infoValue.name : infoHash;
  const filesList = Array.isArray(infoValue.files)
    ? (infoValue.files as { length?: number }[])
    : [];
  const size =
    filesList.length > 0
      ? filesList.reduce((sum, entry) => sum + (entry.length ?? 0), 0)
      : typeof infoValue.length === 'number'
        ? infoValue.length
        : 0;

  const rawTrackers = (root.value as Record<string, unknown>).announce;
  const announceList = (root.value as Record<string, unknown>)['announce-list'];
  const trackers = new Set<string>();
  if (typeof rawTrackers === 'string') trackers.add(rawTrackers);
  if (Array.isArray(announceList)) {
    for (const tier of announceList) {
      if (Array.isArray(tier))
        for (const url of tier) if (typeof url === 'string') trackers.add(url);
    }
  }

  return {
    name,
    infoHash,
    magnet: magnetFor(infoHash, name, [...trackers]),
    size,
    files: filesList.length || 1,
    trackers: [...trackers],
  };
}

/** `magnet:?xt=urn:btih:<hash>&dn=<name>&tr=…`, the form every client accepts. */
export function magnetFor(infoHash: string, name: string, trackers: string[] = []): string {
  const params = new URLSearchParams({ xt: `urn:btih:${infoHash}`, dn: name });
  for (const tracker of trackers) params.append('tr', tracker);
  return `magnet:?${params.toString()}`;
}
