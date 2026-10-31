import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveMissingTorrents, torrentFilePath } from '../lib/torrent-store.mjs';

/**
 * Before a restart, everything loaded must exist on disk.
 *
 * The failure this prevents is quiet and expensive: a node with 10 torrents in
 * memory and no .torrent files comes back empty, and the console reads that as
 * "the update deleted my library".
 */
const hash = (n) => String(n).padStart(40, '0');

function withDir(run) {
  const dir = mkdtempSync(join(tmpdir(), 'torrent-store-'));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the file is named after the hash, and only a hash is accepted', () => {
  assert.equal(torrentFilePath('/data/torrents', hash(7)), `/data/torrents/${hash(7)}.torrent`);
  assert.equal(torrentFilePath('/data/torrents', 'not-a-hash'), null);
  assert.equal(torrentFilePath('/data/torrents', null), null);
});

test('a loaded torrent with no file is written', () => {
  withDir((dir) => {
    const body = Buffer.from('d4:info…');
    const files = new Map();
    const written = saveMissingTorrents(
      dir,
      [{ infoHash: hash(1), torrentFile: body }],
      files,
    );
    assert.equal(written.length, 1);
    assert.deepEqual(readFileSync(join(dir, `${hash(1)}.torrent`)), body);
    assert.equal(files.get(hash(1)), join(dir, `${hash(1)}.torrent`));
  });
});

test('a torrent already on disk is left alone', () => {
  withDir((dir) => {
    const target = join(dir, 'curated-name.torrent');
    writeFileSync(target, 'keep me');
    const files = new Map([[hash(2), target]]);
    assert.deepEqual(saveMissingTorrents(dir, [{ infoHash: hash(2), torrentFile: Buffer.from('x') }], files), []);
    assert.deepEqual(readdirSync(dir), ['curated-name.torrent']);
  });
});

test('a torrent whose recorded file disappeared is written again', () => {
  withDir((dir) => {
    const files = new Map([[hash(3), join(dir, 'gone.torrent')]]);
    const written = saveMissingTorrents(dir, [{ infoHash: hash(3), torrentFile: Buffer.from('x') }], files);
    assert.equal(written.length, 1);
    assert.equal(files.get(hash(3)), join(dir, `${hash(3)}.torrent`));
  });
});

test('a torrent still fetching metadata is skipped, not written empty', () => {
  withDir((dir) => {
    assert.deepEqual(saveMissingTorrents(dir, [{ infoHash: hash(4) }, { infoHash: hash(5), torrentFile: Buffer.alloc(0) }], new Map()), []);
    assert.deepEqual(readdirSync(dir), []);
  });
});
