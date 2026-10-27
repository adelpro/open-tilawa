import { TRACKERS } from '@/constants';

import { formatMagnet, parseMagnet } from './magnet';

// Browser WebTorrent can only announce over WebSocket trackers (wss:// or ws://).
// HTTP/UDP trackers in a magnet are silently ineffective in a browser, so they
// are dropped here and the local wss:// list is merged in. Web seeds (ws=) and
// the rest of the magnet are preserved by the formatter.
export const updateMagnetURI = (magnetURI: string): string => {
  const parsed = parseMagnet(magnetURI);
  if (!parsed) return magnetURI; // Not a magnet this app can use

  const wsTrackers = parsed.trackers.filter(
    (tracker) => tracker.startsWith('ws://') || tracker.startsWith('wss://'),
  );

  return formatMagnet(parsed, [...new Set([...wsTrackers, ...TRACKERS])]);
};
