/**
 * The companion's known identities, one per store.
 *
 * A page talks to an extension only by its ID, and the three stores issue
 * three different ones. An empty string means a listing that does not exist
 * yet: the sender skips it, so the site never sends into the dark. This is the
 * only place the IDs live; the sender and any future UI read it.
 */
export const COMPANION_IDS = {
  edge: 'nolphcjcahcbkkiohdkdmkkcdableoom',
  firefox: 'tilawah-companion@tilawah.cc',
  /** Live since 2026-11-19. */
  chrome: 'jfbadgomkkhmemefgckcadjfoldojekk',
  /**
   * The repository's unpacked development build. Its ID is pinned by the
   * public key in wxt.config.ts (TILAWAH_DEV_KEY=1 builds), so a person
   * debugging live gets the same ID on any machine. Targeted from the staging
   * origin only — production never probes an ID nobody ships.
   */
  dev: 'opbhejfgfikjgnckojangiodobblkjfi',
} as const satisfies Record<string, string>;
