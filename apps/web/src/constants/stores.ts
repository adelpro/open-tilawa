/**
 * The three store listings, one URL each. An empty string is a listing still
 * in review: the add-on page renders it as text with «قريبًا», and the static
 * build leaves the link out, so no surface promises a store it does not link.
 *
 * This table is the only place a listing URL is written; both the page and the
 * prerender read it, which is how the two drifted apart once already.
 */
export const STORE_URLS = {
  chrome: '',
  /** Live since 2026-11-19 — Firefox approved 0.2.5. */
  firefox: 'https://addons.mozilla.org/firefox/addon/tilawah-companion/',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/tilawah-companion/nolphcjcahcbkkiohdkdmkkcdableoom',
};
