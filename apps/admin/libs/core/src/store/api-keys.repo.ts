import type { Db } from './db';
import type { Scope } from '../scopes';
import { DEFAULT_SCOPES, formatScopes, hasScope, parseScopes } from '../scopes';
import { apiKeyPrefix, generateApiKey, hashApiKey, timingSafeHashEquals } from './hash';

/**
 * A key as the rest of the system sees it: no plaintext, no hash.
 * The hash never leaves this module, and the plaintext exists exactly once —
 * in the return value of `mint`.
 */
export interface ApiKeyRecord {
  id: number;
  user_id: number;
  label: string;
  key_prefix: string;
  scopes: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export type KeyVerification =
  | { ok: true; key: ApiKeyRecord; scopes: Scope[] }
  | { ok: false; reason: 'unknown' | 'mismatch' | 'revoked' | 'expired' };

export interface MintApiKeyInput {
  userId: number;
  label: string;
  scopes?: Scope[];
  /** ISO timestamp; omit for a key that never expires. */
  expiresAt?: string | null;
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

/** last_used_at is written at most this often per key. */
const LAST_USED_THROTTLE_MS = 60_000;

export class ApiKeysRepository {
  constructor(
    private readonly db: Db,
    private readonly pepper: string,
  ) {}

  /**
   * Mint a key. The plaintext is generated here, hashed immediately, and
   * returned once — `key_hash` is the only thing that reaches the database.
   *
   * The prefix column is UNIQUE, so a collision is a constraint failure rather
   * than a lookup that returns two rows and silently authenticates the wrong
   * one. Retrying is cheap (the space is 62^8 for the indexed part).
   */
  mint(
    input: MintApiKeyInput,
    generate: () => string = generateApiKey,
  ): {
    key: string;
    record: ApiKeyRecord;
  } {
    const scopes = input.scopes?.length ? input.scopes : DEFAULT_SCOPES;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const key = generate();
      try {
        const info = this.db
          .prepare(
            `INSERT INTO api_keys (user_id, label, key_prefix, key_hash, scopes, expires_at)
             VALUES (@user_id, @label, @key_prefix, @key_hash, @scopes, @expires_at)`,
          )
          .run({
            user_id: input.userId,
            label: input.label,
            key_prefix: apiKeyPrefix(key),
            key_hash: hashApiKey(this.pepper, key),
            scopes: formatScopes(scopes),
            expires_at: input.expiresAt ?? null,
          });
        const record = this.getById(Number(info.lastInsertRowid));
        return { key, record: record as ApiKeyRecord };
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }
    throw new Error('could not mint a key with a unique prefix');
  }

  getById(id: number): ApiKeyRecord | null {
    const row = this.db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    return (row as ApiKeyRecord) ?? null;
  }

  findByPrefix(prefix: string): ApiKeyRecord | null {
    const row = this.db.prepare('SELECT * FROM api_keys WHERE key_prefix = ?').get(prefix);
    return (row as ApiKeyRecord) ?? null;
  }

  listByUser(userId: number): ApiKeyRecord[] {
    return this.db
      .prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC, id DESC')
      .all(userId) as ApiKeyRecord[];
  }

  /**
   * Verify a presented key.
   *
   * All four failure modes are reported here so a test can tell them apart, but
   * the guard collapses them to one 401: telling a caller whether the prefix
   * existed, the body was wrong, or the key was revoked hands out information
   * about accounts they do not own.
   */
  verify(presented: string): KeyVerification {
    if (!presented.startsWith('usl_')) {
      return { ok: false, reason: 'unknown' };
    }

    const record = this.findByPrefix(apiKeyPrefix(presented));
    if (!record) {
      return { ok: false, reason: 'unknown' };
    }

    const hashRow = this.db.prepare('SELECT key_hash FROM api_keys WHERE id = ?').get(record.id) as
      { key_hash: string } | undefined;
    if (!hashRow || !timingSafeHashEquals(hashRow.key_hash, hashApiKey(this.pepper, presented))) {
      return { ok: false, reason: 'mismatch' };
    }

    if (record.revoked_at) {
      return { ok: false, reason: 'revoked' };
    }

    if (record.expires_at && record.expires_at <= new Date().toISOString()) {
      return { ok: false, reason: 'expired' };
    }

    return { ok: true, key: record, scopes: parseScopes(record.scopes) };
  }

  /** One statement, so the throttle needs no in-process state and holds across processes. */
  touchLastUsed(id: number, force = false): boolean {
    const where = force
      ? 'id = @id'
      : `id = @id AND (last_used_at IS NULL OR last_used_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${LAST_USED_THROTTLE_MS / 1000} seconds'))`;
    const info = this.db
      .prepare(`UPDATE api_keys SET last_used_at = ${NOW} WHERE ${where}`)
      .run({ id });
    return info.changes > 0;
  }

  /**
   * Revoke, always scoped by owner: a key id alone must never be enough to
   * revoke someone else's credential.
   */
  revoke(id: number, userId: number): boolean {
    return (
      this.db
        .prepare(
          `UPDATE api_keys SET revoked_at = ${NOW} WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
        )
        .run(id, userId).changes > 0
    );
  }

  /**
   * Rename, always scoped by owner. A label is metadata: the prefix, hash and
   * scopes are untouched, so this cannot widen what a key can do.
   */
  updateLabel(id: number, userId: number, label: string): ApiKeyRecord | null {
    const info = this.db
      .prepare('UPDATE api_keys SET label = ? WHERE id = ? AND user_id = ?')
      .run(label, id, userId);
    return info.changes > 0 ? this.getById(id) : null;
  }

  revokeByPrefix(prefix: string, userId: number): boolean {
    return (
      this.db
        .prepare(
          `UPDATE api_keys SET revoked_at = ${NOW} WHERE key_prefix = ? AND user_id = ? AND revoked_at IS NULL`,
        )
        .run(prefix, userId).changes > 0
    );
  }

  /** Revokes every key a user holds — used when an account is disabled or demoted (T5.7). */
  revokeAllForUser(userId: number): number {
    return this.db
      .prepare(`UPDATE api_keys SET revoked_at = ${NOW} WHERE user_id = ? AND revoked_at IS NULL`)
      .run(userId).changes;
  }

  allows(record: ApiKeyRecord, scope: Scope): boolean {
    return hasScope(parseScopes(record.scopes), scope);
  }
}
