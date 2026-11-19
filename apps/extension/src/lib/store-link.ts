import { BRAND } from '../constants/brand';

/**
 * The store a build should send people to. WXT stamps the manifest version at
 * build time: MV2 is Firefox, MV3 is Chromium. The old "first live store" rule
 * sent Firefox users to Edge.
 */
export const aboutStoreHref = (manifestVersion: number): string =>
  manifestVersion === 2 ? BRAND.firefoxAddons : BRAND.chromeStore || BRAND.edgeStore;
