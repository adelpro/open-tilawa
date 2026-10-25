import { CookieOptions } from 'express';

/**
 * Cookie attributes for the session token.
 *
 * Changed from the ported version, which hard-coded `secure: true` and
 * `sameSite: 'none'`. That combination exists to allow cross-site requests, and
 * it forces HTTPS; under topology A the dashboard and the API share one origin
 * through the edge, so the browser sends the cookie on its own. `lax` keeps it
 * off cross-site POSTs (the CSRF surface `none` opens), and `secure` stays on in
 * production while local `http://127.0.0.1:9311` development can still work.
 */
export function getCookieOptions(isProduction: boolean, ttlMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ttlMs,
  };
}
