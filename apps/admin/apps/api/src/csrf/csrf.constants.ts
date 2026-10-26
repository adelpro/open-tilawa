/**
 * The double-submit pair.
 *
 * `SameSite=Lax` stops a cross-site POST in a plain browser, but it does not
 * stop one issued from a sibling subdomain (`*.adelpro.us.kg` is one site), which
 * is exactly where a stale or shared cookie would come from. The header is the
 * part an attacker cannot forge without reading the cookie, so the pair is what
 * makes the mutation trustworthy.
 */
export const CSRF_COOKIE = 'tilawa_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/** Methods that change state. Everything else is exempt: a GET must never mutate. */
export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Long enough that a dashboard tab keeps it across a working day. */
export const CSRF_TTL_MS = 12 * 60 * 60 * 1000;
