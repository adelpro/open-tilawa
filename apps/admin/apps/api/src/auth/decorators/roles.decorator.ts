import { SetMetadata } from '@nestjs/common';
import { Role } from '../types/roles.type';

/**
 * `@Roles('admin')` and `@Roles(['admin', 'super_admin'])` are both accepted, and
 * both are stored as an array.
 *
 * The ported version stored whatever it was given, so `@Roles('admin')` put a
 * **string** in the metadata and `RoleGuard` called `.some()` on it — a 500 on
 * every role-protected route, including the two that shipped in P2. Found by the
 * first admin test.
 */
export const Roles = (roles: Role[] | Role) =>
  SetMetadata('roles', Array.isArray(roles) ? roles : [roles]);
