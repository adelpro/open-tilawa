import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionsRepository } from '@tilawa-admin/core';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import type { AuthenticatedUser } from '@/auth/types/authenticatedUser.type';
import { TrustedDevicesService } from '@/trusted-devices/trusted-devices.service';
import { describeFingerprint } from './device-label';
import { MyTokensResponseDTO } from './dtos/myTokensResponseDTO.dto';
import { MyTokensResponseWithCurrentTokenDTO } from './dtos/myTokensResponseWithCurrentTokenDTO.dto';
import { TokensService } from './tokens.service';

/**
 * The signed-in devices for the current account. Ported from nextpalestine's
 * `tokens.controller.ts`, retyped onto sessions: the token value never leaves
 * the server, and rows are identified by session id rather than a Mongo `_id`.
 */
@ApiTags('tokens')
@Controller('tokens')
@UseGuards(JWTAuthGuard)
export class TokensController {
  constructor(
    private readonly tokensService: TokensService,
    private readonly trustedDevices: TrustedDevicesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the devices currently signed in' })
  @ApiResponse({ status: 200, type: [MyTokensResponseDTO] })
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MyTokensResponseWithCurrentTokenDTO[]> {
    const sessions = await this.tokensService.getTokensByUserId(user.id);
    const currentHash = SessionsRepository.hashToken(user.token);
    return Promise.all(
      sessions.map(async (session) => {
        const isTrusted = session.fingerprint_hash
          ? await this.trustedDevices.isTrustedHash(user.id, session.fingerprint_hash)
          : false;
        return new MyTokensResponseWithCurrentTokenDTO(
          session,
          session.token_hash === currentHash,
          isTrusted,
          describeFingerprint(session.fingerprint_json),
        );
      }),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one device and forget its 2FA trust' })
  async revoke(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ revoked: boolean }> {
    const sessions = await this.tokensService.getTokensByUserId(user.id);
    // A user may only revoke their own device: the lookup is scoped by user id.
    const owned = sessions.find((session) => String(session.id) === String(id));
    if (!owned) {
      return { revoked: false };
    }
    // Deleting a device means the next sign-in on it asks for a 2FA code again:
    // leaving the trust row behind would silently skip the challenge.
    if (owned.fingerprint_hash) {
      await this.trustedDevices.deleteByFingerprintHash(user.id, owned.fingerprint_hash);
    }
    return { revoked: await this.tokensService.deleteTokenById(Number(id)) };
  }
}
