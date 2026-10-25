import type { Db } from './db';

/** The providers this service accepts. Adding one means a CHECK constraint change. */
export type IdentityProvider = 'google' | 'github';

export interface UserIdentity {
  id: number;
  userId: number;
  provider: IdentityProvider;
  subject: string;
  email: string;
  createdAt: string;
}

interface IdentityRow {
  id: number;
  user_id: number;
  provider: IdentityProvider;
  subject: string;
  email: string;
  created_at: string;
}

const toIdentity = (row: IdentityRow): UserIdentity => ({
  id: row.id,
  userId: row.user_id,
  provider: row.provider,
  subject: row.subject,
  email: row.email,
  createdAt: row.created_at,
});

/**
 * Provider identities.
 *
 * Every method that reads or writes a link takes the user id: a link is a credential,
 * and a query that forgets whose it is would be an account-takeover primitive rather
 * than a bug.
 */
export class UserIdentitiesRepository {
  constructor(private readonly db: Db) {}

  findByProviderSubject(provider: IdentityProvider, subject: string): UserIdentity | null {
    const row = this.db
      .prepare('SELECT * FROM user_identities WHERE provider = ? AND subject = ?')
      .get(provider, subject) as IdentityRow | undefined;
    return row ? toIdentity(row) : null;
  }

  listForUser(userId: number): UserIdentity[] {
    return (
      this.db
        .prepare('SELECT * FROM user_identities WHERE user_id = ? ORDER BY created_at ASC')
        .all(userId) as IdentityRow[]
    ).map(toIdentity);
  }

  findForUser(userId: number, provider: IdentityProvider): UserIdentity | null {
    const row = this.db
      .prepare('SELECT * FROM user_identities WHERE user_id = ? AND provider = ?')
      .get(userId, provider) as IdentityRow | undefined;
    return row ? toIdentity(row) : null;
  }

  /** Idempotent by (provider, subject): linking twice is the same link, not an error. */
  link(input: {
    userId: number;
    provider: IdentityProvider;
    subject: string;
    email: string;
  }): UserIdentity {
    this.db
      .prepare(
        `INSERT INTO user_identities (user_id, provider, subject, email)
         VALUES (@user_id, @provider, @subject, @email)
         ON CONFLICT (provider, subject) DO UPDATE SET email = excluded.email`,
      )
      .run({
        user_id: input.userId,
        provider: input.provider,
        subject: input.subject,
        email: input.email,
      });

    const linked = this.findByProviderSubject(input.provider, input.subject);
    if (!linked) throw new Error('identity insert failed');
    return linked;
  }

  unlink(userId: number, provider: IdentityProvider): boolean {
    return (
      this.db
        .prepare('DELETE FROM user_identities WHERE user_id = ? AND provider = ?')
        .run(userId, provider).changes > 0
    );
  }

  countForUser(userId: number): number {
    return (
      this.db
        .prepare('SELECT COUNT(*) AS n FROM user_identities WHERE user_id = ?')
        .get(userId) as {
        n: number;
      }
    ).n;
  }
}
