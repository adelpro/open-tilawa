/**
 * Everything about an avatar that does not need a database: how many bytes we
 * accept, what the bytes really are, and how to take the metadata back out.
 *
 * No image library. `sharp` would add tens of megabytes to the image and a native
 * build step; the browser already re-encodes every upload through a canvas (which
 * is what strips EXIF on the normal path), so the server's job here is verification
 * and defence in depth, not decoding. These functions walk byte headers, which is
 * enough to answer the only questions that matter: is this a real JPEG/PNG/WebP,
 * how big is it, and does it still carry metadata.
 */
import type { IncomingMessage } from 'node:http';

/** Half a megabyte. A 512 px square re-encoded at quality 0.85 lands at 40–90 KB. */
export const MAX_AVATAR_BYTES = 512 * 1024;

/** Beyond this a "photo" is a decompression bomb, not a portrait. */
export const MAX_AVATAR_EDGE = 4096;

export type AvatarMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface Sniffed {
  mime: AvatarMime;
  width: number;
  height: number;
}

/** SVG is XML that can carry script: refused by policy, never sniffed as an image. */
export function looksLikeMarkup(bytes: Buffer): boolean {
  for (let i = 0; i < Math.min(bytes.length, 64); i += 1) {
    const byte = bytes[i] as number;
    // Skip whitespace and a BOM before the first meaningful character.
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0xef) continue;
    return byte === 0x3c; // '<'
  }
  return false;
}

export function sniff(bytes: Buffer): Sniffed | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const size = jpegSize(bytes);
    return size ? { mime: 'image/jpeg', ...size } : null;
  }
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return {
      mime: 'image/png',
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  if (
    bytes.length >= 30 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    const size = webpSize(bytes);
    return size ? { mime: 'image/webp', ...size } : null;
  }
  return null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Walk the marker segments until the first start-of-frame, which carries the size. */
function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] as number;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    const isFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isFrame) {
      // length(2) precision(1) height(2) width(2)
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    if (marker === 0xda) return null; // start of scan before any frame header
    offset += 2 + length;
  }
  return null;
}

function webpSize(bytes: Buffer): { width: number; height: number } | null {
  const chunk = bytes.subarray(12, 16).toString('latin1');
  if (chunk === 'VP8X') {
    return {
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1,
    };
  }
  if (chunk === 'VP8 ') {
    // Lossy: the frame header starts with the 3-byte start code 9d 01 2a.
    if (bytes.length < 30 || bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    // Lossless: 0x2f signature, then 14 bits width-1 and 14 bits height-1.
    if (bytes[20] !== 0x2f) return null;
    const bits = bytes.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

/**
 * Remove EXIF, XMP, IPTC and comments from a JPEG by dropping their segments.
 *
 * The normal upload path has no metadata at all — a canvas re-encode writes fresh
 * bytes — so this only matters when a client bypasses the browser. Dropping the
 * segments keeps the image valid, which refusing the upload would not.
 */
export function stripJpegMetadata(bytes: Buffer): { bytes: Buffer; stripped: number } {
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return { bytes, stripped: 0 };

  const parts: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;
  let stripped = 0;

  while (offset + 4 <= bytes.length) {
    const marker = bytes[offset + 1] as number;
    if (bytes[offset] !== 0xff) break;

    // Everything from the scan onwards is entropy-coded image data: copy it whole.
    if (marker === 0xda) {
      parts.push(bytes.subarray(offset));
      return { bytes: Buffer.concat(parts), stripped };
    }

    const length = bytes.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) break;

    const isMetadata =
      marker === 0xfe || // COM
      (marker >= 0xe1 && marker <= 0xe2) || // APP1 EXIF/XMP, APP2 ICC profile
      (marker >= 0xe3 && marker <= 0xef); // remaining APPn

    if (isMetadata) stripped += 1;
    else parts.push(bytes.subarray(offset, end));

    offset = end;
  }

  parts.push(bytes.subarray(offset));
  return { bytes: Buffer.concat(parts), stripped };
}

export class AvatarTooLargeError extends Error {
  constructor() {
    super(`An avatar must be smaller than ${Math.round(MAX_AVATAR_BYTES / 1024)} KB`);
    this.name = 'AvatarTooLargeError';
  }
}

/**
 * Read the request body ourselves.
 *
 * The app's JSON and urlencoded parsers both ignore `image/*`, so the stream is
 * still unread when the handler starts.
 *
 * Past the cap the bytes are **drained, not buffered**: the buffer stays bounded at
 * 512 KB and the caller gets a real 413. Destroying the socket the moment the cap is
 * crossed is the tempting version, and it answers the client with a connection reset
 * instead of an error it can show. In production nginx caps a body at 2 MB, so the
 * most that is ever drained and thrown away is 2 MB.
 */
export function readRawBody(request: IncomingMessage, limit = MAX_AVATAR_BYTES): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let overflow = false;
    let settled = false;

    request.on('data', (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > limit) {
        overflow = true;
        chunks.length = 0; // release what we buffered; nothing here will be kept
        return;
      }
      if (!overflow) chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      if (overflow) reject(new AvatarTooLargeError());
      else resolve(Buffer.concat(chunks));
    });
    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}
