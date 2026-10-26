import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokensService } from '@/tokens/tokens.service';
import type { Request } from 'express';

export interface TwoFaActor {
  id: number;
  role: string;
  /** A pending 430 grant: proves the password, not a session. */
  pending: boolean;
}

type JwtPayload = {
  id: number | string;
  role?: string;
  twoFaPending?: boolean;
};

/**
 * The guard for the second-factor endpoints.
 *
 * It accepts exactly two credentials, and never both at once:
 * - a **full** JWT session whose row still exists (a signout kills it), or
 * - the **pending** 430 grant, which carries `twoFaPending` and is short-lived.
 *
 * The plain `JWTAuthGuard` would refuse the pending grant — that refusal is its
 * point: `/me`, `/2fa/enable` and every other guarded route must not open on a
 * password alone. Only the challenge endpoints below accept it.
 */
@Injectable()
export class TwoFaGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly tokens: TokensService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { twoFaActor?: TwoFaActor }>();
    const token = (request.cookies as Record<string, string> | undefined)?.token;
    if (!token) throw new UnauthorizedException('Sign in first');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('COOKIE_JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Session expired');
    }

    if (payload.twoFaPending) {
      request.twoFaActor = { id: Number(payload.id), role: payload.role ?? 'user', pending: true };
      return true;
    }

    // A full session must still resolve to a row: the cookie alone proves nothing.
    const session = await this.tokens.findTokenByValue(token);
    if (!session) throw new UnauthorizedException('Session expired');
    request.twoFaActor = { id: Number(payload.id), role: payload.role ?? 'user', pending: false };
    return true;
  }
}

/** Reads the actor the `TwoFaGuard` authenticated. */
export const TwoFaUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TwoFaActor => {
    const request = ctx.switchToHttp().getRequest<Request & { twoFaActor?: TwoFaActor }>();
    if (!request.twoFaActor) throw new UnauthorizedException('Sign in first');
    return request.twoFaActor;
  },
);

