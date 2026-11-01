import { parseMagnet } from './magnet';

/**
 * Whether two magnet URIs name the same release.
 *
 * The player compares the torrent it is holding with the reciter the listener
 * selected. Strings cannot answer that: the catalogue writes a literal
 * `urn:btih:`, a normalised magnet writes `urn%3Abtih%3A`, and the trackers and
 * display name are not part of the identity. The infohash is.
 *
 * Hex and base32 spellings of the same hash do not compare equal here; every
 * catalogue this app reads uses hex.
 */
export function sameRelease(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = parseMagnet(a)?.infoHash;
  const right = parseMagnet(b)?.infoHash;
  return Boolean(left && right && left === right);
}
