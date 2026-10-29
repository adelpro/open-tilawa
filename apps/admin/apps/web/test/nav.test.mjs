import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { navItemsFor, consolePathFor } from '../src/lib/nav.ts';

/**
 * The nav list is a function so the role rule is testable without a browser: one
 * console entry per role, never both, and no console for a customer.
 */
describe('navigation by role', () => {
  it('gives a customer the workspace and no console', () => {
    const items = navItemsFor('user');
    assert.deepEqual(
      items.map((item) => item.labelKey),
      // Torrents is not a destination: a node is reached through the fleet, and
      // the catalogue through Reciters. Three surfaces for two nouns is what made
      // the console feel like it had two lists of the same thing.
      [
        'nav.seeders',
        'nav.turns',
        'nav.reciters',
        'nav.status',
        'nav.tools',
        'nav.account',
        'nav.help',
      ],
    );
    assert.equal(consolePathFor('user'), null);
  });

  it('gives an admin only the admin console', () => {
    const labels = navItemsFor('admin').map((item) => item.labelKey);
    assert.ok(labels.includes('nav.admin'));
    assert.equal(labels.includes('nav.superadmin'), false);
    assert.equal(consolePathFor('admin'), '/console/admin');
  });

  it('gives a super admin only the super-admin console', () => {
    const labels = navItemsFor('super_admin').map((item) => item.labelKey);
    assert.ok(labels.includes('nav.superadmin'));
    assert.equal(labels.includes('nav.admin'), false);
    assert.equal(consolePathFor('super_admin'), '/console/superadmin');
  });

  it('offers settings to admins only, and keeps the console last', () => {
    assert.equal(navItemsFor('user').some((item) => item.to === '/console/settings'), false);
    for (const role of ['admin', 'super_admin']) {
      const settings = navItemsFor(role).find((item) => item.to === '/console/settings');
      assert.equal(settings?.group, 'admin');
      assert.equal(settings?.labelKey, 'nav.settings');
    }
  });

  it('puts the console last, in its own group', () => {
    const items = navItemsFor('super_admin');
    assert.equal(items.at(-1)?.group, 'admin');
    assert.equal(items.at(-1)?.to, '/console/superadmin');
  });
});
