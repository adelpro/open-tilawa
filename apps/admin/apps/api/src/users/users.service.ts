import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { hash as argonHash } from '@node-rs/argon2';
import { InstanceNotClaimedError, UsersRepository, type Role, type User } from '@tilawa-admin/core';
import { argonConfig } from '@/config/argon.config';

/**
 * Ported from nextpalestine's `users.service.ts`.
 *
 * The method shape is unchanged on purpose — `getUserById`, `getUserByEmail(email,
 * '+password')`, `create`, `update`, `activate`, `delete` — so the rest of the
 * crop keeps compiling against it.
 *
 * One behavioural difference, and it is the point of the rewrite: hashing used
 * to happen invisibly in Mongoose pre-save hooks. SQLite has no hooks, so it is
 * explicit here. A caller that forgets it would store a plaintext password,
 * which is exactly the mistake this makes impossible to miss.
 */
@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  private static toId(id: string | number): number {
    const value = typeof id === 'number' ? id : Number(id);
    if (!Number.isInteger(value) || value <= 0) {
      throw new NotFoundException('User not found');
    }
    return value;
  }

  async create(
    user: {
      name: string;
      email: string;
      password?: string;
      role?: Role;
      isActivated?: boolean;
      /** Setup and the break-glass CLI are the only legitimate callers. */
      isOwner?: boolean;
    },
    options: { allowUnclaimed?: boolean } = {},
  ): Promise<User> {
    if (user.isOwner && (user.role ?? 'user') !== 'super_admin') {
      throw new Error('An owner must be a super_admin');
    }
    const passwordHash = user.password ? await this.hashPassword(user.password) : null;
    try {
      const input = {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        isActivated: user.isActivated,
        isOwner: user.isOwner,
      };
      return options.allowUnclaimed ? this.users.create(input) : this.users.createGuarded(input);
    } catch (err) {
      if (err instanceof InstanceNotClaimedError) {
        throw new ServiceUnavailableException('Setup has not been completed');
      }
      throw err;
    }
  }

  /** One hashing configuration for every caller, including the setup transaction. */
  async hashPassword(password: string): Promise<string> {
    return argonHash(password, argonConfig);
  }

  hasOwner(): boolean {
    return this.users.hasOwner();
  }

  countActiveSuperAdmins(): number {
    return this.users.countActiveByRole('super_admin');
  }

  /** The claim gate, called by the public creation paths before any lookup. */
  assertClaimed(): void {
    if (!this.users.hasOwner()) {
      throw new ServiceUnavailableException('Setup has not been completed');
    }
  }

  /** Used by setup and the claim checks; the flag is never taken from a token. */
  getOwner(): User | null {
    return this.users.getOwner();
  }

  async getAll(): Promise<User[]> {
    return this.users.getAll();
  }

  /** The second argument is upstream's Mongo projection; only '+password' matters. */
  async getUserById(id: string | number, selectFields = ''): Promise<User & { password?: string }> {
    const record = this.users.getById(UsersService.toId(id));
    if (!record) throw new NotFoundException('User not found');
    if (selectFields.includes('+password')) {
      return { ...record, password: this.users.getPasswordHash(record.id) ?? undefined };
    }
    return record;
  }

  async getUserByEmail(
    email: string,
    selectFields = '',
  ): Promise<(User & { password?: string }) | null> {
    return this.users.getByEmail(email, selectFields.includes('+password'));
  }

  /**
   * The same lookup as `getUserById`, for callers asking "does this account exist?"
   * rather than "give me this account".
   *
   * A provider callback carries a user id from a signed cookie, and the honest answer
   * when the account was deleted in between is `null`, not a 404 thrown into a redirect.
   */
  async findById(id: string | number, selectFields = ''): Promise<User | null> {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;
    const record = this.users.getById(numeric);
    if (!record) return null;
    if (selectFields.includes('+password')) {
      return { ...record, password: this.users.getPasswordHash(record.id) ?? undefined };
    }
    return record;
  }

  async update(id: string | number, changes: Partial<User> & { password?: string }): Promise<User> {
    const userId = UsersService.toId(id);
    const found = this.users.getById(userId);
    if (!found) throw new NotFoundException('User not found');

    const patch: Parameters<UsersRepository['update']>[1] = {
      name: changes.name,
      email: changes.email,
      role: changes.role,
      about: changes.about,
      profilePicture: changes.profilePicture,
      coverImage: changes.coverImage,
      socialLinks: changes.socialLinks,
      isTwoFAEnabled: changes.isTwoFAEnabled,
      twoFASecrect: changes.twoFASecrect,
      // An interface preference, so it never invalidates anything and needs no
      // verification: the worst a wrong value can do is render the other language.
      locale: changes.locale,
      // The same category of preference as `locale`, stored beside it.
      theme: changes.theme,
    };

    // Changing an email invalidates activation by default, as upstream did. A
    // confirmed change is the exception: the caller proved the new mailbox, so
    // it passes `isActivated: true` explicitly and that wins.
    const emailChanged =
      Boolean(changes.email) && changes.email!.toLowerCase() !== found.email.toLowerCase();
    patch.isActivated = emailChanged ? (changes.isActivated ?? false) : changes.isActivated;

    if (changes.password) {
      patch.passwordHash = await argonHash(changes.password, argonConfig);
    }

    const updated = this.users.update(userId, patch);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async activate(id: string | number, changes: Partial<User>): Promise<User> {
    const updated = this.users.update(UsersService.toId(id), { ...changes, isActivated: true });
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async delete(id: string | number): Promise<User | null> {
    const userId = UsersService.toId(id);
    const found = this.users.getById(userId);
    if (!found) throw new NotFoundException('User not found');
    this.users.delete(userId);
    return found;
  }
}
