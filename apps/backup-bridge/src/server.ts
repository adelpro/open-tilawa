import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { isAllowedHost, isSnapshotName } from './allow.ts';
import { readCredential, writeCredential, type Credential } from './secrets.ts';

export type TargetConfig = {
  host: string;
  port: number;
  username: string;
  remoteDir: string;
};

export type SnapshotFile = { name: string; size: number; mtime: string };

export type CheckResult = {
  ok: boolean;
  count: number;
  files: SnapshotFile[];
  error?: string;
};

export type BridgeDeps = {
  secretsDir: string;
  token: string;
  allowedHosts: string[];
  version: string;
  check: (target: TargetConfig, credential: Credential) => Promise<CheckResult>;
  download: (target: TargetConfig, credential: Credential, name: string) => Promise<Buffer>;
};

const MAX_BODY = 1024 * 1024;
const RATE_WINDOW_MS = 2000;

function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

function fail(res: ServerResponse, status: number, message: string): void {
  json(res, status, { error: message });
}

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  const declared = Number(req.headers['content-length'] ?? '0');
  if (declared > MAX_BODY) throw new Error('body too large');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('body too large');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function targetFromQuery(url: URL, allowedHosts: string[]): TargetConfig | string {
  const host = url.searchParams.get('host') ?? '';
  const port = Number(url.searchParams.get('port') ?? '22');
  const username = url.searchParams.get('username') ?? '';
  const remoteDir = url.searchParams.get('remoteDir') ?? '';
  if (!isAllowedHost(host, allowedHosts.join(','))) return 'host is not allowed';
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 'port is invalid';
  if (!username.trim() || username.length > 64) return 'username is invalid';
  if (!remoteDir.trim() || remoteDir.includes('..')) return 'remoteDir is invalid';
  return { host, port, username, remoteDir };
}

export function createBridgeServer(deps: BridgeDeps): Server {
  const lastCall = new Map<string, number>();

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://bridge');
      const parts = url.pathname.split('/').filter(Boolean);

      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'health') {
        json(res, 200, { status: 'ok', version: deps.version });
        return;
      }

      if (req.headers['x-bridge-token'] !== deps.token) {
        fail(res, 401, 'unauthorized');
        return;
      }

      if (parts[0] !== 'targets' || !parts[1]) {
        fail(res, 404, 'not found');
        return;
      }
      const id = parts[1];

      if (req.method === 'PUT' && parts.length === 3 && parts[2] === 'credentials') {
        const body = (await bodyOf(req)) as Credential;
        if (!body || (typeof body.password !== 'string' && typeof body.privateKey !== 'string')) {
          fail(res, 400, 'credential is invalid');
          return;
        }
        json(res, 200, writeCredential(id, body, deps.secretsDir));
        return;
      }

      if (req.method !== 'GET') {
        fail(res, 405, 'method not allowed');
        return;
      }

      const target = targetFromQuery(url, deps.allowedHosts);
      if (typeof target === 'string') {
        fail(res, 400, target);
        return;
      }

      const credential = readCredential(id, deps.secretsDir);
      if (!credential) {
        fail(res, 404, 'no credential for this target');
        return;
      }

      const allowed = (): boolean => {
        const now = Date.now();
        if (now - (lastCall.get(id) ?? 0) < RATE_WINDOW_MS) return false;
        lastCall.set(id, now);
        return true;
      };

      if (parts.length === 3 && parts[2] === 'health') {
        if (!allowed()) {
          fail(res, 429, 'too many requests');
          return;
        }
        json(res, 200, await deps.check(target, credential));
        return;
      }

      if (parts.length === 3 && parts[2] === 'files') {
        if (!allowed()) {
          fail(res, 429, 'too many requests');
          return;
        }
        const result = await deps.check(target, credential);
        if (!result.ok) {
          json(res, 502, { error: result.error ?? 'check failed' });
          return;
        }
        json(res, 200, { files: result.files.filter((file) => isSnapshotName(file.name)) });
        return;
      }

      if (parts.length === 4 && parts[2] === 'files') {
        const name = decodeURIComponent(parts[3]);
        if (!isSnapshotName(name)) {
          fail(res, 400, 'snapshot name is invalid');
          return;
        }
        if (!allowed()) {
          fail(res, 429, 'too many requests');
          return;
        }
        const bytes = await deps.download(target, credential, name);
        res.writeHead(200, {
          'content-type': 'application/x-sqlite3',
          'content-disposition': `attachment; filename="${name}"`,
          'content-length': bytes.length,
        });
        res.end(bytes);
        return;
      }

      fail(res, 404, 'not found');
    } catch (error) {
      fail(res, 400, error instanceof Error ? error.message : 'bad request');
    }
  });
}
