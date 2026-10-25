import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { FingerprintObj } from '../types';

/**
 * Deterministic hashes. Argon2 is for passwords only: it is salted per hash,
 * so it can never be used for lookup keys.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** API keys are hashed with a server-side pepper so a stolen DB is not a key dump. */
export function hashApiKey(pepper: string, plaintext: string): string {
  return sha256(`${pepper}${plaintext}`);
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Every key starts with this, so a leaked string is recognisable in a log. */
export const API_KEY_PREFIX = 'usl_';

/** How much of the key is stored for lookup: enough to index, useless to guess. */
export const API_KEY_LOOKUP_LENGTH = 12;

/**
 * `usl_` + 24 base62 characters, ~143 bits.
 *
 * `crypto.randomInt` rather than `randomBytes` mapped with `% 62`: 256 is not a
 * multiple of 62, so the modulo form favours the first eight characters of the
 * alphabet. Unbiased randomness is cheap here.
 */
export function generateApiKey(length = 24): string {
  let body = '';
  for (let index = 0; index < length; index += 1) {
    body += BASE62[randomInt(0, BASE62.length)];
  }
  return `${API_KEY_PREFIX}${body}`;
}

/** The lookup key: the first 12 characters, which include the prefix. */
export function apiKeyPrefix(key: string): string {
  return key.slice(0, API_KEY_LOOKUP_LENGTH);
}

/**
 * Constant-time comparison of two hex digests.
 *
 * `timingSafeEqual` throws when the lengths differ, so a length check has to
 * come first — and it must return false rather than throw, or a malformed
 * credential becomes a 500 instead of a 401.
 */
export function timingSafeHashEquals(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * A fingerprint is an object, and object key order is not guaranteed by
 * clients, so hash a canonical form: sorted keys, JSON encoded.
 */
export function canonicalFingerprint(fingerprint: FingerprintObj): string {
  const sorted = Object.keys(fingerprint)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = fingerprint[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

export function fingerprintHash(fingerprint: FingerprintObj): string {
  return sha256(canonicalFingerprint(fingerprint));
}
