import type { Db } from './db';

export interface RecoveryCodeRecord {
  id: number;
  user_id: number;
  code_hash: string;
  used_at: string | null;
  created_at: string;
}

/**
 * Single-use recovery codes (migration 012).
 *
 * The plaintext is never stored: only a peppered hash. `redeem` is conditional
 * on `used_at IS NULL`, so a code can be spent exactly once even under a race.
 * Regenerating a set marks the old unused rows used rather than deleting them,
 * so the history of "when was this replaced" survives.
 */
export class RecoveryCodesRepository {
  constructor(private readonly db: Db) {}

  issueMany(userId: number, codeHashes: string[]): number {
    const stmt = this.db.prepare(
      `INSERT INTO recovery_codes (user_id, code_hash) VALUES (@user_id, @code_hash)`,
    );
    let n = 0;
    for (const codeHash of codeHashes) {
      stmt.run({ user_id: userId, code_hash: codeHash });
      n += 1;
    }
    return n;
  }

  listUnused(userId: number): RecoveryCodeRecord[] {
    return this.db
      .prepare(`SELECT * FROM recovery_codes WHERE user_id = ? AND used_at IS NULL ORDER BY id`)
      .all(userId) as RecoveryCodeRecord[];
  }

  countUnused(userId: number): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL`)
      .get(userId) as { n: number };
    return row.n;
  }

  /** Conditional on `used_at IS NULL`: the loser of a race gets false. */
  redeem(userId: number, codeHash: string): boolean {
    const info = this.db
      .prepare(
        `UPDATE recovery_codes SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE user_id = ? AND code_hash = ? AND used_at IS NULL`,
      )
      .run(userId, codeHash);
    return info.changes > 0;
  }

  /** Spend every unused code, so a regenerated set starts clean. */
  invalidateAllUnused(userId: number): number {
    const info = this.db
      .prepare(
        `UPDATE recovery_codes SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE user_id = ? AND used_at IS NULL`,
      )
      .run(userId);
    return info.changes;
  }
}
