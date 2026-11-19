import { describe, expect, test } from 'vitest';

import { aboutStoreHref } from '../src/lib/store-link';

/**
 * The About link used to take the first live store, so a Firefox install sent
 * people to Edge. The manifest version is the one fact WXT gives us at build
 * time that tells the two builds apart; MV2 is Firefox.
 */
describe('aboutStoreHref', () => {
  test('a Firefox build links its own AMO listing', () => {
    expect(aboutStoreHref(2)).toBe('https://addons.mozilla.org/firefox/addon/tilawah-companion/');
  });

  test('a Chromium build keeps the Edge listing while Chrome is pending', () => {
    expect(aboutStoreHref(3)).toBe(
      'https://microsoftedge.microsoft.com/addons/detail/tilawah-companion/nolphcjcahcbkkiohdkdmkkcdableoom',
    );
  });
});
