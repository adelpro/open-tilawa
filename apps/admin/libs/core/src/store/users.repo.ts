import type { Db } from './db';
import type { Locale, Role, Theme } from '../types';

/**
 * The domain shape deliberately mirrors the ported `User` class from
 * `nextpalestine` (camelCase, `profilePicture`, `isTwoFAEnabled`). The SQL
 * column names stay snake_case inside this file: mapping at the boundary is
 * what lets the ported services, controllers and DTOs stay close to upstream
 * instead of every call site learning a second vocabulary.
 */
export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: Role;
  tier: string;
  status: string;
  profilePicture?: string | null;
  coverImage?: string | null;
  about?: string | null;
  socialLinks?: string[] | null;
  isActivated: boolean;
  isTwoFAEnabled: boolean;
  twoFASecrect?: string | null;
  /** True for the one account that owns this instance. Never set through `update`. */
  isOwner: boolean;
  /** Interface language. A preference, never an authorisation input. */
  locale: Locale;
  /** Interface theme. The same contract as `locale`. */
  theme: Theme;
  /** The account's default master step; runs only when a profile has none. */
  /** Set when the account has an uploaded avatar; also the cache key the SPA uses. */
  avatarUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the database returns. Never leaves this module. */
interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string | null;
  role: Role;
  tier: string;
  status: string;
  profile_picture: string | null;
  cover_image: string | null;
  about: string | null;
  social_links: string | null;
  is_activated: number;
  twofa_enabled: number;
  twofa_secret: string | null;
  is_owner: number;
  locale: Locale;
  theme: Theme;
  avatar_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Every column except the avatar bytes. `avatar_blob` is excluded on purpose: the
 * ordinary reads (/me, the admin list, the profile loader) must not drag a
 * photograph of up to half a megabyte through the API on every call.
 */
const USER_COLUMNS = `id, name, email, password_hash, role, tier, status, profile_picture,
  cover_image, about, social_links, is_activated, twofa_enabled, twofa_secret, locale, theme,
  avatar_updated_at, is_owner, created_at, updated_at`;

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  passwordHash?: string | null;
  role?: Role;
  isActivated?: boolean;
  isTwoFAEnabled?: boolean;
  twoFASecrect?: string | null;
  /** Set only by setup and the break-glass CLI; service writes use setOwner. */
  isOwner?: boolean;
}

/** The bytes of one account's avatar, as the serving route needs them. */
export interface UserAvatar {
  blob: Buffer;
  mime: string;
  updatedAt: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  passwordHash?: string | null;
  role?: Role;
  status?: string;
  tier?: string;
  about?: string | null;
  profilePicture?: string | null;
  coverImage?: string | null;
  socialLinks?: string[] | null;
  subscribers?: string[];
  isActivated?: boolean;
  isTwoFAEnabled?: boolean;
  twoFASecrect?: string | null;
  locale?: Locale;
  theme?: Theme;
  /** Ignored: sessions own tokens now. Kept so ported call sites still compile. */
  token?: string;
}

function toUser(row: UserRow, passwordHash?: string | null): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    ...(passwordHash !== undefined ? { password: passwordHash ?? undefined } : {}),
    role: row.role,
    tier: row.tier,
    status: row.status,
    profilePicture: row.profile_picture,
    coverImage: row.cover_image,
    about: row.about,
    socialLinks: row.social_links ? (JSON.parse(row.social_links) as string[]) : null,
    isActivated: row.is_activated === 1,
    isTwoFAEnabled: row.twofa_enabled === 1,
    twoFASecrect: row.twofa_secret,
    isOwner: row.is_owner === 1,
    locale: row.locale ?? 'en',
    theme: row.theme ?? 'system',
    avatarUpdatedAt: row.avatar_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMN_OF: Record<string, string> = {
  name: 'name',
  email: 'email',
  password: 'password_hash',
  role: 'role',
  status: 'status',
  tier: 'tier',
  about: 'about',
  profilePicture: 'profile_picture',
  coverImage: 'cover_image',
  socialLinks: 'social_links',
  isActivated: 'is_activated',
  isTwoFAEnabled: 'twofa_enabled',
  twoFASecrect: 'twofa_secret',
  locale: 'locale',
  theme: 'theme',
};

/** Raised when an unclaimed instance tries to create an account. */
export class InstanceNotClaimedError extends Error {
  constructor() {
    super('The instance has no owner yet');
    this.name = 'InstanceNotClaimedError';
  }
}

export type OwnerTransferFailure = 'not_owner' | 'not_super_admin' | 'same_user' | 'missing_user';

/** Raised by the ownership writes; the service maps it to an HTTP status. */
export class OwnerTransferError extends Error {
  constructor(
    readonly code: OwnerTransferFailure,
    message: string,
  ) {
    super(message);
    this.name = 'OwnerTransferError';
  }
}

/**
 * All access to `users`. Every method names the user it touches; there is no
 * query here that could span tenants by accident.
 */
export class UsersRepository {
  constructor(private readonly db: Db) {}

  create(input: CreateUserInput): User {
    // A cross-column invariant SQLite cannot express through ALTER TABLE.
    if (input.isOwner && (input.role ?? 'user') !== 'super_admin') {
      throw new Error('An owner must be a super_admin');
    }
    const info = this.db
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, is_activated, twofa_enabled, twofa_secret, is_owner)
         VALUES (@name, @email, @password_hash, @role, @is_activated, @twofa_enabled, @twofa_secret, @is_owner)`,
      )
      .run({
        name: input.name,
        email: input.email,
        password_hash: input.passwordHash ?? null,
        role: input.role ?? 'user',
        is_activated: input.isActivated ? 1 : 0,
        twofa_enabled: input.isTwoFAEnabled ? 1 : 0,
        twofa_secret: input.twoFASecrect ?? null,
        is_owner: input.isOwner ? 1 : 0,
      });
    return this.getById(Number(info.lastInsertRowid)) as User;
  }

  /**
   * Creation with the claim gate inside the same `BEGIN IMMEDIATE` transaction.
   * A plain `SELECT` followed by `INSERT` could pass the check while setup is
   * mid-transaction, so the check and the insert share one lock.
   */
  createGuarded(input: CreateUserInput): User {
    const run = this.db.transaction(() => {
      if (!this.hasOwner()) throw new InstanceNotClaimedError();
      return this.create(input);
    });
    return run.immediate();
  }

  hasOwner(): boolean {
    return (
      this.db.prepare('SELECT 1 AS n FROM users WHERE is_owner = 1 LIMIT 1').get() !== undefined
    );
  }

  getOwner(): User | null {
    const row = this.db
      .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE is_owner = 1 LIMIT 1`)
      .get() as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  /**
   * Break-glass and setup write: clear the current flag and promote the target.
   * One transaction, so a failure cannot leave the instance with two owners.
   */
  setOwner(id: number): User {
    const run = this.db.transaction(() => {
      const target = this.getById(id);
      if (!target) throw new OwnerTransferError('missing_user', 'User not found');
      this.db
        .prepare(
          `UPDATE users SET is_owner = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE is_owner = 1`,
        )
        .run();
      this.db
        .prepare(
          `UPDATE users SET is_owner = 1, role = 'super_admin', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
        )
        .run(id);
      return this.getById(id) as User;
    });
    return run.immediate();
  }

  getById(id: number): User | null {
    const row = this.db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as
      UserRow | undefined;
    return row ? toUser(row) : null;
  }

  /** `withPassword` mirrors upstream's `.select('+password')`. */
  getByEmail(email: string, withPassword = false): User | null {
    const row = this.db
      .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? COLLATE NOCASE`)
      .get(email) as UserRow | undefined;
    return row ? toUser(row, withPassword ? row.password_hash : undefined) : null;
  }

  getAll(): User[] {
    return (
      this.db.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY id`).all() as UserRow[]
    ).map((row) => toUser(row));
  }

  update(id: number, input: UpdateUserInput): User | null {
    const values: Record<string, unknown> = { id };
    const assignments: string[] = [];

    for (const [key, column] of Object.entries(COLUMN_OF)) {
      if (!(key in input)) continue;
      const value = (input as Record<string, unknown>)[key];
      if (value === undefined) continue;
      assignments.push(`${column} = @${column}`);
      values[column] =
        key === 'password'
          ? (input.passwordHash ?? null)
          : Array.isArray(value)
            ? JSON.stringify(value)
            : typeof value === 'boolean'
              ? value
                ? 1
                : 0
              : value;
    }

    // `passwordHash` is the only hashed value a caller can set, and it is absent
    // from COLUMN_OF because the domain field is called `password`. Without this
    // branch a password change was silently dropped: `UsersService.update` sends
    // `{ passwordHash }`, the loop looked for `password`, found nothing, and
    // wrote no columns at all — which made reset-password a no-op that still
    // returned 200. Found by a test that reset a password and then signed in with
    // the old one.
    if (input.passwordHash !== undefined && !('password' in input)) {
      assignments.push('password_hash = @password_hash');
      values.password_hash = input.passwordHash ?? null;
    }

    if (assignments.length === 0) return this.getById(id);

    const info = this.db
      .prepare(
        `UPDATE users SET ${assignments.join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = @id`,
      )
      .run(values);
    return info.changes === 0 ? null : this.getById(id);
  }

  /** Counted inside the caller's transaction so the last super_admin cannot be demoted (P5). */
  countActiveByRole(role: Role): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = ? AND status = 'active'")
      .get(role) as { n: number };
    return row.n;
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  }

  /** The stored hash, for `verify` at sign-in. Only ever used server-side. */
  getPasswordHash(id: number): string | null {
    const row = this.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as
      { password_hash: string | null } | undefined;
    return row?.password_hash ?? null;
  }

  /**
   * The avatar bytes, for the one route that serves them.
   *
   * Its own query on purpose: this is the only place `avatar_blob` is read, so the
   * cost of a photograph is paid once per browser request instead of on every
   * `/me`.
   */
  getAvatar(id: number): UserAvatar | null {
    const row = this.db
      .prepare('SELECT avatar_blob, avatar_mime, avatar_updated_at FROM users WHERE id = ?')
      .get(id) as
      | { avatar_blob: Buffer | null; avatar_mime: string | null; avatar_updated_at: string | null }
      | undefined;
    if (!row?.avatar_blob || !row.avatar_mime) return null;
    return {
      blob: Buffer.from(row.avatar_blob),
      mime: row.avatar_mime,
      updatedAt: row.avatar_updated_at ?? '',
    };
  }

  /** Returns the new `avatar_updated_at`, which doubles as the cache key. */
  setAvatar(id: number, blob: Buffer, mime: string): string {
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        'UPDATE users SET avatar_blob = ?, avatar_mime = ?, avatar_updated_at = ? WHERE id = ?',
      )
      .run(blob, mime, updatedAt, id);
    return updatedAt;
  }

  clearAvatar(id: number): void {
    this.db
      .prepare(
        'UPDATE users SET avatar_blob = NULL, avatar_mime = NULL, avatar_updated_at = NULL WHERE id = ?',
      )
      .run(id);
  }
}
