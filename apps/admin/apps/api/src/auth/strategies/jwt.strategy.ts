import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptionsWithRequest } from 'passport-jwt';
import { TokensService } from '@/tokens/tokens.service';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The ported JWT strategy, with the part that matters kept intact: the cookie
 * value is **validated against the session row** before the token is accepted.
 * A JWT here is not stateless — signout deletes the row and the token dies
 * immediately instead of lingering until it expires.
 *
 * One change from upstream: the row is looked up by sha256(token) rather than
 * by an argon2 hash, because argon2 is salted per hash and could not match.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly tokenService: TokensService,
    private readonly configService: ConfigService,
  ) {
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string | null => {
          const token = (req?.cookies as Record<string, string> | undefined)?.token;
          return token ?? null;
        },
      ]),
      secretOrKey: configService.get<string>('COOKIE_JWT_SECRET') as string,
      passReqToCallback: true,
    };
    super(options);
  }

  async validate(req: Request, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    // The pending-2FA grant authenticates nothing: it is a 430 challenge, not
    // a session. Its only consumer is the guard on POST /2fa/verify.
    if (payload.twoFaPending) {
      return null as unknown as Record<string, unknown>;
    }
    const token = (req.cookies as Record<string, string>)?.token;
    const session = token ? await this.tokenService.findTokenByValue(token) : null;
    if (!session) {
      // Unknown, expired or revoked: the strategy must not authenticate.
      return null as unknown as Record<string, unknown>;
    }
    return { ...payload, token };
  }
}
