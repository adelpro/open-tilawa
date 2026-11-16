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
  firefox: '',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/tilawah-companion/nolphcjcahcbkkiohdkdmkkcdableoom',
};
