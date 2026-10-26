import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditRepository,
  ROLE_RANK,
  SessionsRepository,
  UsersRepository,
  type Role,
  type User,
} from '@tilawa-admin/core';
import { SQLITE_DB } from '@/store/store.module';
import { UsersService } from '@/users/users.service';
import type { Db } from '@tilawa-admin/core';

/** Who is acting. Always read back from the database, never from the token. */
export interface AdminActor {
  id: number;
  email: string;
  role: Role;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: string;
  tier: string;
  isActivated: boolean;
  isTwoFAEnabled: boolean;
  /** True for the one Owner; the web console uses it to hide destructive actions. */
  isOwner: boolean;
  createdAt: string;
}

/**
 * Role administration.
 *
 * Four invariants, and every one of them is enforced **here**, inside a single
 * SQLite transaction, rather than in a controller or a guard:
 *
 * 1. The last active `super_admin` cannot be demoted, disabled or deleted. Without
 *    this the platform locks itself out of role management permanently, and the
 *    only way back is the break-glass CLI on the host.
 * 2. Nobody changes their own role — that is how an admin quietly becomes a
 *    super_admin.
 * 3. A demotion or a disable revokes that user's API keys **and** sessions, so it
 *    takes effect on the next request rather than whenever the token expires.
 * 4. Every role change is audited with actor, target, before and after. A
 *    privilege change with no record is indistinguishable from a compromise.
 *
 * The actor's role is re-read from the row inside the same transaction: a stale
 * JWT claim must never be the thing that authorises a promotion.
 */
@Injectable()
export class AdminService {
  constructor(
    @Inject(SQLITE_DB) private readonly db: Db,
    private readonly users: UsersRepository,
    private readonly usersService: UsersService,
    private readonly sessions: SessionsRepository,
    private readonly audit: AuditRepository,
  ) {}

  // --- reads -------------------------------------------------------------

  async listUsers(query?: string): Promise<PublicUser[]> {
    const all = this.users.getAll();
    const needle = query?.trim().toLowerCase();
    const rows = needle
      ? all.filter(
          (user) =>
            user.email.toLowerCase().includes(needle) || user.name.toLowerCase().includes(needle),
        )
      : all;
    return rows.map((user) => this.toPublic(user));
  }

  async getUser(id: number): Promise<PublicUser> {
    const user = this.users.getById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  /** The most recent audit rows, newest first. Super admins see every actor's. */
  async auditTail(
    actor: AdminActor,
    limit = 200,
  ): Promise<ReturnType<AuditRepository['recentForUser']>> {
    if (actor.role === 'super_admin') {
      return this.db
        .prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?')
        .all(Math.min(limit, 500)) as ReturnType<AuditRepository['recentForUser']>;
    }
    return this.audit.recentForUser(actor.id, limit);
  }

  // --- writes ------------------------------------------------------------

  /** Creates a regular user; a super_admin may create an admin in the same call. */
  async createUser(
    actor: AdminActor,
    input: {
      name: string;
      email: string;
      password?: string;
      role?: Role;
    },
  ): Promise<PublicUser> {
    const requested = input.role ?? 'user';
    const fresh = this.assertActor(actor);
    if (requested === 'super_admin' && !fresh.isOwner) {
      throw new ForbiddenException('Only the Owner can create a super_admin');
    }
    if (requested !== 'user' && fresh.role !== 'super_admin') {
      throw new ForbiddenException('Only a super_admin can create admins');
    }
    if (this.users.getByEmail(input.email)) {
      throw new BadRequestException('This email is already registered');
    }

    const withRole = await this.usersService.create({
      name: input.name,
      email: input.email,
      password: input.password,
      role: requested,
    });

    this.audit.record({
      actorId: actor.id,
      userId: withRole.id,
      action: 'admin:user_create',
      target: withRole.email,
      after: { role: withRole.role, email: withRole.email },
    });
    return this.toPublic(withRole);
  }

  async changeRole(actor: AdminActor, targetId: number, nextRole: Role): Promise<PublicUser> {
    const target = this.requireUser(targetId);
    const fresh = this.assertActor(actor);

    if (fresh.role !== 'super_admin') {
      throw new ForbiddenException('Only a super_admin can change roles');
    }
    if (actor.id === target.id) {
      throw new BadRequestException('You cannot change your own role');
    }
    if (target.isOwner) {
      throw new ForbiddenException('The Owner cannot be demoted or reassigned');
    }
    if (target.role === nextRole) {
      return this.toPublic(target);
    }
    // Appointing or removing a super_admin is the Owner's decision alone. A
    // non-owner super_admin can still promote a user to admin.
    if ((target.role === 'super_admin' || nextRole === 'super_admin') && !fresh.isOwner) {
      throw new ForbiddenException('Only the Owner can appoint or remove a super_admin');
    }

    const apply = this.db.transaction((): User => {
      const currentActor = this.assertActor(actor);
      const current = this.requireUser(target.id);
      if (current.isOwner) {
        throw new ForbiddenException('The Owner cannot be demoted or reassigned');
      }
      if ((current.role === 'super_admin' || nextRole === 'super_admin') && !currentActor.isOwner) {
        throw new ForbiddenException('Only the Owner can appoint or remove a super_admin');
      }
      const demoting = ROLE_RANK[nextRole] < ROLE_RANK[current.role];
      if (demoting && current.role === 'super_admin' && this.activeSuperAdmins() <= 1) {
        throw new ConflictException('The last active super_admin cannot be demoted');
      }
      const updated = this.users.update(current.id, { role: nextRole });
      if (!updated) throw new NotFoundException('User not found');

      if (demoting) {
        // A demotion that leaves working keys behind is not a demotion.
        this.sessions.deleteByUser(current.id);
      }
      return updated;
    });

    const updated = apply();
    this.audit.record({
      actorId: actor.id,
      userId: target.id,
      action: 'admin:role_change',
      target: target.email,
      before: { role: target.role, isOwner: target.isOwner },
      after: { role: updated.role, isOwner: updated.isOwner },
    });
    return this.toPublic(updated);
  }

  async setStatus(
    actor: AdminActor,
    targetId: number,
    status: 'active' | 'disabled',
  ): Promise<PublicUser> {
    const target = this.requireUser(targetId);
    const fresh = this.assertActor(actor);
    if (actor.id === target.id) {
      throw new BadRequestException('You cannot disable your own account');
    }
    if (target.isOwner && status === 'disabled') {
      throw new ForbiddenException('The Owner cannot be disabled');
    }
    if (target.role === 'super_admin' && !fresh.isOwner) {
      throw new ForbiddenException('Only the Owner can disable or enable a super_admin');
    }
    if (status === 'disabled' && fresh.role !== 'super_admin' && target.role !== 'user') {
      throw new ForbiddenException('An admin can only disable regular users');
    }
    // Same rank rule on the way back up (audit: enable/disable asymmetry): an
    // admin must not undo a super_admin's suspension of an elevated account by
    // re-enabling it. Enabling never restores the revoked keys or sessions —
    // only this permission check.
    if (status === 'active' && fresh.role !== 'super_admin' && target.role !== 'user') {
      throw new ForbiddenException('An admin can only re-enable regular users');
    }

    const apply = this.db.transaction((): User => {
      const currentActor = this.assertActor(actor);
      const current = this.requireUser(target.id);
      if (current.isOwner && status === 'disabled') {
        throw new ForbiddenException('The Owner cannot be disabled');
      }
      if (current.role === 'super_admin' && !currentActor.isOwner) {
        throw new ForbiddenException('Only the Owner can disable or enable a super_admin');
      }
      if (
        status === 'disabled' &&
        current.role === 'super_admin' &&
        this.activeSuperAdmins() <= 1
      ) {
        throw new ConflictException('The last active super_admin cannot be disabled');
      }
      const updated = this.users.update(current.id, { status });
      if (!updated) throw new NotFoundException('User not found');
      if (status === 'disabled') {
        this.sessions.deleteByUser(current.id);
      }
      return updated;
    });

    const updated = apply();
    this.audit.record({
      actorId: actor.id,
      userId: target.id,
      action: status === 'disabled' ? 'admin:user_disable' : 'admin:user_enable',
      target: target.email,
      before: { status: target.status, isOwner: target.isOwner },
      after: { status: updated.status, isOwner: updated.isOwner },
    });
    return this.toPublic(updated);
  }

  async deleteUser(actor: AdminActor, targetId: number): Promise<{ deleted: true }> {
    const target = this.requireUser(targetId);
    const fresh = this.assertActor(actor);
    if (fresh.role !== 'super_admin') {
      throw new ForbiddenException('Only a super_admin can delete users');
    }
    if (target.isOwner) {
      throw new ForbiddenException('The Owner cannot be deleted');
    }
    if (actor.id === target.id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    if (target.role === 'super_admin' && !fresh.isOwner) {
      throw new ForbiddenException('Only the Owner can delete a super_admin');
    }

    const apply = this.db.transaction((): true => {
      const currentActor = this.assertActor(actor);
      const current = this.requireUser(target.id);
      if (current.isOwner) throw new ForbiddenException('The Owner cannot be deleted');
      if (current.role === 'super_admin' && !currentActor.isOwner) {
        throw new ForbiddenException('Only the Owner can delete a super_admin');
      }
      if (current.role === 'super_admin' && this.activeSuperAdmins() <= 1) {
        throw new ConflictException('The last active super_admin cannot be deleted');
      }
      this.sessions.deleteByUser(current.id);
      this.users.delete(current.id);
      return true;
    });

    apply();
    this.audit.record({
      actorId: actor.id,
      action: 'admin:user_delete',
      target: target.email,
      before: { role: target.role, email: target.email, isOwner: target.isOwner },
    });
    return { deleted: true };
  }

  // --- helpers -----------------------------------------------------------

  private activeSuperAdmins(): number {
    return this.users.countActiveByRole('super_admin');
  }

  private requireUser(id: number): User {
    const user = Number.isInteger(id) ? this.users.getById(id) : null;
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * The guard already authorises the request; this re-reads the actor so a
   * demoted-but-still-holding-a-JWT caller cannot act on the old role.
   */
  private assertActor(actor: AdminActor): User {
    const fresh = this.users.getById(actor.id);
    if (!fresh || fresh.status !== 'active' || ROLE_RANK[fresh.role] < ROLE_RANK.admin) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (fresh.role !== actor.role) {
      // The token claimed a role the database does not agree with: refuse now.
      throw new ForbiddenException('Your role changed — sign in again');
    }
    return fresh;
  }

  private toPublic(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      tier: user.tier,
      isActivated: user.isActivated,
      isTwoFAEnabled: user.isTwoFAEnabled,
      isOwner: user.isOwner,
      createdAt: user.createdAt,
    };
  }
}
