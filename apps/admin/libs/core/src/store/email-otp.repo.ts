import type { Db } from './db';

export interface EmailOtpRecord {
  id: number;
  user_id: number;
  code_hash: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

/**
 * Emailed sign-in codes (migration 011).
 *
 * Two rules live here rather than in the service, because they are properties of
 * the rows: **one live code at a time** (`findLive` returns the newest unconsumed
 * row) and **the send budget is counted from the rows themselves**. Consumed rows
 * are kept, never deleted — deleting them would erase the budget they document and
 * let a caller reset the limit by asking again.
 */
export class EmailOtpRepository {
  constructor(private readonly db: Db) {}

  issue(input: { userId: number; codeHash: string; expiresAt: string }): EmailOtpRecord {
    const info = this.db
      .prepare(
        `INSERT INTO email_otp (user_id, code_hash, expires_at)
         VALUES (@user_id, @code_hash, @expires_at)`,
      )
      .run({ user_id: input.userId, code_hash: input.codeHash, expires_at: input.expiresAt });
    return this.db
      .prepare('SELECT * FROM email_otp WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as EmailOtpRecord;
  }

  /** The newest code that is neither spent nor expired, or null. */
  findLive(userId: number): EmailOtpRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM email_otp
         WHERE user_id = ? AND consumed_at IS NULL
           AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
         ORDER BY id DESC LIMIT 1`,
      )
      .get(userId) as EmailOtpRecord | undefined;
    return row ?? null;
  }

  countIssuedSince(userId: number, sinceIso: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM email_otp WHERE user_id = ? AND created_at >= ?')
      .get(userId, sinceIso) as { n: number };
    return row.n;
  }

  /** Returns the new attempt count, so the caller can retire a spent code. */
  incrementAttempts(id: number): number {
    this.db.prepare('UPDATE email_otp SET attempts = attempts + 1 WHERE id = ?').run(id);
    const row = this.db.prepare('SELECT attempts FROM email_otp WHERE id = ?').get(id) as
      { attempts: number } | undefined;
    return row?.attempts ?? 0;
  }

  /** Single-use: the second caller to arrive gets false, not a second session. */
  consume(id: number): boolean {
    const info = this.db
      .prepare(
        `UPDATE email_otp SET consumed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ? AND consumed_at IS NULL`,
      )
      .run(id);
    return info.changes > 0;
  }
}
