import type { Db } from './db';
import type { FingerprintObj, TrustedDeviceRecord } from '../types';
import { canonicalFingerprint, fingerprintHash } from './hash';

/**
 * A device that has passed 2FA. Membership is what makes the second sign-in
 * on that device quiet (the ported `signinLocal` returns 430 without it).
 * 90-day expiry mirrors the ported schema's `expires: '90d'`.
 */
export class TrustedDevicesRepository {
  constructor(private readonly db: Db) {}

  isTrusted(userId: number, fingerprint: FingerprintObj): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 AS ok FROM trusted_devices
         WHERE user_id = ? AND fingerprint_hash = ?
           AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      )
      .get(userId, fingerprintHash(fingerprint));
    return Boolean(row);
  }

  add(userId: number, fingerprint: FingerprintObj, days = 90): TrustedDeviceRecord {
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    this.db
      .prepare(
        `INSERT INTO trusted_devices (user_id, fingerprint_hash, fingerprint_json, expires_at)
         VALUES (@user_id, @fingerprint_hash, @fingerprint_json, @expires_at)
         ON CONFLICT (user_id, fingerprint_hash) DO UPDATE SET expires_at = excluded.expires_at`,
      )
      .run({
        user_id: userId,
        fingerprint_hash: fingerprintHash(fingerprint),
        fingerprint_json: canonicalFingerprint(fingerprint),
        expires_at: expiresAt,
      });
    return this.db
      .prepare('SELECT * FROM trusted_devices WHERE user_id = ? AND fingerprint_hash = ?')
      .get(userId, fingerprintHash(fingerprint)) as TrustedDeviceRecord;
  }

  listByUser(userId: number): TrustedDeviceRecord[] {
    return this.db
      .prepare('SELECT * FROM trusted_devices WHERE user_id = ? ORDER BY added_at DESC')
      .all(userId) as TrustedDeviceRecord[];
  }

  isTrustedHash(userId: number, hash: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 AS ok FROM trusted_devices
         WHERE user_id = ? AND fingerprint_hash = ?
           AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      )
      .get(userId, hash);
    return Boolean(row);
  }

  remove(userId: number, fingerprint: FingerprintObj): boolean {
    return (
      this.db
        .prepare('DELETE FROM trusted_devices WHERE user_id = ? AND fingerprint_hash = ?')
        .run(userId, fingerprintHash(fingerprint)).changes > 0
    );
  }

  removeByHash(userId: number, hash: string): boolean {
    return (
      this.db
        .prepare('DELETE FROM trusted_devices WHERE user_id = ? AND fingerprint_hash = ?')
        .run(userId, hash).changes > 0
    );
  }

  removeAllForUser(userId: number): number {
    return this.db.prepare('DELETE FROM trusted_devices WHERE user_id = ?').run(userId).changes;
  }

  removeExpired(): number {
    return this.db
      .prepare(
        "DELETE FROM trusted_devices WHERE expires_at IS NOT NULL AND expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')",
      )
      .run().changes;
  }
}
