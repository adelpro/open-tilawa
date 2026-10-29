import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * The stored SMTP password.
 *
 * AES-256-GCM under a key that lives in the environment, never in the database.
 * The point is narrow and worth stating: `apps/admin/backup/` has held full dumps
 * of this exact SQLite file, so a plaintext credential would leave the host with
 * any copy of it. This does not protect against a compromised host — nothing in
 * the database can — only against the file travelling on its own.
 *
 * The ciphertext is versioned (`v1:`) so a future rotation is attributable and an
 * old blob is refused loudly instead of half-decrypting.
 */
const VERSION = 'v1';
const KEY_BYTES = 32;

/** 32 bytes, base64 or hex. Anything else is a misconfiguration, not a key. */
export function readMailKey(env: NodeJS.ProcessEnv): Buffer | null {
  const raw = env.MAIL_SECRET?.trim();
  if (!raw) return null;
  const buffer = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return buffer.length === KEY_BYTES ? buffer : null;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/** Throws on a wrong key, a truncated blob, or an unknown version. */
export function decryptSecret(blob: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = blob.split(':');
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error(`unrecognised mail secret format (expected ${VERSION}:iv:tag:ct)`);
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
