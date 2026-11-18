import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { isAllowedHost, isSnapshotName } from '../src/allow.ts';
import { readCredential, writeCredential } from '../src/secrets.ts';
import { createBridgeServer, type CheckResult, type TargetConfig } from '../src/server.ts';

const NAME = 'tilawa-admin-20261101T000000Z.sqlite';

describe('allow lists', () => {
  it('accepts only an exact allowed host', () => {
    assert.equal(isAllowedHost('pharmacyserver', 'pharmacyserver,backup2'), true);
    assert.equal(isAllowedHost('PHARMACYSERVER', 'pharmacyserver'), true);
    assert.equal(isAllowedHost('evil.example', 'pharmacyserver'), false);
    assert.equal(isAllowedHost('pharmacyserver.evil', 'pharmacyserver'), false);
    assert.equal(isAllowedHost('127.0.0.1', 'pharmacyserver'), false);
    assert.equal(isAllowedHost('', 'pharmacyserver'), false);
  });

  it('accepts only the snapshot name shape', () => {
    assert.equal(isSnapshotName(NAME), true);
    assert.equal(isSnapshotName('../x.sqlite'), false);
    assert.equal(isSnapshotName('x.sqlite'), false);
    assert.equal(isSnapshotName(''), false);
  });
});

describe('credential store', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bridge-secrets-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('writes 0600 and returns no secret', () => {
    const result = writeCredential('target-1', { password: 'hunter2' }, dir);
    assert.deepEqual(result, { saved: true });
    assert.equal(statSync(join(dir, 'target-1.json')).mode & 0o777, 0o600);
    assert.equal(readCredential('target-1', dir)?.password, 'hunter2');
  });

  it('refuses a target id that is not a slug', () => {
    assert.throws(() => writeCredential('../x', { password: 'p' }, dir));
  });
});

describe('bridge routes', () => {
  let dir: string;
  let server: ReturnType<typeof createBridgeServer>;
  let base: string;
  let calls: TargetConfig[];

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'bridge-http-'));
    calls = [];
    server = createBridgeServer({
      secretsDir: dir,
      token: 'test-token',
      allowedHosts: ['pharmacyserver'],
      version: '1.36.0',
      check: async (cfg: TargetConfig): Promise<CheckResult> => {
        calls.push(cfg);
        return { ok: true, count: 1, files: [{ name: NAME, size: 10, mtime: '2026-11-01T00:00:00.000Z' }] };
      },
      download: async () => Buffer.from('snapshot-bytes'),
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  });

  const query = 'host=pharmacyserver&port=22&username=adelpro&remoteDir=tilawa-backups';

  it('answers health without a token and reports a version', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', version: '1.36.0' });
  });

  it('refuses a missing token', async () => {
    const res = await fetch(`${base}/targets/t1/files?${query}`);
    assert.equal(res.status, 401);
  });

  it('saves a credential and never returns it', async () => {
    const res = await fetch(`${base}/targets/t1/credentials`, {
      method: 'PUT',
      headers: { 'x-bridge-token': 'test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'hunter2' }),
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.deepEqual(JSON.parse(text), { saved: true });
    assert.equal(text.includes('hunter2'), false);
    assert.equal(readFileSync(join(dir, 't1.json'), 'utf8').includes('hunter2'), true);
  });

  it('refuses an unlisted host before any connection', async () => {
    const res = await fetch(`${base}/targets/t1/health?host=evil.example&port=22&username=x&remoteDir=y`, {
      headers: { 'x-bridge-token': 'test-token' },
    });
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });

  it('lists only snapshot files', async () => {
    writeCredential('t1', { password: 'p' }, dir);
    const res = await fetch(`${base}/targets/t1/files?${query}`, {
      headers: { 'x-bridge-token': 'test-token' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.files.map((row: { name: string }) => row.name), [NAME]);
  });

  it('reports an unreachable target as a failed check, not a crashed request', async () => {
    const failing = createBridgeServer({
      secretsDir: dir,
      token: 'test-token',
      allowedHosts: ['pharmacyserver'],
      version: '1.36.0',
      check: async () => {
        throw new Error('connect timeout');
      },
      download: async () => Buffer.from(''),
    });
    await new Promise<void>((resolve) => failing.listen(0, '127.0.0.1', resolve));
    const address = failing.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    writeCredential('t1', { password: 'p' }, dir);
    const res = await fetch(`http://127.0.0.1:${address.port}/targets/t1/health?${query}`, {
      headers: { 'x-bridge-token': 'test-token' },
    });
    assert.equal(res.status, 502);
    failing.closeAllConnections();
    await new Promise<void>((resolve) => failing.close(() => resolve()));
  });

  it('downloads a known snapshot and refuses an unknown name', async () => {
    writeCredential('t1', { password: 'p' }, dir);
    const ok = await fetch(`${base}/targets/t1/files/${NAME}?${query}`, {
      headers: { 'x-bridge-token': 'test-token' },
    });
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), 'snapshot-bytes');

    const bad = await fetch(`${base}/targets/t1/files/..%2Fetc%2Fpasswd?${query}`, {
      headers: { 'x-bridge-token': 'test-token' },
    });
    assert.equal(bad.status, 400);
  });
});
