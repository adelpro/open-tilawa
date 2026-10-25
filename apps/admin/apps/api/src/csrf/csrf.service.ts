import { Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CSRF_COOKIE, CSRF_TTL_MS } from './csrf.constants';

/**
 * Issues and verifies the token.
 *
 * The token is not a secret kept from the browser: it is written to a
 * JS-readable cookie precisely so the SPA can echo it. What it proves is that
 * the request was composed by same-origin code, not by a form on another site.
 */
@Injectable()
export class CsrfService {
  issue(): string {
    return randomBytes(32).toString('hex');
  }

  /** httpOnly is deliberately false — the client has to read it to echo it. */
  cookieOptions(): {
    httpOnly: boolean;
    sameSite: 'lax';
    secure: boolean;
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CSRF_TTL_MS,
    };
  }

  /** Constant-time, and length-safe: `timingSafeEqual` throws on unequal lengths. */
  matches(cookieValue: string | undefined, headerValue: string | undefined): boolean {
    if (!cookieValue || !headerValue) return false;
    const a = Buffer.from(cookieValue);
    const b = Buffer.from(headerValue);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /** Minimal cookie parse, so enforcement does not depend on middleware order. */
  readCookie(cookieHeader: string | undefined, name: string = CSRF_COOKIE): string | undefined {
    if (!cookieHeader) return undefined;
    for (const part of cookieHeader.split(';')) {
      const index = part.indexOf('=');
      if (index === -1) continue;
      if (part.slice(0, index).trim() === name) {
        return decodeURIComponent(part.slice(index + 1).trim());
      }
    }
    return undefined;
  }
}
