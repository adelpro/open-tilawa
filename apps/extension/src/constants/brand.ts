/**
 * Everything the interface says about the product in one place: who to write to,
 * where the stats live, and which store links exist.
 *
 * A link is rendered only when it is real. Edge is live; Chrome and Firefox are
 * still in review, and their keys stay empty until their listings exist — a
 * placeholder that 404s is worse than a line that is not there.
 */

export const BRAND = {
  contact: 'contact@tilawah.cc',
  site: 'https://tilawah.cc',
  trackerStats: 'https://tracker.tilawah.cc/stats',
  catalogue: 'https://console.tilawah.cc/api/public/reciters?page=1&range=200',
  /** Rendered only once a listing exists; empty means "not yet". */
  chromeStore: '',
  /** Live since 2026-11-16 — the About link points here until Chrome clears review. */
  edgeStore: 'https://microsoftedge.microsoft.com/addons/detail/tilawah-companion/nolphcjcahcbkkiohdkdmkkcdableoom',
  firefoxAddons: '',
} as const;

export const hasStoreLinks = (): boolean =>
  Boolean(BRAND.chromeStore || BRAND.edgeStore || BRAND.firefoxAddons);
