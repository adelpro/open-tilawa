import { createHash, timingSafeEqual } from 'node:crypto';
import type { FingerprintObj } from '../types';

/**
 * Deterministic hashes. Argon2 is for passwords only: it is salted per hash,
 * so it can never be used for lookup keys.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
