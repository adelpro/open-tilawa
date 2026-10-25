/**
 * The device identity the API asks for on every authenticated call.
 *
 * It is a random string kept in localStorage, not a fingerprint in the
 * privacy-violating sense: the server only uses it to remember which devices have
 * passed a 2FA challenge. Losing it costs one extra code, nothing more.
 */
const KEY = 'uslub.device';

export function deviceId(): string {
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

/** Every call sends it, so signing in on a trusted device never asks again. */
export const deviceHeaders = (): Record<string, string> => ({ 'X-Fingerprint': deviceId() });
