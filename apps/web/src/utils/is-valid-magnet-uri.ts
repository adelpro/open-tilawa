import { parseMagnet } from './magnet';

/**
 * A magnet the browser client can actually use: a readable btih **and** at least
 * one WebSocket tracker (browser WebTorrent has no DHT, so a trackerless magnet
 * would never find a peer).
 *
 * Parsing rather than matching a regex is deliberate: the same magnet is written
 * with literal `urn:btih:` by one producer and percent-encoded by another, and a
 * regex over the raw string only accepts the first.
 */
export const isValidMagnetUri = (magnetUri: string | undefined): boolean => {
  const parsed = parseMagnet(magnetUri);
  return parsed !== null && parsed.trackers.length > 0;
};
