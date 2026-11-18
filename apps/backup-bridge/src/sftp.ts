import { Client, type SFTPWrapper } from 'ssh2';

import type { CheckResult, SnapshotFile, TargetConfig } from './server.ts';
import type { Credential } from './secrets.ts';

// Pharmacyserver's SSH handshake measures 14-21 s over Tailscale, so the connect
// deadline has to be above that or every check fails before the server answers.
const TIMEOUT_MS = 30_000;

function joinRemote(dir: string, name: string): string {
  return `${dir.replace(/\/+$/, '')}/${name}`;
}

async function withSftp<T>(
  target: TargetConfig,
  credential: Credential,
  run: (sftp: SFTPWrapper) => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const client = new Client();
    const close = (error?: Error, value?: T): void => {
      client.end();
      if (error) reject(error);
      else resolve(value as T);
    };
    client.on('error', (error) => close(error));
    client.on('ready', () => {
      client.sftp((error, sftp) => {
        if (error) return close(error);
        run(sftp)
          .then((value) => close(undefined, value))
          .catch((failure: Error) => close(failure));
      });
    });
    client.connect({
      host: target.host,
      port: target.port,
      username: target.username,
      password: credential.password,
      privateKey: credential.privateKey,
      readyTimeout: TIMEOUT_MS,
    });
  });
}

export async function checkTarget(
  target: TargetConfig,
  credential: Credential,
): Promise<CheckResult> {
  try {
    const files = await withSftp(target, credential, async (sftp) => {
      const entries = await new Promise<{ filename: string; attrs: { size: number; mtime: number } }[]>(
        (resolve, reject) => {
          sftp.readdir(target.remoteDir, (error, list) => {
            if (error) reject(error);
            else resolve(list as never);
          });
        },
      );
      return entries
        .filter((entry) => /^tilawa-admin-\d{8}T\d{6}Z\.sqlite$/.test(entry.filename))
        .map((entry): SnapshotFile => ({
          name: entry.filename,
          size: entry.attrs.size,
          mtime: new Date(entry.attrs.mtime * 1000).toISOString(),
        }))
        .sort((a, b) => (a.name < b.name ? 1 : -1));
    });
    return { ok: true, count: files.length, files };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      files: [],
      error: error instanceof Error ? error.message : 'connection failed',
    };
  }
}

export async function downloadFile(
  target: TargetConfig,
  credential: Credential,
  name: string,
): Promise<Buffer> {
  return withSftp(target, credential, async (sftp) => {
    return new Promise<Buffer>((resolve, reject) => {
      sftp.readFile(joinRemote(target.remoteDir, name), (error, data) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
  });
}
