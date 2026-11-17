/**
 * A minimal bencode reader.
 *
 * The only per-torrent answer the tracker gives is a scraped bencoded dictionary,
 * and a regular expression over it would break on the first reciter name that
 * contains a colon or a length-looking run. The whole format is handled instead:
 * strings, integers, lists and dictionaries are twenty lines together, and a
 * partial reader is the thing that works until it meets its first nested value.
 *
 * Dictionary keys come back as latin1 strings, not UTF-8: they are bytes, and a
 * decode that substitutes U+FFFD would lose the key before the caller can decide
 * what it means. `scrape.ts` interprets them (see `hashFromKey`) — the tracker
 * writes its info hashes as a 20-character string bencoded as UTF-8, so the raw
 * bytes are usually 21–40 long, not 20.
 */

export type Bencoded = number | Uint8Array | Bencoded[] | { [key: string]: Bencoded };

const END = 0x65; // 'e'
const DICT = 0x64; // 'd'
const LIST = 0x6c; // 'l'
const INT = 0x69; // 'i'
const COLON = 0x3a; // ':'

/** One byte per character, the inverse of `latin1Bytes`. */
export const latin1 = (bytes: Uint8Array): string => {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
};

/** A latin1 string back to the bytes it came from. */
export const latin1Bytes = (text: string): Uint8Array =>
  Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff);

/** Bytes to the hex the catalogue speaks. */
export const hexOf = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export function decodeBencode(input: Uint8Array): Bencoded {
  let at = 0;
  const ascii = new TextDecoder();

  const fail = (why: string): never => {
    throw new Error(`bencode: ${why} at byte ${at}`);
  };

  const readString = (): Uint8Array => {
    const colon = input.indexOf(COLON, at);
    if (colon < 0) fail('string without a length');
    const length = Number(ascii.decode(input.subarray(at, colon)));
    if (!Number.isInteger(length) || length < 0) fail('string length is not a number');
    const start = colon + 1;
    const end = start + length;
    if (end > input.length) fail('string runs past the end');
    at = end;
    return input.subarray(start, end);
  };

  const readInteger = (): number => {
    const end = input.indexOf(END, at);
    if (end < 0) fail('unterminated integer');
    const text = ascii.decode(input.subarray(at, end));
    at = end + 1;
    if (!/^-?\d+$/.test(text)) fail(`integer "${text}"`);
    return Number(text);
  };

  const readValue = (): Bencoded => {
    if (at >= input.length) return fail('unexpected end of input');
    const tag = input[at]!;

    if (tag === INT) {
      at += 1;
      return readInteger();
    }

    if (tag === LIST) {
      at += 1;
      const list: Bencoded[] = [];
      while (input[at] !== END) list.push(readValue());
      at += 1;
      return list;
    }

    if (tag === DICT) {
      at += 1;
      const dict: Record<string, Bencoded> = {};
      while (input[at] !== END) dict[latin1(readString())] = readValue();
      at += 1;
      return dict;
    }

    if (tag >= 0x30 && tag <= 0x39) return readString();

    return fail(`unexpected byte ${tag}`);
  };

  const value = readValue();
  if (at !== input.length) fail('trailing bytes after the value');
  return value;
}

/** True for a dictionary, in the narrow way this file needs. */
export const isDict = (value: unknown): value is Record<string, Bencoded> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array);
