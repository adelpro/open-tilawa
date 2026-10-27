import assert from 'node:assert/strict';
import { test } from 'node:test';

import { encodeTicket, parseTicket, PAIRING_TTL_MS } from '../src/gun/pairing-ticket.ts';
import { migrateUserGraph } from '../src/gun/user-migrations.ts';
import { CURRENT_USER_SCHEMA_VERSION } from '../src/gun/user-schema.ts';

const now = 1_700_000_000_000;
const ticket = {
  v: 2 as const,
  id: 'abc',
  epub: 'epub',
  epriv: 'epriv',
  exp: now + PAIRING_TTL_MS,
};

test('a pairing ticket round-trips', () => {
  assert.deepEqual(parseTicket(encodeTicket(ticket), now), ticket);
});

test('an expired pairing ticket is refused', () => {
  assert.equal(parseTicket(encodeTicket(ticket), ticket.exp + 1), null);
});

test('a ticket from the old raw-pair format is refused', () => {
  // v1 put the account key straight in the QR; it must never be redeemed again.
  assert.equal(parseTicket(JSON.stringify({ v: 1, pair: { pub: 'x', priv: 'y' } }), now), null);
  assert.equal(parseTicket(JSON.stringify({ pub: 'x', priv: 'y' }), now), null);
});

test('a ticket missing its throwaway key is refused', () => {
  assert.equal(parseTicket(JSON.stringify({ ...ticket, epriv: undefined }), now), null);
  assert.equal(parseTicket(JSON.stringify({ ...ticket, id: '' }), now), null);
});

test('garbage never throws', () => {
  assert.equal(parseTicket('not json', now), null);
  assert.equal(parseTicket('{}', now), null);
  assert.equal(parseTicket('null', now), null);
});

test('a snapshot with no version is lifted to the current schema', () => {
  const migrated = migrateUserGraph({ favorites: { 1: true } }, 0);
  assert.equal(migrated._schemaVersion, CURRENT_USER_SCHEMA_VERSION);
  assert.deepEqual(migrated.favorites, { 1: true });
});

test('migration keeps paths it does not understand', () => {
  assert.deepEqual(migrateUserGraph({ unknownPath: { a: 1 } }, 0).unknownPath, { a: 1 });
});

test('a snapshot from a newer client keeps its version', () => {
  const ahead = CURRENT_USER_SCHEMA_VERSION + 5;
  assert.equal(migrateUserGraph({ x: 1 }, ahead)._schemaVersion, ahead);
});
