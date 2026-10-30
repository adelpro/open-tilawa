import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

  it('offers usage to admins only', () => {
    // The summary endpoint is `@Roles('admin')`; a customer has no business reading the
    // fleet's numbers and no way to ask for them.
    assert.equal(navItemsFor('user').some((item) => item.to === '/console/usage'), false);
    for (const role of ['admin', 'super_admin']) {
      const usage = navItemsFor(role).find((item) => item.to === '/console/usage');
      assert.equal(usage?.group, 'admin');
      assert.equal(usage?.labelKey, 'nav.usage');
    }
  });

  it('every row in the nav has a screen behind it', () => {
    // The bug this test exists for: a screen was written, its copy was written, and no
    // row pointed at it — so it shipped unreachable and nobody could tell. The router is
    // a switch on the first segment, so that segment is what has to be present.
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');
    for (const role of ['user', 'admin', 'super_admin']) {
      for (const item of navItemsFor(role)) {
        const segment = item.to.split('/').filter((part) => part && part !== 'console')[0];
        assert.ok(
          app.includes(`first === '${segment}'`),
          `${item.to} is in the nav but no screen answers for \`${segment}\``,
        );
      }
    }
  });

  it('puts the console last, in its own group', () => {
    const items = navItemsFor('super_admin');
    assert.equal(items.at(-1)?.group, 'admin');
    assert.equal(items.at(-1)?.to, '/console/superadmin');
  });
});
