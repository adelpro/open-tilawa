import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveRemoteSettings, shouldPushLocalSettings } from '../src/hooks/use-persistence.ts';

const NOW = 1_700_000_000_000;

test('a newer remote settings object replaces the local values', () => {
  const resolved = resolveRemoteSettings(
    { rate: 1, theme: 'light', updatedAt: NOW - 10 },
    { rate: 1.5, visualiser: 'peaks', locale: 'en', theme: 'dark', updatedAt: NOW - 5 },
    NOW,
  );
  assert.deepEqual(resolved, {
    rate: 1.5,
    visualiser: 'peaks',
    locale: 'en',
    theme: 'dark',
    updatedAt: NOW - 5,
  });
});

test('an older remote settings object is ignored', () => {
  const resolved = resolveRemoteSettings(
    { rate: 1.5, updatedAt: NOW - 5 },
    { rate: 0.75, updatedAt: NOW - 10 },
    NOW,
  );
  assert.equal(resolved, null);
});

test('an equal stamp is not newer, so nothing is applied', () => {
  const resolved = resolveRemoteSettings(
    { rate: 1.5, updatedAt: NOW - 5 },
    { rate: 0.75, updatedAt: NOW - 5 },
    NOW,
  );
  assert.equal(resolved, null);
});

test('a remote object with no stamp never overrides a stamped device', () => {
  const resolved = resolveRemoteSettings({ rate: 1.5, updatedAt: NOW - 5 }, { rate: 0.75 }, NOW);
  assert.equal(resolved, null);
});

test('a stamp far in the future is a broken clock, not a newer setting', () => {
  const resolved = resolveRemoteSettings(
    { rate: 1.5, updatedAt: NOW - 5 },
    { rate: 0.75, updatedAt: NOW + 61_000 },
    NOW,
  );
  assert.equal(resolved, null);
});

test('a stamp inside the clock-skew tolerance is accepted', () => {
  const resolved = resolveRemoteSettings(
    { rate: 1.5, updatedAt: NOW - 5 },
    { rate: 0.75, updatedAt: NOW + 30_000 },
    NOW,
  );
  assert.equal(resolved?.rate, 0.75);
});

test('values outside the buttons the app offers are dropped', () => {
  const resolved = resolveRemoteSettings(
    {},
    {
      rate: 3,
      visualiser: 'waterfall',
      locale: 'fr',
      theme: 'blue',
      updatedAt: NOW,
    },
    NOW,
  );
  assert.equal(resolved, null);
});

test('valid fields survive next to invalid ones', () => {
  const resolved = resolveRemoteSettings(
    {},
    { rate: 99, locale: 'en', theme: 'sepia', updatedAt: NOW },
    NOW,
  );
  assert.deepEqual(resolved, { locale: 'en', updatedAt: NOW });
});

test('a fresh account with no local stamp accepts the account settings', () => {
  const resolved = resolveRemoteSettings({}, { locale: 'en', rate: 1, updatedAt: NOW }, NOW);
  assert.deepEqual(resolved, { locale: 'en', rate: 1, updatedAt: NOW });
});

test('a non-object payload is ignored', () => {
  assert.equal(resolveRemoteSettings({}, null, NOW), null);
  assert.equal(resolveRemoteSettings({}, 'settings', NOW), null);
});

test('a local change newer than the account is pushed up', () => {
  assert.equal(
    shouldPushLocalSettings({ rate: 0.75, updatedAt: NOW - 1 }, { rate: 1.5, updatedAt: NOW - 5 }, NOW),
    true,
  );
});

test('an account that is already level with this device is not rewritten', () => {
  assert.equal(
    shouldPushLocalSettings({ rate: 0.75, updatedAt: NOW - 5 }, { rate: 0.75, updatedAt: NOW - 5 }, NOW),
    false,
  );
});

test('a device that never changed a setting does not push its defaults', () => {
  assert.equal(shouldPushLocalSettings({}, { theme: 'dark', updatedAt: NOW - 5 }, NOW), false);
});

test('a local stamp from a broken clock is not pushed', () => {
  assert.equal(shouldPushLocalSettings({ updatedAt: NOW + 61_000 }, {}, NOW), false);
});

