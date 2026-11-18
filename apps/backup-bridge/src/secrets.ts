import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Credential = { password?: string; privateKey?: string };

const ID_PATTERN = /^[a-z0-9-]{1,64}$/;

function assertId(id: string): void {
  if (!ID_PATTERN.test(id)) throw new Error('invalid target id');
}

function pathFor(id: string, dir: string): string {
  assertId(id);
  return join(dir, `${id}.json`);
}

/** Writes one credential atomically; the return value never contains the secret. */
export function writeCredential(
  id: string,
  credential: Credential,
  dir: string,
): { saved: true } {
  const path = pathFor(id, dir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temp = `${path}.tmp`;
  writeFileSync(temp, JSON.stringify(credential), { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, path);
  return { saved: true };
}

export function readCredential(id: string, dir: string): Credential | null {
  try {
    return JSON.parse(readFileSync(pathFor(id, dir), 'utf8')) as Credential;
  } catch {
    return null;
  }
}

export function removeCredential(id: string, dir: string): void {
  rmSync(pathFor(id, dir), { force: true });
}
