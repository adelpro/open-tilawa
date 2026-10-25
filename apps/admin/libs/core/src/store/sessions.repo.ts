import { randomBytes } from 'node:crypto';
import type { Db } from './db';
import type { SessionRecord } from '../types';
import { fingerprintHash, sha256 } from './hash';

/**
 * Sessions live server-side so signout is a row delete rather than a wait for
 * expiry: the JWT is only accepted while its row exists.
 *
 * The lookup key is sha256(token) — deterministic. See 002_auth.sql for why
 * this is not argon2.
 */
export class SessionsRepository {
  constructor(private readonly db: Db) {}

  static newToken(): string {
    return randomBytes(32).toString('base64url');
  }

  static hashToken(token: string): string {
    return sha256(token);
  }

  /** One session per (user, device): a new sign-in replaces that device's row. */
  upsertByFingerprint(params: {
    userId: number;
    token: string;
    fingerprint?: Record<string, unknown> | null;
    ttlMs: number;
  }): SessionRecord {
    const { userId, token, fingerprint, ttlMs } = params;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const fpHash = fingerprint ? fingerprintHash(fingerprint) : null;
    const fpJson = fingerprint ? JSON.stringify(fingerprint) : null;
    const tokenHash = SessionsRepository.hashToken(token);

    if (fpHash) {
      this.db
        .prepare(
          `INSERT INTO sessions (user_id, token_hash, fingerprint_hash, fingerprint_json, expires_at)
           VALUES (@user_id, @token_hash, @fingerprint_hash, @fingerprint_json, @expires_at)
           ON CONFLICT (user_id, fingerprint_hash) DO UPDATE SET
             token_hash = excluded.token_hash,
             fingerprint_json = excluded.fingerprint_json,
             expires_at = excluded.expires_at,
             created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
        )
        .run({
          user_id: userId,
          token_hash: tokenHash,
          fingerprint_hash: fpHash,
          fingerprint_json: fpJson,
          expires_at: expiresAt,
        });
    } else {
      this.db
        .prepare(
          `INSERT INTO sessions (user_id, token_hash, expires_at)
           VALUES (@user_id, @token_hash, @expires_at)`,
        )
        .run({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
    }

    return this.findByTokenHash(tokenHash) as SessionRecord;
  }

  findByTokenHash(tokenHash: string): SessionRecord | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
    return (row as SessionRecord) ?? null;
  }

  /** Resolves a live session, or null when expired/unknown. Used by the JWT extractor. */
  findLiveByToken(token: string): SessionRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE token_hash = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
      )
      .get(SessionsRepository.hashToken(token));
    return (row as SessionRecord) ?? null;
  }

  getByFingerprint(userId: number, fingerprint: Record<string, unknown>): SessionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM sessions WHERE user_id = ? AND fingerprint_hash = ?')
      .get(userId, fingerprintHash(fingerprint));
    return (row as SessionRecord) ?? null;
  }

  listByUser(userId: number): SessionRecord[] {
    return this.db
      .prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as SessionRecord[];
  }

  deleteByToken(token: string): number {
    return this.db
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .run(SessionsRepository.hashToken(token)).changes;
  }

  deleteByFingerprint(userId: number, fingerprint: Record<string, unknown>): boolean {
    return (
      this.db
        .prepare('DELETE FROM sessions WHERE user_id = ? AND fingerprint_hash = ?')
        .run(userId, fingerprintHash(fingerprint)).changes > 0
    );
  }

  deleteById(id: number): boolean {
    return this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id).changes > 0;
  }

  /** Revokes everything a user holds — used when an account is disabled or demoted. */
  deleteByUser(userId: number): number {
    return this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId).changes;
  }

  deleteExpired(): number {
    return this.db
      .prepare("DELETE FROM sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')")
      .run().changes;
  }
}
