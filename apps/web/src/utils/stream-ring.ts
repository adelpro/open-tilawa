/**
 * The ring says "this surah arrives over the network, and this much of it is
 * here". It belongs to a torrent: a host-served reciter has no pieces to
 * download, so a ring there would be decoration.
 *
 * It is drawn even at zero — an empty track still answers "is anything cached?",
 * and the previous rule (hide below 1%) made it invisible exactly when a
 * listener was waiting for the first byte.
 */
export function shouldShowRing(source: 'connected' | 'waiting' | 'http'): boolean {
  return source !== 'http';
}
