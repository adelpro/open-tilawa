/**
 * Where a magnet came from. The value is the host, because that is exactly what
 * the reciter row shows — no second mapping table.
 *
 * A const map rather than a TS `enum`: enums emit runtime code, which keeps the
 * module out of reach of `node --experimental-strip-types` (where the logic tests
 * run) for no benefit at the call sites.
 */
export const MagnetlinkSource = {
  MP3QURAN: 'mp3quran.net',
  ISLAMHOUSE: 'islamhouse.com',
  INTERNETARCHIVE: 'archive.org',
  ITQAN: 'itqan.dev',
  UNKNOWN: 'unknown',
} as const;

export type MagnetlinkSource = (typeof MagnetlinkSource)[keyof typeof MagnetlinkSource];
