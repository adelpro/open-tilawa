import { BRAND } from '../constants/brand';

/**
 * The store a build should send people to. WXT stamps the manifest version at
 * build time: MV2 is Firefox, MV3 is Chromium. Chrome and Edge install the same
 * MV3 package, so a Chromium build cannot tell the two listings apart; it links
 * Chrome, the wider of the two, and Edge still installs from that page.
 */
export const aboutStoreHref = (manifestVersion: number): string =>
  manifestVersion === 2 ? BRAND.firefoxAddons : BRAND.chromeStore;
