import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { UsersService } from '@/users/users.service';
import { ROLE_RANK, type Role } from '@tilawa-admin/core';
import { AvatarService } from './avatar.service';
import type { AvatarUploadResult } from './avatar.service';

/**
 * The account's own avatar: set it, remove it.
 *
 * The body is read from the raw request stream rather than through a multipart
 * parser: a single field called "image" does not justify `multer`, and reading the
 * stream is what lets the 512 KB cap abort the connection instead of buffering a
 * large upload first.
 */
@UseGuards(JWTAuthGuard)
@Controller('me/avatar')
export class MeAvatarController {
  constructor(private readonly avatars: AvatarService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload or replace the current account avatar' })
  @ApiResponse({ status: 200, description: 'Stored; returns the new cache key' })
  @ApiResponse({ status: 413, description: 'Larger than 512 KB' })
  @ApiResponse({ status: 415, description: 'Not a JPEG, PNG or WebP image' })
  async upload(
    @CurrentUser('id') id: string | number,
    @Req() request: Request,
  ): Promise<AvatarUploadResult> {
    return this.avatars.accept(Number(id), request);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove the current account avatar' })
  remove(@CurrentUser('id') id: string | number): { removed: true } {
    this.avatars.clear(Number(id));
    return { removed: true };
  }
}

/**
 * Serving an avatar.
 *
 * It answers `<img>` requests, so every header here is load-bearing:
 * `nosniff` plus a `default-src 'none'` policy stop a polyglot file (valid JPEG,
 * also valid HTML) from executing in the origin that holds the session cookie;
 * the content type comes from what we stored, never from the request;
 * `private` keeps a shared cache from handing one account's face to another.
 */
@UseGuards(JWTAuthGuard)
@Controller('avatar')
export class AvatarController {
  constructor(
    private readonly avatars: AvatarService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * The read predicate: an account may always see its own face, and an elevated
   * account may see any — the admin console renders avatars next to names it
   * already has authority over. Everyone else gets the same 404 the
   * `no avatar` case answers, so an id sweep cannot separate "no photo" from
   * "not yours". The role is re-read from the database, never taken from the
   * token claim, matching the RoleGuard's rule.
   */
  private async mayServe(viewer: { id: string | number }, id: number): Promise<boolean> {
    if (Number(viewer.id) === id) return true;
    const account = await this.usersService.getUserById(viewer.id);
    return ROLE_RANK[account.role as Role] >= ROLE_RANK['admin'];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Serve one account avatar' })
  @ApiResponse({ status: 200, description: 'The image bytes' })
  @ApiResponse({ status: 404, description: 'This account has no avatar' })
  async serve(
    @CurrentUser() viewer: { id: string | number },
    @Param('id', ParseIntPipe) id: number,
    @Res() response: Response,
  ): Promise<void> {
    if (!(await this.mayServe(viewer, id))) {
      response.status(HttpStatus.NOT_FOUND).json({ message: 'This account has no avatar' });
      return;
    }
    const avatar = this.avatars.read(id);
    if (!avatar) {
      response.status(HttpStatus.NOT_FOUND).json({ message: 'This account has no avatar' });
      return;
    }

    const etag = `"${createHash('sha256').update(avatar.updatedAt).digest('hex').slice(0, 16)}"`;
    if (response.req.headers['if-none-match'] === etag) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    response.setHeader('Content-Type', avatar.mime);
    response.setHeader('Content-Length', String(avatar.blob.length));
    response.setHeader('ETag', etag);
    // `private`: the browser may keep it, a shared proxy may not.
    response.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    response.setHeader('Content-Disposition', 'inline; filename="avatar"');
    response.status(HttpStatus.OK).end(avatar.blob);
  }
}
