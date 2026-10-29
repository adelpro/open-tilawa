import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
// A direct dependency of webtorrent (^6.1.3), which the seeder already pins: the
// suite builds its own torrent so it never needs the network or a fixture.
import createTorrent from 'create-torrent';

/**
 * Regression: the admin server listed torrents for every method on
 * `/api/torrents`, so `POST` was swallowed by the inventory branch and the add
 * endpoint was unreachable over HTTP. These checks start the real script and
 * speak to it the way the console does.
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
  const stderr = [];
  child = spawn(process.execPath, ['seed-all.mjs'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      TORRENT_DIR: torrentDir,
      DOWNLOAD_PATH: downloadDir,
      ADMIN_PORT: String(port),
      ADMIN_USER: 'adm',
      ADMIN_PASS: 'secret',
      // No announce list: these tests are about the HTTP contract, not the
      // swarm. Without this the client dials seven public trackers per add.
      TRACKER_ANNOUNCE: '',
      // The peer port defaults to 6881, which a seeder running on this host
      // already holds: the suite only passed on a machine where nothing was
      // seeding. Give the test client its own.
      TORRENT_PORT: String(port + 1),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('seeder did not start in time')), 30000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Admin UI running')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', (code) =>
      reject(new Error(`seeder exited early (${code}): ${stderr.join('').slice(0, 800)}`)),
    );
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

test('DELETE of a hash the node does not hold answers 404', async () => {
  const res = await fetch(
    `http://127.0.0.1:${port}/api/torrents/0000000000000000000000000000000000000000`,
    { method: 'DELETE', headers: { Authorization: auth } },
  );
  assert.equal(res.status, 404);
});

/**
 * Delete was the one route with no coverage, and it was broken for exactly that
 * reason: `destroy()` without `destroyStore` dropped the torrent from the client
 * but left every byte on disk, and the `.torrent` stayed in TORRENT_DIR so the
 * boot scan read it back on the next restart. The node could not free space.
 */
test('DELETE takes the payload and the .torrent with it, so a restart cannot re-add it', async () => {
  const base = `http://127.0.0.1:${port}`;
  const source = join(root, 'source', 'reciter');
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, '001.mp3'), Buffer.alloc(64, 1));
  writeFileSync(join(source, '002.mp3'), Buffer.alloc(64, 2));

  const torrentFile = await new Promise((resolve, reject) => {
    createTorrent(source, { announce: [] }, (error, buffer) =>
      error ? reject(error) : resolve(buffer),
    );
  });

  // Any filename: releases are dropped in as whatever the curator called them,
  // so the node has to remember which file carried which hash rather than
  // assuming `<hash>.torrent`.
  const sourceName = 'delete-me.torrent';
  writeFileSync(join(torrentDir, sourceName), torrentFile);

  const added = await fetch(`${base}/api/torrents`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ torrentPath: sourceName }),
  });
  assert.equal(added.status, 200);
  const { infoHash } = await added.json();

  // Stand in for what a completed download leaves behind.
  mkdirSync(join(downloadDir, 'reciter'), { recursive: true });
  writeFileSync(join(downloadDir, 'reciter', '001.mp3'), 'downloaded');

  const removed = await fetch(`${base}/api/torrents/${infoHash}`, {
    method: 'DELETE',
    headers: { Authorization: auth },
  });
  assert.equal(removed.status, 200);

  const after = await (
    await fetch(`${base}/api/torrents`, { headers: { Authorization: auth } })
  ).json();
  assert.equal(
    after.torrents.some((torrent) => torrent.infoHash === infoHash),
    false,
    'the torrent is still in the inventory',
  );
  assert.equal(
    existsSync(join(torrentDir, sourceName)),
    false,
    'left in TORRENT_DIR, the boot scan re-adds it on the next restart',
  );
  assert.equal(
    existsSync(join(downloadDir, 'reciter')),
    false,
    'the payload is the thing that fills the disk',
  );
});

