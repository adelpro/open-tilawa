/**
 * Magnet parsing and formatting for the player.
 *
 * Two producers disagree about encoding: this repo's older list writes literal
 * `urn:btih:` and tracker URLs, while a magnet normalised through
 * `URLSearchParams.toString()` writes `urn%3Abtih%3A…`. WebTorrent's parser
 * (magnet-uri) splits the query on `&`/`=` and does **not** percent-decode, so
 * the encoded form is rejected outright as an invalid torrent identifier.
 *
 * Everything handed to the client therefore passes through here: parse (which
 * decodes both forms), then format (which writes the literal form every parser
 * accepts). It also keeps the parameters this app does not interpret — `ws=` web
 * seeds above all — instead of dropping them on the way through.
 */

export interface ParsedMagnet {
  /** Hex (40) or base32 (32) infohash, normalised to the case its alphabet uses. */
  infoHash: string;
  name: string | null;
  trackers: string[];
  /** ws, xl, so, as… — preserved verbatim, never interpreted here. */
  extras: [string, string][];
}

const HEX = /^[a-f0-9]{40}$/i;
const BASE32 = /^[a-z2-7]{32}$/i;

/** `null` when the string is not a magnet carrying a readable btih. */
export function parseMagnet(magnet: string | null | undefined): ParsedMagnet | null {
  if (!magnet || !magnet.startsWith('magnet:')) return null;
  const start = magnet.indexOf('?');
  if (start === -1) return null;

  // URLSearchParams decodes the values, which is what makes an over-encoded
  // magnet readable again.
  const params = new URLSearchParams(magnet.slice(start + 1));
  const xt = (params.get('xt') ?? '').trim();
  const hash = xt.toLowerCase().startsWith('urn:btih:') ? xt.slice('urn:btih:'.length) : '';
  if (!HEX.test(hash) && !BASE32.test(hash)) return null;

  const trackers = params
    .getAll('tr')
    .map((tracker) => tracker.trim())
    .filter(Boolean);

  const extras: [string, string][] = [];
  for (const [key, value] of params) {
    if (!['xt', 'dn', 'tr'].includes(key)) extras.push([key, value]);
  }

  return {
    infoHash: HEX.test(hash) ? hash.toLowerCase() : hash.toUpperCase(),
    name: params.get('dn'),
    trackers,
    extras,
  };
}

/**
 * Encode just enough. `:` and `/` are legal in a query value (RFC 3986) and must
 * stay literal for magnet-uri; everything else is percent-encoded as usual.
 */
function magnetValue(value: string): string {
  return encodeURIComponent(value).replace(/%3A/gi, ':').replace(/%2F/gi, '/');
}

export function formatMagnet(parts: ParsedMagnet, trackers: string[] = parts.trackers): string {
  const query = [`xt=urn:btih:${parts.infoHash}`];
  if (parts.name) query.push(`dn=${magnetValue(parts.name)}`);
  for (const tracker of trackers) query.push(`tr=${magnetValue(tracker)}`);
  for (const [key, value] of parts.extras) {
    query.push(`${magnetValue(key)}=${magnetValue(value)}`);
  }
  return `magnet:?${query.join('&')}`;
}
