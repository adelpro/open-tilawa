import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiKeysRepository,
  SCOPES,
  UsersRepository,
  apiKeyPrefix,
  hashApiKey,
  openDatabase,
  parseScopes,
  type Db,
  type Scope,
} from '../src/index';
import { assertRefusesForeignOwner } from './support/tenancy';

const PEPPER = 'test-pepper';

describe('api keys', () => {
  let dir: string;
  let db: Db;
  let keys: ApiKeysRepository;
  let users: UsersRepository;
  let adelId: number;
  let otherId: number;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uslub-keys-'));
    db = openDatabase(join(dir, 'test.sqlite'));
    keys = new ApiKeysRepository(db, PEPPER);
    users = new UsersRepository(db);
    adelId = users.create({ name: 'Adel', email: 'adel@example.com' }).id;
    otherId = users.create({ name: 'Other', email: 'other@example.com' }).id;
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('mints usl_ + 24 base62 characters and stores only its pepper-hash', () => {
    const { key, record } = keys.mint({ userId: adelId, label: 'laptop' });

    expect(key).toMatch(/^usl_[0-9A-Za-z]{24}$/);
    expect(record.key_prefix).toBe(apiKeyPrefix(key));
    expect(record.key_prefix).toHaveLength(12);
    expect(record.user_id).toBe(adelId);
    expect(record.last_used_at).toBeNull();

    // The plaintext must not be anywhere in the row, and the stored hash must
    // be the peppered one — a database read must not yield a usable key.
    const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(record.id) as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(row)).not.toContain(key);
    expect(row.key_hash).toBe(hashApiKey(PEPPER, key));
    expect(row.key_hash).not.toBe(key);
  });

  it('verifies a minted key and reports the right scopes', () => {
    const { key } = keys.mint({ userId: adelId, label: 'laptop', scopes: ['profile:read'] });

    const result = keys.verify(key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key.label).toBe('laptop');
      expect(result.scopes).toEqual(['profile:read']);
    }
  });

  it('rejects a key whose prefix matches but whose body was changed', () => {
    const { key } = keys.mint({ userId: adelId, label: 'laptop' });
    const tampered = `${key.slice(0, key.length - 1)}${key.endsWith('a') ? 'b' : 'a'}`;

    expect(keys.verify(tampered)).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects unknown prefixes and strings that are not keys at all', () => {
    expect(keys.verify('usl_AAAAAAAAAAAAAAAAAAAAAAAA')).toEqual({ ok: false, reason: 'unknown' });
    expect(keys.verify('not-a-key')).toEqual({ ok: false, reason: 'unknown' });
    expect(keys.verify('')).toEqual({ ok: false, reason: 'unknown' });
  });

  it('rejects a revoked key, and leaves the user’s other key working', () => {
    const first = keys.mint({ userId: adelId, label: 'laptop' });
    const second = keys.mint({ userId: adelId, label: 'ci' });

    expect(keys.verify(first.key).ok).toBe(true);
    expect(keys.verify(second.key).ok).toBe(true);

    expect(keys.revoke(first.record.id, adelId)).toBe(true);
    expect(keys.verify(first.key)).toEqual({ ok: false, reason: 'revoked' });
    expect(keys.verify(second.key).ok).toBe(true);

    // revoking twice is a no-op, not a second success
    expect(keys.revoke(first.record.id, adelId)).toBe(false);
  });

  it('rejects an expired key', () => {
    const { key } = keys.mint({
      userId: adelId,
      label: 'short-lived',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    expect(keys.verify(key)).toEqual({ ok: false, reason: 'expired' });
  });

  it('never expires a key with no expiry set', () => {
    const { key } = keys.mint({ userId: adelId, label: 'forever' });
    expect(keys.verify(key).ok).toBe(true);
  });

  it('throttles last_used_at to one write per minute, with an escape hatch', () => {
    const { record } = keys.mint({ userId: adelId, label: 'laptop' });

    expect(keys.touchLastUsed(record.id)).toBe(true);
    const afterFirst = keys.getById(record.id)?.last_used_at;
    expect(afterFirst).not.toBeNull();

    // immediately after, the write is suppressed
    expect(keys.touchLastUsed(record.id)).toBe(false);
    expect(keys.getById(record.id)?.last_used_at).toBe(afterFirst);

    // forced, it writes again
    expect(keys.touchLastUsed(record.id, true)).toBe(true);
  });

  it('retries when the generated prefix collides instead of returning the wrong key', () => {
    const taken = keys.mint({ userId: adelId, label: 'first' });
    let calls = 0;
    // the first two attempts collide with the key above, the third is new
    const generator = (): string => {
      calls += 1;
      return calls < 3 ? taken.key : `usl_${'Z'.repeat(24)}`;
    };

    const minted = keys.mint({ userId: otherId, label: 'second' }, generator);
    expect(calls).toBe(3);
    expect(minted.key).toBe(`usl_${'Z'.repeat(24)}`);
    expect(keys.verify(taken.key).ok).toBe(true);
    expect(keys.verify(minted.key).ok).toBe(true);
  });

  it('scopes every read and write to its owner', async () => {
    const mine = keys.mint({ userId: adelId, label: 'mine' });
    const theirs = keys.mint({ userId: otherId, label: 'theirs' });

    expect(keys.listByUser(adelId).map((k) => k.id)).toEqual([mine.record.id]);
    expect(keys.listByUser(otherId).map((k) => k.id)).toEqual([theirs.record.id]);

    await assertRefusesForeignOwner([
      { name: 'revoke', act: () => keys.revoke(mine.record.id, otherId) },
      { name: 'revokeByPrefix', act: () => keys.revokeByPrefix(mine.record.key_prefix, otherId) },
      {
        name: 'listByUser',
        act: () => keys.listByUser(otherId).some((k) => k.id === mine.record.id),
      },
    ]);

    expect(keys.verify(mine.key).ok).toBe(true);
  });

  it('revokeAllForUser revokes only that user’s keys', () => {
    const mine = keys.mint({ userId: adelId, label: 'mine' });
    const theirs = keys.mint({ userId: otherId, label: 'theirs' });

    expect(keys.revokeAllForUser(adelId)).toBe(1);
    expect(keys.verify(mine.key)).toEqual({ ok: false, reason: 'revoked' });
    expect(keys.verify(theirs.key).ok).toBe(true);
  });

  it('drops unknown scopes rather than trusting them', () => {
    const { record } = keys.mint({
      userId: adelId,
      label: 'sneaky',
      scopes: ['profile:read', 'admin:everything' as Scope],
    });

    // the whitelist is applied on write…
    expect(record.scopes).toBe('profile:read');
    expect(parseScopes('profile:read,admin:everything')).toEqual(['profile:read']);
    expect(SCOPES).toHaveLength(3);
  });
});
