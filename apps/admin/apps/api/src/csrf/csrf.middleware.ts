import { ForbiddenException, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE, CSRF_HEADER, MUTATING_METHODS } from './csrf.constants';
import { CsrfService } from './csrf.service';

/**
 * Enforces the pair on every state-changing request that carries a CSRF cookie.
 *
 * Why "that carries a cookie" rather than blanket enforcement: a first visit has
 * no token to echo, and the SPA bootstraps one from `GET /api/csrf` before it can
 * mutate anything. Requests with no cookie are therefore uncredentialed by
 * construction — there is nothing to ride. Once the cookie exists, a missing or
 * wrong header is a 403, which is the case that matters.
 *
 * Bound in `AppModule.configure()`, not in `main.ts`, so the test application
 * inherits it: a guard that only exists in the bootstrap is a guard no test can
 * prove.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly csrf: CsrfService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Machine-facing endpoints (OAuth 2.1 for MCP clients) are called without a
    // CSRF token and authenticate with a bearer credential or a PKCE code, so the
    // cookie-based CSRF check does not apply to them.
    if (
      req.path.startsWith('/oauth/') ||
      req.path.startsWith('/.well-known/') ||
      req.originalUrl.includes('/oauth/') ||
      req.originalUrl.includes('/.well-known/')
    ) {
      next();
      return;
    }

    if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const cookieValue = this.csrf.readCookie(req.headers.cookie, CSRF_COOKIE);
    if (!cookieValue) {
      next();
      return;
    }

    const headerValue = req.headers[CSRF_HEADER];
    const presented = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!this.csrf.matches(cookieValue, presented)) {
      const error = new ForbiddenException('CSRF token missing or invalid');
      res.status(error.getStatus()).json(error.getResponse());
      return;
    }

    next();
  }
}
