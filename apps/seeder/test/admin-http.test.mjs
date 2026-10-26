import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Regression: the admin server listed torrents for every method on
 * `/api/torrents`, so `POST` was swallowed by the inventory branch and the add
 * endpoint was unreachable over HTTP. These checks start the real script and
 * speak to it the way the dashboard does.
 *
 * The client side stays offline (empty torrent directory, no tracker traffic):
 * this is the HTTP contract, not swarm behaviour.
 */
const root = mkdtempSync(join(tmpdir(), 'seeder-http-'));
const torrentDir = join(root, 'torrents');
const downloadDir = join(root, 'downloads');
mkdirSync(torrentDir, { recursive: true });
mkdirSync(downloadDir, { recursive: true });
const port = 48000 + (process.pid % 1000);
const auth = `Basic ${Buffer.from('adm:secret').toString('base64')}`;
let child;

before(async () => {
  child = spawn(process.execPath, ['seed-all.mjs'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      TORRENT_DIR: torrentDir,
      DOWNLOAD_PATH: downloadDir,
      ADMIN_PORT: String(port),
      ADMIN_USER: 'adm',
      ADMIN_PASS: 'secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('seeder did not start in time')), 30000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Admin UI running')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`seeder exited early (${code})`)));
  });
});

after(() => {
  child?.kill('SIGKILL');
  rmSync(root, { recursive: true, force: true });
});

test('GET /api/torrents answers the inventory', async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/torrents`, { headers: { Authorization: auth } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.torrents, []);
});

test('POST /api/torrents is no longer answered by the inventory branch', async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/torrents`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  });
  // A missing source is a validation error from the add path, not a listing.
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /magnet or torrentPath/);
});

test('POST refuses a path that escapes the torrent directory', async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/torrents`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ torrentPath: '../etc/passwd' }),
  });
  assert.equal(res.status, 400);
});

test('unauthenticated admin calls are refused', async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/torrents`);
  assert.equal(res.status, 401);
});
