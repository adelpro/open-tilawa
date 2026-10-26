import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthenticatedUserResponseDTO } from './dtos/authenticatedUserResponse.dto';
import { AuthenticatedUserResponse } from './types/authenticatedUserResponse.type';
import { TrustedDevicesService } from '@/trusted-devices/trusted-devices.service';
import { AuthenticatedUser } from './types/authenticatedUser.type';
import { CurrentUser } from './decorators/currentUser.decorator';
import { Fingerprint } from './decorators/fingerprint.decorator';
import { ErrorResponseDTO } from './dtos/errorResponse.sto';
import { FingerprintObj } from './types/fingerprint.type';
import { TokensService } from '../tokens/tokens.service';
import { signinUserDTO } from './dtos/signinUser.dto';
import { SignupUserDTO } from './dtos/signupUser.dto';
import { Roles } from './decorators/roles.decorator';
import { JWTAuthGuard } from './guards/jwt.guard';
import { RoleGuard } from './guards/roles.guard';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

/**
 * Sign-in, sign-up and activation.
 *
 * Two routes are public and must stay public, because the account they serve
 * cannot authenticate yet: `local/activate` (the emailed token is the
 * credential) and `local/resend-activation` (answered generically, always).
 *
 * Throttling is per route rather than global: 5 attempts per 15 minutes on the
 * credential routes, which is what a password-guessing loop meets first.
 */
@Controller('auth')
export class AuthController {
  constructor(
    readonly authService: AuthService,
    readonly tokenService: TokensService,
    readonly trustedDeviceService: TrustedDevicesService,
    readonly configService: ConfigService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('local/signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Local signin' })
  @ApiBody({ type: signinUserDTO })
  @ApiResponse({
    status: 200,
    description: 'Sign-in successful',
    type: AuthenticatedUserResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password', type: ErrorResponseDTO })
  @ApiResponse({ status: 403, description: 'Account not activated', type: ErrorResponseDTO })
  @ApiResponse({ status: 430, description: '2FA verification required', type: ErrorResponseDTO })
  async signinLocal(
    @Res({ passthrough: true }) response: Response,
    @Body() signinUser: signinUserDTO,
    @Fingerprint() fingerprint: FingerprintObj,
  ): Promise<AuthenticatedUserResponse> {
    const { id, name, role, isActivated, isTwoFAEnabled, token } =
      await this.authService.signinLocal(signinUser, fingerprint);
    const { email } = signinUser.user;

    // The cookie is set on every authenticated outcome, including the 430: the
    // client needs a session in order to post the TOTP code that trusts it.
    response.cookie('token', token, this.authService.getCookieOptions());

    const isDeviceTrusted = await this.trustedDeviceService.isDeviceTrusted(id, fingerprint);
    if (isTwoFAEnabled && !isDeviceTrusted) {
      response.status(430);
      // 430 is a non-standard status, so it is spelled out rather than imported.
      return {
        provider: 'local',
        id,
        name,
        email,
        role,
        isActivated,
        isTwoFAEnabled,
        message: '2FA verification required',
      } as AuthenticatedUserResponse & { message: string };
    }

    return { provider: 'local', id, name, email, role, isActivated, isTwoFAEnabled };
  }

  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('local/signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Local signup — creates the account and mails the activation link' })
  @ApiBody({ type: SignupUserDTO })
  @ApiResponse({ status: 201, description: 'Account created, activation email sent' })
  @ApiResponse({ status: 400, description: 'Email already registered', type: ErrorResponseDTO })
  @ApiResponse({ status: 503, description: 'Mail is not configured', type: ErrorResponseDTO })
  async signupLocal(@Body() signupUser: SignupUserDTO): Promise<{
    id: number;
    email: string;
    name: string;
    isActivated: false;
    message: string;
  }> {
    const user = await this.authService.signupLocal(signupUser);
    return {
      ...user,
      isActivated: false,
      message: 'Account created. Check your email for the activation link.',
    };
  }

  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('local/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate an account with the emailed token' })
  @ApiResponse({ status: 200, description: 'Account activated, session started' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token', type: ErrorResponseDTO })
  async activateLocal(
    @Res({ passthrough: true }) response: Response,
    @Body('token') token: string,
    @Fingerprint() fingerprint: FingerprintObj,
  ): Promise<AuthenticatedUserResponse> {
    const { token: sessionToken, user } = await this.authService.activateLocal(token, fingerprint);
    response.cookie('token', sessionToken, this.authService.getCookieOptions());
    return {
      provider: 'local',
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActivated: true,
      isTwoFAEnabled: user.isTwoFAEnabled,
    };
  }

  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('local/resend-activation')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Re-send the activation link (always answered generically)' })
  @ApiResponse({ status: 202, description: 'Accepted, whether or not the address needs one' })
  async resendActivation(@Body('email') email: string): Promise<{ message: string }> {
    return this.authService.resendActivationLocal(email);
  }

  @UseGuards(JWTAuthGuard)
  // POST only: a mutating GET is reachable from cross-site top-level navigation
  // (sameSite=lax forwards the cookie there), so any webpage could destroy a
  // signed-in session with an <img>/<a> — logout CSRF, fixed by refusing GET.
  @Post('signout')
  @ApiOperation({ summary: 'Signout user' })
  @ApiResponse({ status: 200, description: 'Succesfully Signed out' })
  @HttpCode(HttpStatus.OK)
  async Signout(
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string; message: string }> {
    await this.authService.signout(user.id, user.token);
    response.clearCookie('token');
    return { id: String(user.id), message: 'Succesfully signed out' };
  }

  // Nest 11: @Throttle takes an options object, not (limit, ttl) positionally.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Roles('user')
  @UseGuards(JWTAuthGuard, RoleGuard)
  @Get('protected')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Protected route, only autheticated user with role:user can access this route',
  })
  protectedLocal(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Fingerprint() fingerprint: FingerprintObj,
  ): {
    id: string;
    email: string;
    name: string;
    role: string;
    fingerprint: string;
    message: string;
  } {
    const { id, email, name, role = 'user' } = currentUser;
    return {
      id: id.toString(),
      email,
      name,
      role,
      fingerprint: String(fingerprint.value),
      message: `Welcome ${name} You Are on a protected route`,
    };
  }
}
