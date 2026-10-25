import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_RANK, type Role } from '@tilawa-admin/core';
import { UsersService } from '@/users/users.service';
import type { AuthenticatedUser } from '../types/authenticatedUser.type';

/**
 * Ported from nextpalestine's `roles.guard.ts`, with two deliberate changes:
 *
 * 1. **The role is re-read from the database on every request.** Upstream did
 *    this too, and it is the property that makes the whole role model work: a
 *    demotion takes effect on the next call, not whenever the token expires.
 *    The `role` claim inside the JWT is never trusted for authorisation.
 * 2. **Comparison is by rank, not equality.** `@Roles('admin')` must be
 *    satisfied by `super_admin`; upstream compared against a two-value union
 *    (`'user' | 'admin'`) so this case did not exist there.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  private satisfies(required: Role[], actual: Role): boolean {
    return required.some((role) => ROLE_RANK[actual] >= ROLE_RANK[role]);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<Role[]>('roles', context.getHandler());
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException('Forbidden resource');
    }

    // Resolve by the stable token id, not the mutable email claim: after a
    // self-service email change, the claim no longer matches the row and
    // authorising on the freed address would hand the old role to the wrong
    // account. Fail-closed when the id has no matching row.
    const found = await this.usersService.getUserById(user.id);
    if (!found || found.status !== 'active') {
      throw new ForbiddenException('Forbidden resource');
    }

    if (!this.satisfies(required, found.role)) {
      throw new ForbiddenException('Forbidden resource');
    }
    return true;
  }
}
