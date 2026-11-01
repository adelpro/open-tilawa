import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { OAuthProviderName } from './oauth.config';

/**
 * The `state` parameter, without a session store.
 *
 * Passport's built-in `state` support wants `express-session`. This process is
 * stateless on purpose — the session is a cookie backed by a database row — so a
 * signed, short-lived cookie carries the state instead: a nonce, the provider it was
 * issued for, the browser id the SPA will keep sending, an optional user id when the
 * flow is a *link* rather than a sign-in, and an expiry.
 *
 * The device is in here because a provider callback arrives by redirect and carries no
 * `x-fingerprint` header. The deleted implementation minted its own device id, which
 * meant a device trusted through `/2fa/verify` (keyed by the SPA's id) could never
 * match, so every provider sign-in asked for a code again. The SPA now puts the id it
 * will keep sending into the start link; the signed state is what makes the callback
 * use the same one.
 *
 * Signing it is what makes it worth carrying: an unsigned state cookie would let a
 * caller choose the user id in a link flow, which is the whole attack.
 */
export const OAUTH_STATE_COOKIE = 'tilawa_oauth_state';
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** The SPA's `deviceId()` is 16 random bytes as hex. */
export const DEVICE_ID_PATTERN = /^[a-f0-9]{32}$/;

export interface OAuthState {
  /** Random nonce, so two flows started in the same second are distinguishable. */
  nonce: string;
  provider: OAuthProviderName;
  /** Present for a link flow: the signed-in account the identity is being attached to. */
  userId?: number;
  /** The browser id the SPA sends as `X-Fingerprint` after the redirect. */
  device: string;
  expiresAt: number;
}

const b64url = (value: Buffer | string): string => Buffer.from(value).toString('base64url');

const mac = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export function createState(
  provider: OAuthProviderName,
  secret: string,
  options: { userId?: number; device: string; now?: number },
): { state: OAuthState; cookie: string } {
  const state: OAuthState = {
    nonce: randomBytes(24).toString('base64url'),
    provider,
    device: options.device,
    ...(options.userId ? { userId: options.userId } : {}),
    expiresAt: (options.now ?? Date.now()) + OAUTH_STATE_TTL_MS,
  };

  const payload = b64url(JSON.stringify(state));
  return { state, cookie: `${payload}.${mac(payload, secret)}` };
}

/**
 * Verify a state cookie against the value the provider sent back.
 *
 * Every failure returns null rather than an error with a reason: the caller only ever
 * needs "this is not usable", and distinguishing a bad signature from an expired state
 * in a redirect URL tells an attacker which half to work on.
 */
export function verifyState(
  cookie: string | undefined,
  returned: string | undefined,
  provider: OAuthProviderName,
  secret: string,
  now = Date.now(),
): OAuthState | null {
  if (!cookie || !returned) return null;

  const [payload, signature] = cookie.split('.');
  if (!payload || !signature) return null;

  const expected = mac(payload, secret);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
  } catch {
    return null;
  }

  if (state.provider !== provider) return null;
  if (!state.nonce || typeof state.expiresAt !== 'number') return null;
  if (typeof state.device !== 'string' || !DEVICE_ID_PATTERN.test(state.device)) return null;
  if (state.expiresAt < now) return null;
  if (state.nonce !== returned) return null;

  return state;
}
