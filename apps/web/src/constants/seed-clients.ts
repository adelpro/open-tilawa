/**
 * The two clients the seed page names.
 *
 * They live here, not in the page, because the prerendered body writes the same
 * links as the app: one list, two renderers. Both are open source and ad-free,
 * and both read a magnet without an account.
 */
export const SEED_CLIENTS = [
  { name: 'qBittorrent', url: 'https://www.qbittorrent.org/download', key: 'qbittorrent' },
  { name: 'Deluge', url: 'https://deluge-torrent.org/download/', key: 'deluge' },
] as const;

export type SeedClient = (typeof SEED_CLIENTS)[number];
