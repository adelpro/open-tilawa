import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { type Locale, type Theme, type User } from '@tilawa-admin/core';
import { TrustedDevicesService } from '@/trusted-devices/trusted-devices.service';
import { AuthenticatedUser } from '@/auth/types/authenticatedUser.type';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import { Fingerprint } from '@/auth/decorators/fingerprint.decorator';
import { ErrorResponseDTO } from '@/auth/dtos/errorResponse.sto';
import { FingerprintObj } from '@/auth/types/fingerprint.type';
import { UpdateUserDTO } from '@/auth/dtos/updateUser.dto';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { UsersService } from '@/users/users.service';
import { AuthService } from '@/auth/auth.service';
import { MeService } from './me.service';
import { Response } from 'express';

/**
 * The current account. Ported from nextpalestine's `me.controller.ts`, with the
 * post-authoring routes (6) and the image routes (5) removed — see
 * docs/UPSTREAM.md.
 *
 * Activation is **not** here any more. It served an account that cannot hold a
 * session, so it lives at `POST /auth/local/activate` (public, token in the
 * body) and `POST /auth/local/resend-activation`. Everything below requires a
 * session, which is now true of every route that claims to.
 */
@UseGuards(JWTAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly userService: UsersService,
    private readonly trustedDevice: TrustedDevicesService,
    private readonly meService: MeService,
    private readonly authService: AuthService,
  ) {}

  /**
   * The text a new account copies into its own agent, in both variants.
   *
   * Both, in one response, because the client already knows which one it is showing and a
   * second round trip to switch tabs is a visible delay for no benefit. It is generated at
   * request time from the same field list the validator uses, so it cannot describe a manifest
   * this server would refuse.
   */
  @Get()
  @ApiResponse({ status: 200, description: 'Get current user' })
  @ApiOperation({ summary: 'Get the current user' })
  @HttpCode(HttpStatus.OK)
  async getMe(
    @CurrentUser('id') id: string | number,
    @Fingerprint() fingerprint: FingerprintObj,
  ): Promise<
    Omit<AuthenticatedUser, 'token'> & {
      isDeviceTrusted: boolean;
      passwordSet: boolean;
      locale: Locale;
      theme: Theme;
    }
  > {
    const user = await this.userService.getUserById(id);
    const { email, name, about, role, isActivated, isTwoFAEnabled, avatarUpdatedAt, isOwner } =
      user;
    const isDeviceTrusted = await this.trustedDevice.isDeviceTrusted(id, fingerprint);
    // Whether a password exists is a different fact from whether one can be typed: an
    // account created through a provider has none until its owner sets one, and the
    // Account screen has to know which of the two it is looking at.
    const withPassword = await this.userService.findById(id, '+password');
    return {
      id,
      email,
      name,
      about: about ?? undefined,
      role: role || 'user',
      isOwner: Boolean(isOwner),
      isActivated: isActivated || false,
      isTwoFAEnabled: isTwoFAEnabled || false,
      avatarUpdatedAt: avatarUpdatedAt ?? null,
      isDeviceTrusted,
      passwordSet: Boolean(withPassword?.password),
      // The SPA reads this before it decides which catalogue to render, so it travels
      // with the session rather than needing a second request on every page load.
      locale: user.locale ?? 'en',
      // Same contract: the account's theme is the fallback for a device that has not
      // chosen one. The device's own choice still wins in the browser.
      theme: user.theme ?? 'system',
    };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: UpdateUserDTO })
  @ApiResponse({ status: 200, description: 'Current user updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDTO })
  @ApiOperation({ summary: 'Update the current user' })
  async updateMe(
    @CurrentUser('id') id: string | number,
    @Body() updateUser: UpdateUserDTO,
  ): Promise<User | null> {
    // `role`, `status` and `isActivated` are not in this DTO on purpose: a user
    // must not be able to promote themselves through their own profile.
    const changes: Partial<User> = { ...updateUser.user };

    return this.userService.update(id, changes);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete the current user' })
  @ApiResponse({ status: 200, description: 'Current user deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDTO })
  async deleteMe(
    @Res({ passthrough: true }) response: Response,
    @CurrentUser('id') id: string | number,
  ): Promise<{ message: string; id: number }> {
    const deleted = await this.meService.deleteAccount(id);
    response.clearCookie('token');
    return { message: 'Account deleted', id: deleted.id };
  }

  @Post('/update-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update password (revokes every other session)' })
  @ApiResponse({ status: 200, description: 'Password updated, this device re-issued a session' })
  async updatePassword(
    @Body() data: { oldPassword: string; newPassword: string },
    @Res({ passthrough: true }) response: Response,
    @CurrentUser('id') id: string | number,
    @Fingerprint() fingerprint: FingerprintObj,
  ): Promise<{ message: string }> {
    const { message, token } = await this.meService.updatePassword(
      id,
      data.oldPassword,
      data.newPassword,
      fingerprint,
    );
    response.cookie('token', token, this.authService.getCookieOptions());
    return { message };
  }
}
