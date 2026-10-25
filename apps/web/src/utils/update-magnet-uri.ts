import { TRACKERS } from '@/constants';

// Browser WebTorrent can only announce over WebSocket trackers (wss:// or ws://).
// HTTP/UDP trackers (archive.org's bt1.archive.org:6969/announce, etc.) are
// silently ineffective in a browser, so we drop them here and merge our own
// wss:// tracker list. Web seeds (ws=) are preserved separately via urlList.
export const updateMagnetURI = (magnetURI: string): string => {
  const [base, query = ''] = magnetURI.split('?');
  if (base !== 'magnet:') {
    return magnetURI; // Not a valid magnet URI
  }

  const params = new URLSearchParams(query);
  const existingTrackers = params.getAll('tr');

  // Filter existing trackers to keep only websocket trackers
  const wsTrackers = new Set(
    existingTrackers.filter(
      (tr) => tr.startsWith('ws://') || tr.startsWith('wss://')
    )
  );

  // Add trackers from our constant list
  for (const tracker of TRACKERS) {
    wsTrackers.add(tracker);
  }

  // Remove all existing 'tr' params
  params.delete('tr');

  // Add the cleaned and merged list of trackers
  for (const tracker of wsTrackers) {
    params.append('tr', tracker);
  }

  return `${base}?${params.toString()}`;
};
