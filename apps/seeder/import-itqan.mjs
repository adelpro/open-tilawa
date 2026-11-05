#!/usr/bin/env node
/**
 * Import one Itqan recitation into this seeder.
 *
 *   node import-itqan.mjs <assetId> <folderName> <riwaya>
 *   node import-itqan.mjs 127 Atef_Muftah_Hafs Hafs
 *
 * Why a script and not a runtime fallback: the browser cannot use Itqan's audio
 * host as a web seed (no CORS) and cannot attach identifying headers to a media
 * request. The node can do both, so the files are pulled once, verified against
 * Itqan's declared sizes, and then served from our own `/media` like every other
 * release.
 *
 * The API key and the two client headers identify this application on the API
 * call — the only leg where headers are possible. They never reach the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import WebTorrent from 'webtorrent';

import { fits, quotaFromEnv } from './lib/policy.mjs';
import { importDecision, totalBytes, validFolderName } from './lib/itqan.mjs';
import { downloadTracks, seedDirectory } from './lib/import.mjs';

const API = 'https://api.cms.itqan.dev';
const DOWNLOAD_PATH = process.env.DOWNLOAD_PATH || '/app/downloads';
const TORRENT_DIR = process.env.TORRENT_DIR || '/data/torrents';
const RESERVE_BYTES = Math.floor(Number(process.env.DISK_RESERVE_GB || 1) * 1024 ** 3);
const FULL_QURAN = 114;

/** Read at runtime: one version string, the package's. */
const VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
})();

function fail(message) {
  console.error(`import-itqan: ${message}`);
  process.exit(1);
}

function headers() {
  const key = process.env.ITQAN_API_KEY?.trim();
  return {
    Accept: 'application/json',
    'X-Client-Name': 'open-tilawa',
    'X-Client-Version': VERSION,
    ...(key ? { 'X-API-Key': key } : {}),
  };
}

function freeBytes() {
  try {
    const stats = fs.statfsSync(DOWNLOAD_PATH);
    return stats.bavail * stats.bsize;
  } catch {
    return undefined;
  }
}

/** What the node already holds — the number the quota is actually about. */
function heldBytes(root) {
  let total = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    }
  };
  try {
    if (fs.existsSync(root)) walk(root);
  } catch {
    // A file vanishing under a running node is not a reason to skip the check
    // silently; the numbers below still bound the import by quota and free space.
  }
  return total;
}

async function fetchTracks(assetId) {
  const response = await fetch(`${API}/recitations/${assetId}/?page_size=1000`, {
    headers: headers(),
  });
  if (!response.ok) fail(`the Itqan API answered ${response.status}`);

  const body = await response.json();
  const results = Array.isArray(body.results) ? body.results : [];
  // The default page size is 20 and truncates silently; count stays honest.
  if (body.count !== FULL_QURAN || results.length !== FULL_QURAN) {
    fail(`expected ${FULL_QURAN} tracks, got ${results.length} of ${body.count}`);
  }
  return results
    .slice()
    .sort((a, b) => a.surah_number - b.surah_number)
    .map((track) => ({
      surah: track.surah_number,
      url: track.audio_url,
      sizeBytes: Number(track.size_bytes) || 0,
    }));
}

const argv = process.argv.slice(2).filter((arg) => arg !== '--resume');
const resume = process.argv.includes('--resume');
const [assetId, folderName, riwaya] = argv;
if (!assetId || !folderName || !riwaya) {
  fail('usage: node import-itqan.mjs <assetId> <folderName> <riwaya> [--resume]');
}
if (!validFolderName(folderName)) {
  fail('the folder name may only contain letters, digits, "_" and "-"');
}
if (!['Hafs', 'Warsh', 'Qalon', 'unknown'].includes(riwaya)) {
  fail('the riwaya must be Hafs, Warsh, Qalon or unknown');
}

fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });

const target = path.join(DOWNLOAD_PATH, folderName);
const existingEntries = (() => {
  try {
    return fs.readdirSync(target).length;
  } catch {
    return 0;
  }
})();
const decision = importDecision(existingEntries, resume);
if (decision === 'refuse') {
  fail(
    `${target} already has ${existingEntries} entries; remove it, or pass --resume to keep the files that match`,
  );
}

const tracks = await fetchTracks(assetId);
const incoming = totalBytes(tracks.map((track) => ({ size_bytes: track.sizeBytes })));
const room = fits({
  quotaBytes: quotaFromEnv(),
  usedBytes: heldBytes(DOWNLOAD_PATH),
  incomingBytes: incoming,
  freeBytes: freeBytes(),
  reserveBytes: RESERVE_BYTES,
});
if (!room.ok) {
  fail(`not enough space: need ${(incoming / 1024 ** 3).toFixed(2)} GiB (${room.reason})`);
}

console.log(
  `itqan asset ${assetId}: ${tracks.length} tracks, ${(incoming / 1024 ** 3).toFixed(2)} GiB → ${folderName} (${riwaya}${decision === 'resume' ? ', resuming' : ''})`,
);
const dir = path.join(DOWNLOAD_PATH, folderName);
await downloadTracks({
  dir,
  tracks,
  freeBytes,
  reserveBytes: RESERVE_BYTES,
  onProgress: (done, total) => {
    if (done % 10 === 0) console.log(`  ${done}/${total} surahs`);
  },
});

// A separate process from the running seeder: ask for an ephemeral port and
// leave DHT/uTP discovery to the node, or the two clients fight over 6881 and
// the import crashes before it can write the .torrent.
const client = new WebTorrent({ torrentPort: 0, maxConns: 10, dht: false, lsd: false, ut_pex: false });
client.on('error', (err) => console.warn(`webtorrent: ${err.message}`));
const result = await seedDirectory({ client, dir, name: folderName, torrentDir: TORRENT_DIR });
console.log(
  `name=${folderName} files=${result.fileCount} size=${result.sizeBytes} ` +
    `infohash=${result.infohash} magnet=${result.magnet}`,
);
await new Promise((resolve) => client.destroy(resolve));
console.log('restart the seeder so it loads the new .torrent: docker compose restart seeder');
