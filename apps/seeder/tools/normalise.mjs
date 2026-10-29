#!/usr/bin/env node
/**
 * Normalise one reciter folder and rebuild its torrent.
 *
 *   node tools/normalise.mjs --dir /data/downloads/<Reciter> [--dry-run]
 *
 * What it does, in order:
 *   1. renames the mushaf files to 001.mp3 … NNN.mp3 (see lib/normalise.mjs)
 *   2. deletes everything else in the folder
 *   3. builds a fresh torrent: our announce list + a url-list web seed, no
 *      comment, no createdBy, nothing inherited from whoever produced the
 *      original
 *   4. writes `<infohash>.torrent` into the torrent directory
 *
 * It does not touch the catalogue or the running node. Stop the seeder first, so
 * nothing holds the files open, and update the catalogue rows afterwards with
 * the hash this prints.
 */
import fs from 'node:fs';
import path from 'node:path';

import createTorrent from 'create-torrent';
import parseTorrent from 'parse-torrent';

import TRACKERS from '../constants/TRACKERS.js';
import { cleanName, planRename } from '../lib/normalise.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};

const dir = value('--dir');
const dryRun = flag('--dry-run');
const torrentDir = value('--torrents', process.env.TORRENT_DIR || '/data/torrents');
const webSeed = value('--web-seed', process.env.WEB_SEED_URL || 'https://tilawah.cc/media/');

if (!dir) {
  console.error('usage: normalise.mjs --dir <folder> [--dry-run] [--web-seed <url>]');
  process.exit(2);
}
if (!fs.existsSync(dir)) {
  console.error(`no such folder: ${dir}`);
  process.exit(2);
}

const sourceName = path.basename(dir);
// The folder name is the release name: it becomes the torrent name, the magnet's
// `dn` and the web-seed path. Source tags like "(MP3_Quran)" belong to whoever
// produced the download, not to this library.
const name = value('--name', cleanName(sourceName));
if (name.includes('/') || name.includes('..')) {
  console.error(`refusing to use "${name}" as a folder name`);
  process.exit(2);
}
let target = dir;
if (name !== sourceName) {
  target = path.join(path.dirname(dir), name);
  if (fs.existsSync(target)) {
    console.error(`target folder already exists: ${target}`);
    process.exit(1);
  }
}
const plan = planRename(fs.readdirSync(dir));
if (!plan.ok) {
  console.error(`${name}: ${plan.error}`);
  process.exit(1);
}

console.log(`--- ${name}${name !== sourceName ? ` (was ${sourceName})` : ''}`);
console.log(`  episodes: ${plan.count}`);
if (plan.drop.length) console.log(`  drop    : ${plan.drop.join(', ')}`);
const renames = plan.rename.filter(({ from, to }) => from !== to);
if (renames.length) console.log(`  rename  : ${renames.length} file(s), e.g. ${renames[0].from} → ${renames[0].to}`);

if (dryRun) {
  console.log('  (dry run, nothing written)');
  process.exit(0);
}

// The folder first: its name is the release's identity, and the files move with it.
if (target !== dir) {
  fs.renameSync(dir, target);
  console.log(`  folder  : ${sourceName} → ${name}`);
}

// Two passes: rename to unique temporary names first, so a swap cannot collide
// on a case-insensitive filesystem or on partially-overlapping names.
for (const { from, to } of plan.rename) {
  if (from !== to) fs.renameSync(path.join(target, from), path.join(target, `.tmp-${to}`));
}
for (const { to } of plan.rename) {
  const temp = path.join(target, `.tmp-${to}`);
  if (fs.existsSync(temp)) fs.renameSync(temp, path.join(target, to));
}
for (const file of plan.drop) fs.rmSync(path.join(target, file), { force: true, recursive: true });

const buffer = await new Promise((resolve, reject) => {
  createTorrent(target, { name, announce: TRACKERS, urlList: [webSeed] }, (error, result) =>
    error ? reject(error) : resolve(result),
  );
});
const parsed = await parseTorrent(buffer);
const torrentFile = path.join(torrentDir, `${parsed.infoHash}.torrent`);
fs.writeFileSync(torrentFile, buffer);

console.log(
  JSON.stringify(
    {
      name,
      infohash: parsed.infoHash,
      sizeBytes: parsed.length,
      files: parsed.files.length,
      announce: parsed.announce,
      urlList: parsed.urlList,
      torrentFile,
    },
    null,
    1,
  ),
);
