import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { AuthService } from '@/auth/auth.service';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import { Fingerprint } from '@/auth/decorators/fingerprint.decorator';
import { UsersService } from '@/users/users.service';
import type { FingerprintObj } from '@/auth/types/fingerprint.type';
import { TwoFaGuard, TwoFaUser } from './guards/two-fa.guard';
import type { TwoFaActor } from './guards/two-fa.guard';
import {
  TwoFaDisableDTO,
  TwoFaEmailCodeVerifyDTO,
  TwoFaRecoveryDTO,
  TwoFaRegenerateDTO,
  TwoFaTOTPDTO,
} from './dtos/two-fa.dto';
import { TwoFaService } from './two-fa.service';
import type { Response } from 'express';

/**
 * The second-factor routes.
 *
 * Challenge endpoints accept the pending 430 grant (the `TwoFaGuard`), and only
 * they do: `/2fa/enable` and `/2fa/recovery/regenerate` sit behind the ordinary
 * `JWTAuthGuard`, so a password that has *not yet passed a code* cannot switch
 * the factor on or inventory the recovery set.
 */
@Controller('2fa')
export class TwoFaController {
  constructor(
    private readonly twoFa: TwoFaService,
    private readonly authService: AuthService,
    private readonly users: UsersService,
  ) {}

  /** Enrolment: a fresh secret and its QR. Only a full session may call it. */
  @UseGuards(JWTAuthGuard)
  @Get('enable')
  async enable(@CurrentUser('id') id: string | number) {
    const user = await this.users.getUserById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.twoFa.enable(user);
  }

  /**
   * The challenge answer. A pending grant becomes a full session here — the
   * cookie below is the session, not the grant — and the first verified code
   * both enables the factor and issues the recovery set.
   */
  @UseGuards(TwoFaGuard)
  @HttpCode(HttpStatus.OK)
  @Post('verify')
  async verify(
    @Res({ passthrough: true }) response: Response,
    @Body() body: TwoFaTOTPDTO,
    @TwoFaUser() actor: TwoFaActor,
    @Fingerprint() fingerprint: FingerprintObj,
  ) {
    const result = await this.twoFa.verify(actor.id, '', body.TOTP, fingerprint, actor.pending);
    if (result.token) {
      response.cookie('token', result.token, this.authService.getCookieOptions());
    }
    return {
      message: result.message,
      enrolled: result.recoveryCodes !== undefined,
      recoveryCodes: result.recoveryCodes,
    };
  }

  /** The emailed fallback, for an authenticator that is lost. */
  @UseGuards(TwoFaGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('email-code')
  async requestEmailCode(@TwoFaUser() actor: TwoFaActor) {
    const user = await this.users.getUserById(actor.id);
    if (!user) throw new NotFoundException('User not found');
    const result = await this.twoFa.requestEmailCode(user);
    return { message: result.message };
  }

  @UseGuards(TwoFaGuard)
  @HttpCode(HttpStatus.OK)
  @Post('email-code/verify')
  async verifyEmailCode(
    @Res({ passthrough: true }) response: Response,
    @Body() body: TwoFaEmailCodeVerifyDTO,
    @TwoFaUser() actor: TwoFaActor,
    @Fingerprint() fingerprint: FingerprintObj,
  ) {
    const result = await this.twoFa.verifyEmailCode(
      actor.id,
      body.code,
      fingerprint,
      actor.pending,
    );
    if (result.token) {
      response.cookie('token', result.token, this.authService.getCookieOptions());
    }
    return { message: result.message };
  }

  @UseGuards(TwoFaGuard)
  @HttpCode(HttpStatus.OK)
  @Post('recovery')
  async redeemRecovery(
    @Res({ passthrough: true }) response: Response,
    @Body() body: TwoFaRecoveryDTO,
    @TwoFaUser() actor: TwoFaActor,
    @Fingerprint() fingerprint: FingerprintObj,
  ) {
    if (!actor.pending) {
      // A full session has nothing to recover from; the route exists for the
      // 430 state and only there.
      throw new UnauthorizedException('Use the authenticator code instead');
    }
    const result = await this.twoFa.redeemRecoveryCode(
      actor.id,
      body.code,
      fingerprint,
      actor.pending,
    );
    if (result.token) {
      response.cookie('token', result.token, this.authService.getCookieOptions());
    }
    return { message: result.message };
  }

  /** Turning the factor off takes the password and a current code. */
  @UseGuards(JWTAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('disable')
  async disable(@CurrentUser('id') id: string | number, @Body() body: TwoFaDisableDTO) {
    return this.twoFa.disable(Number(id), body.password, body.TOTP);
  }

  /** A new recovery set, only with a current authenticator code in hand. */
  @UseGuards(JWTAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('recovery/regenerate')
  async regenerate(@CurrentUser('id') id: string | number, @Body() body: TwoFaRegenerateDTO) {
    return this.twoFa.regenerateRecoveryCodes(Number(id), body.code);
  }
}
