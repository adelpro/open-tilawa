import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Role } from '@tilawa-admin/core';
import { AuthenticatedUser } from '@/auth/types/authenticatedUser.type';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { RoleGuard } from '@/auth/guards/roles.guard';
import { AdminChangeRoleDTO, AdminCreateUserDTO } from './admin.dto';
import { AdminActor, AdminService, PublicUser } from './admin.service';

/**
 * `/admin` is the support surface; `/superadmin` in the console maps onto the
 * same routes, and the difference is enforced per method rather than per path.
 *
 * `@Roles` is read from the handler by `RoleGuard`, and comparison is by rank, so
 * `@Roles('admin')` is satisfied by `super_admin` — one route can serve both
 * consoles without duplicating anything.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** The token's role is a claim; the service re-reads it before acting. */
  private actorOf(user: AuthenticatedUser): AdminActor {
    return { id: Number(user.id), email: user.email, role: (user.role ?? 'user') as Role };
  }

  @Roles('admin')
  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List users, optionally filtered by name or email' })
  listUsers(@Query('q') q?: string): Promise<PublicUser[]> {
    return this.admin.listUsers(q);
  }

  @Roles('admin')
  @Get('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'One user' })
  getUser(@Param('id', ParseIntPipe) id: number): Promise<PublicUser> {
    return this.admin.getUser(id);
  }

  @Roles('admin')
  @Post('users')
  @ApiOperation({ summary: 'Create a user (a super_admin may create an admin)' })
  @ApiBody({ type: AdminCreateUserDTO })
  createUser(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: AdminCreateUserDTO,
  ): Promise<PublicUser> {
    return this.admin.createUser(this.actorOf(currentUser), dto);
  }

  @Roles('admin')
  @Post('users/:id/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a user and revoke their keys and sessions' })
  disable(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublicUser> {
    return this.admin.setStatus(this.actorOf(currentUser), id, 'disabled');
  }

  @Roles('admin')
  @Post('users/:id/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-enable a user' })
  enable(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublicUser> {
    return this.admin.setStatus(this.actorOf(currentUser), id, 'active');
  }

  @Roles('super_admin')
  @Post('users/:id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change a role (super_admin only, audited, last one protected)' })
  @ApiBody({ type: AdminChangeRoleDTO })
  changeRole(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminChangeRoleDTO,
  ): Promise<PublicUser> {
    return this.admin.changeRole(this.actorOf(currentUser), id, dto.role);
  }

  @Roles('super_admin')
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user and everything they own (super_admin only)' })
  deleteUser(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ deleted: true }> {
    return this.admin.deleteUser(this.actorOf(currentUser), id);
  }

  @Roles('admin')
  @Get('audit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recent audit rows (a super_admin sees every actor)' })
  @ApiResponse({ status: 200, description: 'Newest first' })
  audit(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.admin.auditTail(this.actorOf(currentUser), limit ?? 200);
  }
}
