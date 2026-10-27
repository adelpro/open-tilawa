/**
 * Browser announce list. Ours first, because a listener should meet the seeders
 * this project runs before spending a connection on a public tracker.
 *
 * `tracker.btorrent.xyz` was removed: it answers connection refused, and a dead
 * tracker is a console error on every load.
 */
export const TRACKERS = [
  'wss://tracker.quran.us.kg',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.fastcast.nz',
];
