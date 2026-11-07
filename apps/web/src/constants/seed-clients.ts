/**
 * The client the seed page names, and why it is the only one.
 *
 * qBittorrent's Add Torrent Link window takes one magnet per line, so a whole
 * roster is a single paste; Deluge cannot paste a list without its Autoadd
 * plugin, so it is left out rather than given a second, longer procedure.
 *
 * It lives here, not in the page, because the prerendered body writes the same
 * link as the app: one list, two renderers.
 */
export const SEED_CLIENTS = [
  { name: 'qBittorrent', url: 'https://www.qbittorrent.org/download' },
] as const;

export type SeedClient = (typeof SEED_CLIENTS)[number];
