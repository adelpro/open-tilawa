import {
  ConflictException,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth.service';
import { CurrentUser } from '../decorators/currentUser.decorator';
import { JWTAuthGuard } from '../guards/jwt.guard';
import type { AuthenticatedUser } from '../types/authenticatedUser.type';
import type { FingerprintObj } from '../types/fingerprint.type';
import { OAuthClient, OAuthProviderError } from './oauth.client';
import { isProviderName, providerConfig, type OAuthProviderName } from './oauth.config';
import { OAuthFlowError, OAuthService } from './oauth.service';
import {
  DEVICE_ID_PATTERN,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_MS,
  createState,
  verifyState,
} from './oauth.state';

/**
 * Provider sign-in and account linking.
 *
 * Two shapes of flow, one pair of endpoints:
 *
 *  - `start` is public: nobody is signed in yet, and that is the point.
 *  - `link` requires a session and carries the user id **inside the signed state**, so
 *    a tampered callback cannot attach someone else's provider account to itself.
 *
 * The callback never answers JSON. A browser arrives here by redirect, so success and
 * failure are both redirects back into the SPA with a code it can explain — an error
 * page from the API would be a dead end in a tab the user cannot get out of.
 */
@ApiTags('auth')
@Controller('auth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauth: OAuthService,
    private readonly client: OAuthClient,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private get env() {
    return (key: string) => this.config.get<string>(key);
  }

  private get website(): string {
    return (this.config.get<string>('WEBSITE') ?? 'http://localhost:9320').replace(/\/+$/, '');
  }

  @Get('providers')
  @ApiOperation({ summary: 'Which provider buttons this deployment can offer' })
  providers(): { providers: OAuthProviderName[] } {
    return { providers: this.oauth.available() };
  }

  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Get(':provider/start')
  @ApiOperation({ summary: 'Begin a provider sign-in' })
  start(
    @Param('provider') provider: string,
    @Query('device') device: string | undefined,
    @Res() response: Response,
  ): void {
    this.redirectToProvider(provider, response, null, device);
  }

  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Get(':provider/link')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ summary: 'Begin linking a provider to the signed-in account' })
  link(
    @Param('provider') provider: string,
    @Query('device') device: string | undefined,
    @Res() response: Response,
    @CurrentUser() user: AuthenticatedUser,
  ): void {
    this.redirectToProvider(provider, response, Number(user.id), device);
  }

  @Get(':provider/callback')
  @ApiOperation({ summary: 'Provider redirect target: sets the session and returns to the app' })
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (!isProviderName(provider)) return this.fail(response, null, 'provider_disabled');
    const config = providerConfig(provider, this.env);
    if (!config) return this.fail(response, null, 'provider_disabled');

    const secret = this.config.get<string>('COOKIE_JWT_SECRET') ?? '';
    const verified = verifyState(
      this.readCookie(request, OAUTH_STATE_COOKIE),
      state,
      provider,
      secret,
    );
    this.clearCookie(response, OAUTH_STATE_COOKIE);

    if (!verified) {
      this.logger.warn(`auth.oauth state rejected provider=${provider}`);
      return this.fail(response, null, 'state_invalid');
    }
    if (providerError) {
      this.logger.warn(`auth.oauth provider error=${providerError} provider=${provider}`);
      return this.fail(response, verified, 'provider_error');
    }
    if (!code) return this.fail(response, verified, 'provider_error');

    try {
      const identity = await this.client.identity(config, code, this.env);
      const user = await this.oauth.resolveAccount(identity, {
        ...(verified.userId ? { linkUserId: verified.userId } : {}),
      });

      // The callback arrives by redirect, so there is no `x-fingerprint` header. The
      // SPA put the id it will keep sending into the start link; the signed state is
      // what makes this the same browser the session and the 2FA trust belong to.
      const fingerprintValue: FingerprintObj = {
        label: (request.headers['user-agent'] as string | undefined) ?? '',
        value: verified.device,
      };

      // Parity with the local route: a 2FA-enabled account on an untrusted device
      // must pass the second factor — the provider identity alone is not a substitute
      // for the TOTP the account answered at enrolment.
      const trusted = await this.auth.isDeviceTrustedFor(user.id, fingerprintValue);
      if (user.isTwoFAEnabled && !trusted) {
        const pending = await this.auth.generatePendingToken(user);
        response.cookie('token', pending, this.auth.getCookieOptions());
        response.redirect(302, `${this.website}/2fa?auth=${provider}`);
        return;
      }

      const token = await this.auth.generateAndSaveToken(user, fingerprintValue);
      response.cookie('token', token, this.auth.getCookieOptions());

      // A link flow returns to Account, where the new connection is visible; a
      // sign-in goes to the console.
      const target = verified.userId
        ? `/console/account?connected=${provider}`
        : `/console?auth=${provider}`;
      response.redirect(302, `${this.website}${target}`);
    } catch (error) {
      const code =
        error instanceof OAuthFlowError
          ? error.code
          : error instanceof OAuthProviderError
            ? 'provider_error'
            : 'provider_error';
      this.logger.warn(`auth.oauth failed provider=${provider} reason=${code}`);
      this.fail(response, verified, code);
    }
  }

  private redirectToProvider(
    provider: string,
    response: Response,
    linkUserId: number | null,
    rawDevice: string | undefined,
  ): void {
    if (!isProviderName(provider)) return this.fail(response, null, 'provider_disabled');
    const config = providerConfig(provider, this.env);
    if (!config) return this.fail(response, null, 'provider_disabled');

    const secret = this.config.get<string>('COOKIE_JWT_SECRET') ?? '';
    const device = rawDevice && DEVICE_ID_PATTERN.test(rawDevice)
      ? rawDevice
      : randomBytes(16).toString('hex');
    const { state, cookie } = createState(provider, secret, {
      device,
      ...(linkUserId ? { userId: linkUserId } : {}),
    });

    response.cookie(OAUTH_STATE_COOKIE, cookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/api/auth',
      maxAge: OAUTH_STATE_TTL_MS,
    });

    response.redirect(302, this.client.authorizeUrl(config, state.nonce, this.env));
  }

  private fail(
    response: Response,
    state: { userId?: number } | null,
    code: string,
  ): void {
    const target = state?.userId
      ? `/console/account?error=${code}`
      : `/signin?error=${code}`;
    response.redirect(302, `${this.website}${target}`);
  }

  private readCookie(request: Request, name: string): string | undefined {
    const header = request.headers.cookie;
    if (!header) return undefined;
    const found = header
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
  }

  private clearCookie(response: Response, name: string): void {
    response.clearCookie(name, { path: '/api/auth' });
  }
}

/**
 * Unlinking, which is a state change and therefore a DELETE with CSRF enforced by
 * the app-wide middleware — never a link a page can be tricked into loading.
 */
@ApiTags('auth')
@Controller('me/identities')
export class IdentitiesController {
  constructor(private readonly oauth: OAuthService) {}

  @Get()
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ summary: 'Providers connected to this account' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return {
      identities: this.oauth.listIdentities(Number(user.id)),
    };
  }

  @Delete(':provider')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ summary: 'Disconnect a provider, refusing to strand the account' })
  async unlink(
    @Param('provider') provider: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ disconnected: OAuthProviderName }> {
    if (!isProviderName(provider)) throw new UnauthorizedException('unknown provider');
    try {
      await this.oauth.unlink(Number(user.id), provider);
    } catch (error) {
      // The two refusals here are different: "not connected" is a 404, and "this would
      // lock you out" is a 409 — the account is fine, the state forbids it.
      if (error instanceof OAuthFlowError) {
        if (error.code === 'not_linked') throw new NotFoundException(error.message);
        throw new ConflictException(error.message);
      }
      throw error;
    }
    return { disconnected: provider };
  }
}
