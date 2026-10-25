/**
 * Gravatar, looked up from the browser.
 *
 * The hash is computed here rather than server-side on purpose: a server lookup
 * would point every user's address at Automattic on every page load, add an
 * outbound dependency to a container that has none, and let us answer for a
 * request the user did not make. GitHub makes the same call the same way.
 *
 * `d=404` matters: the alternative is a mystery-person image, which would look
 * like an avatar the account never set.
 */

const GRAVATAR = 'https://www.gravatar.com/avatar';

/** Lower-cased and trimmed, as Gravatar requires; the address itself never leaves the browser. */
async function hash(email: string): Promise<string | null> {
  const normalised = email.trim().toLowerCase();
  if (!normalised || !globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalised));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function gravatarUrl(email: string, size = 200): Promise<string | null> {
  const value = await hash(email);
  return value ? `${GRAVATAR}/${value}?s=${size}&d=404` : null;
}
