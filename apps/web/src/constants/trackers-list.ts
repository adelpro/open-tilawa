/**
 * Browser announce list. Ours first, because a listener should meet the seeders
 * this project runs before spending a connection on a public tracker.
 *
 * `tracker.btorrent.xyz` (connection refused) and `tracker.fastcast.nz` (the name
 * no longer resolves) are gone: a dead tracker is a console error on every load.
 */
export const TRACKERS = [
  'wss://tracker.tilawah.cc',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
];
