import chalk from 'chalk';
import events from 'events';
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { exactLengthFromMagnet, fits, quotaFromEnv } from './lib/policy.mjs';
import { describePeers } from './lib/peers.mjs';
import TRACKERS from './constants/TRACKERS.js';
import parseTorrent from 'parse-torrent';
import { readFileSync as readFile, statfsSync } from 'fs';

/**
 * What this artefact is, stamped at build time.
 *
 * The console compares it with the tag it expects, so "is this node running
 * the release I just published?" is answerable without opening a shell on the
 * node. BUILD_SHA is set by the image workflow; SEEDER_VERSION falls back to the
 * package version, which the image already carries.
 */
const VERSION = (() => {
  try {
    const pkg = JSON.parse(readFile(new URL('./package.json', import.meta.url), 'utf8'));
    return process.env.SEEDER_VERSION || pkg.version || '0.0.0';
  } catch {
    return process.env.SEEDER_VERSION || '0.0.0';
  }
})();
const BUILD_SHA = process.env.BUILD_SHA || 'dev';

/**
 * Free/total bytes on the data volume.
 *
 * The console plans assignments against this: a node with 40 GB left should
 * not be handed a 60 GB reciter. Reported as bytes so the client formats it.
 */
/** Everything the node holds, by torrent length — the number the quota is about. */
function usedBytes() {
  return client.torrents.reduce((sum, torrent) => sum + (torrent.length || 0), 0);
}

function diskUsage() {
  try {
    const stats = statfsSync(DOWNLOAD_PATH);
    return { free: stats.bavail * stats.bsize, total: stats.blocks * stats.bsize };
  } catch {
    return null;
  }
}
import WebTorrent from 'webtorrent';

const TORRENT_DIR = process.env.TORRENT_DIR || '/data/torrents';
const DOWNLOAD_PATH = process.env.DOWNLOAD_PATH || '/app/downloads';
const ADMIN_PORT = process.env.ADMIN_PORT || 8085;
/** 0 = unlimited. Enforced here, on the node, because a console-side cap is a promise. */
const QUOTA_BYTES = quotaFromEnv();
const DISK_RESERVE_BYTES = Math.floor(Number(process.env.DISK_RESERVE_GB || 1) * 1024 ** 3);
/** A community node can keep the API and hide the browsable UI. */
const SERVE_ADMIN_UI = process.env.ADMIN_UI !== '0';
const MAX_CONNS = 100;
/**
 * The port inbound peers dial. WebTorrent defaults to 0, which asks the OS for a
 * random port — pointless to publish in Docker, so a node behind a published
 * mapping could still never be dialled and seeded only outbound. Pinning it to
 * one number is what makes `6881:6881/tcp` and `/udp` in the compose file mean
 * anything.
 */
const TORRENT_PORT = Math.max(1, Math.floor(Number(process.env.TORRENT_PORT || 6881)));
/**
 * Optional bandwidth caps, in KB/s. 0/absent means unthrottled. They are applied
 * to the WebTorrent client, so every torrent on the node obeys one budget.
 */
const UPLOAD_LIMIT = Math.max(0, Math.floor(Number(process.env.UPLOAD_LIMIT_KBPS || 0) * 1024));
const DOWNLOAD_LIMIT = Math.max(0, Math.floor(Number(process.env.DOWNLOAD_LIMIT_KBPS || 0) * 1024));

events.EventEmitter.defaultMaxListeners = 20;

const log = {
  info: (msg) => console.log(chalk.blue(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warning: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.log(chalk.red(msg)),
};

/**
 * Refuse to run with no password (or the compose placeholder).
 *
 * The admin API can add and delete torrents; booting with a published default is
 * how a node becomes someone else's. Deployments must set ADMIN_PASS.
 */
const ADMIN_PASS_FOR_CHECK = process.env.ADMIN_PASS;
if (!ADMIN_PASS_FOR_CHECK || ADMIN_PASS_FOR_CHECK === 'change-me-in-prod' || ADMIN_PASS_FOR_CHECK === 'change-me') {
  console.error(
    'Refusing to start: set ADMIN_PASS to a real password (the admin API can add and delete torrents).',
  );
  process.exit(1);
}

if (!fs.existsSync(DOWNLOAD_PATH)) {
  fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
}

const client = new WebTorrent({
  maxConns: MAX_CONNS,
  torrentPort: TORRENT_PORT,
  dht: true,
  ut_pex: true,
  ...(UPLOAD_LIMIT > 0 ? { uploadLimit: UPLOAD_LIMIT } : {}),
  ...(DOWNLOAD_LIMIT > 0 ? { downloadLimit: DOWNLOAD_LIMIT } : {}),
});
globalThis.wtClient = client;

/**
 * Who to announce to. `TRACKER_ANNOUNCE` overrides the built-in list — an empty
 * value means announce nowhere, which is what the HTTP tests want: they are
 * about the admin contract, not the swarm, and dialling seven public trackers
 * per add makes them slow and flaky.
 */
const ANNOUNCE =
  process.env.TRACKER_ANNOUNCE === undefined
    ? TRACKERS
    : process.env.TRACKER_ANNOUNCE.split(',')
        .map((url) => url.trim())
        .filter(Boolean);

/**
 * infoHash -> the .torrent file that would bring that hash back on next boot.
 *
 * The boot scan reads TORRENT_DIR, so a torrent whose file survives a delete is
 * re-added by the next restart. Curated releases are not named after their hash,
 * so this is recorded as each torrent is added rather than derived.
 */
const sourceFiles = new Map();

/**
 * Remember where a torrent's `.torrent` lives, writing one when it arrived as a
 * magnet. Without this a magnet-added torrent is seeded until the container
 * restarts and then silently disappears — the other half of "the node does not
 * match the catalogue".
 */
function persistSource(torrent, source) {
  if (typeof source === 'string' && source.endsWith('.torrent')) {
    sourceFiles.set(torrent.infoHash, source);
    return source;
  }
  const target = path.join(TORRENT_DIR, `${torrent.infoHash}.torrent`);
  try {
    fs.writeFileSync(target, torrent.torrentFile);
    sourceFiles.set(torrent.infoHash, target);
    return target;
  } catch (error) {
    log.warning(`could not persist ${torrent.infoHash} to ${TORRENT_DIR}: ${error.message}`);
    return null;
  }
}

/**
 * Remove a torrent, its payload, and the file that would bring it back.
 *
 * Three separate defects lived here:
 *  - `client.get()` is async, so the old `const torrent = client.get(hash)` held
 *    a promise. It is truthy, has no `destroy` method, and every DELETE threw an
 *    uncaught TypeError that killed the node mid-request. That is why deleting
 *    from the console never worked.
 *  - `destroy()` without `destroyStore` left every byte on disk.
 *  - the `.torrent` stayed in TORRENT_DIR, so the boot scan re-added it.
 */
function removeTorrent(hash, res, { keepData = false } = {}) {
  const answer = (status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  client
    .get(hash)
    .then((torrent) => {
      if (!torrent) {
        answer(404, { error: 'not found' });
        return;
      }
      const infoHash = torrent.infoHash;
      const finish = (error) => {
        if (error) {
          answer(500, { error: error.message });
          return;
        }
        // The store deletes the files listed in the torrent, not the folder that
        // held them: without this every reciter leaves an empty directory. When
        // the caller asked to keep the data (unplace), the folder is the point.
        try {
          if (!keepData) {
            const root = path.resolve(DOWNLOAD_PATH, torrent.name);
            const base = path.resolve(DOWNLOAD_PATH);
            if (root.startsWith(base + path.sep) && fs.existsSync(root) && fs.statSync(root).isDirectory()) {
              fs.rmSync(root, { recursive: true, force: true });
            }
          }
        } catch (error) {
          log.warning(`could not remove ${torrent.name} from ${DOWNLOAD_PATH}: ${error.message}`);
        }
        const source = sourceFiles.get(infoHash);
        if (source) {
          try {
            fs.unlinkSync(source);
          } catch (error) {
            if (error.code !== 'ENOENT') log.warning(`could not remove ${source}: ${error.message}`);
          }
          sourceFiles.delete(infoHash);
        }
        log.success(`Removed ${torrent.name} (${infoHash})`);
        answer(200, { ok: true, infoHash });
      };
      if (torrent.destroyed) {
        finish();
        return;
      }
      torrent.destroy({ destroyStore: !keepData }, finish);
    })
    .catch((error) => answer(400, { error: error.message }));
}

const torrentFiles = fs.readdirSync(TORRENT_DIR).filter(f => f.endsWith('.torrent'));
log.info(`Found ${torrentFiles.length} torrent files in ${TORRENT_DIR}`);

/**
 * Map every file to its own infoHash *before* anything is added.
 *
 * The filename cannot be trusted — one file in this deployment is named after a
 * hash that is not the hash of its content — and the metadata callback is too
 * late: a delete that arrives while a torrent is still loading finds no file to
 * unlink, so the .torrent is left behind and the next boot re-adds the whole
 * release. parse-torrent is async even for a Buffer, hence the await here rather
 * than inside the loop below.
 */
for (const tf of torrentFiles) {
  const fullPath = path.join(TORRENT_DIR, tf);
  try {
    const parsed = await parseTorrent(fs.readFileSync(fullPath));
    if (parsed?.infoHash) sourceFiles.set(parsed.infoHash, fullPath);
  } catch (error) {
    log.warning(`could not read ${tf}: ${error.message}`);
  }
}

for (const tf of torrentFiles) {
  const fullPath = path.join(TORRENT_DIR, tf);
  // Announce to our tracker as well as whatever the .torrent already lists:
  // without this the node seeds happily but is invisible on the tracker.
  client.add(fullPath, { path: DOWNLOAD_PATH, announce: ANNOUNCE }, (torrent) => {
    // Re-set: a file that failed to parse above still gets recorded once its
    // metadata is read by the client.
    sourceFiles.set(torrent.infoHash, fullPath);
    log.success(`Seeding: ${torrent.name} (${torrent.infoHash}) — ${torrent.files.length} files`);
  });
}

// Admin HTTP server
const adminHtml = fs.readFileSync(path.join(process.cwd(), 'admin', 'index.html'), 'utf8');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Public health endpoint (no auth)
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'tilawa-seeder',
      version: VERSION,
      sha: BUILD_SHA,
      disk: diskUsage(),
      quotaBytes: QUOTA_BYTES,
      limits: { uploadBytesPerSecond: UPLOAD_LIMIT, downloadBytesPerSecond: DOWNLOAD_LIMIT },
      usedBytes: usedBytes(),
      headroomBytes: fits({
        quotaBytes: QUOTA_BYTES,
      limits: { uploadBytesPerSecond: UPLOAD_LIMIT, downloadBytesPerSecond: DOWNLOAD_LIMIT },
        usedBytes: usedBytes(),
        incomingBytes: 0,
        freeBytes: diskUsage()?.free,
        reserveBytes: DISK_RESERVE_BYTES,
      }).headroomBytes,
      torrents: client.torrents.length,
      peers: client.torrents.reduce((s, t) => s + t.numPeers, 0),
      uploadSpeed: client.uploadSpeed,
      downloadSpeed: client.downloadSpeed,
    }));
    return;
  }

  // Basic auth
  const auth = req.headers.authorization || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString();
    const [user, pass] = decoded.split(':');
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'change-me';
    // Constant-time comparison: hashing first gives both sides the same length,
    // which timingSafeEqual requires, and removes the byte-by-byte early exit.
    const equal = (a, b) =>
      crypto.timingSafeEqual(
        crypto.createHash('sha256').update(a ?? '').digest(),
        crypto.createHash('sha256').update(b ?? '').digest(),
      );
    if (!equal(user, adminUser) || !equal(pass, adminPass)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Seeder Admin"' });
      res.end('Unauthorized');
      return;
    }
  } else {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Seeder Admin"' });
    res.end('Unauthorized');
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    if (!SERVE_ADMIN_UI) {
      res.writeHead(404).end('Admin UI disabled');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(adminHtml);
    return;
  }

  if (url.pathname === '/api/torrents' && req.method === 'GET') {
    const torrents = client.torrents.map(t => ({
      name: t.name,
      infoHash: t.infoHash,
      size: t.length,
      progress: (t.progress * 100).toFixed(2),
      peers: t.numPeers,
      uploadSpeed: t.uploadSpeed,
      downloadSpeed: t.downloadSpeed,
      uploaded: t.uploaded,
      downloaded: t.downloaded,
      files: t.files.length,
      done: t.done,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      torrents,
      stats: {
        totalTorrents: client.torrents.length,
        totalPeers: client.torrents.reduce((s, t) => s + t.numPeers, 0),
        uploadSpeed: client.uploadSpeed,
        downloadSpeed: client.downloadSpeed,
        uploadLimit: UPLOAD_LIMIT,
        downloadLimit: DOWNLOAD_LIMIT,
      },
    }));
    return;
  }

  // Who is connected, per torrent. Live by nature, so the answer is never cached:
  // a peer report read from a cache is a number pretending to be a swarm. The
  // addresses are masked in lib/peers.mjs — this route never sees a whole one.
  if (url.pathname === '/api/peers' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(describePeers(client.torrents)));
    return;
  }

  // Handle POST /api/torrents (add torrent). The inventory branch above is
  // GET-only: without that guard every POST here was answered with a listing
  // and the add path was unreachable over HTTP.
  if (url.pathname === '/api/torrents' && req.method === 'POST') {
    let body = '';
    let answered = false;
    const answer = (status, payload) => {
      if (answered) return;
      answered = true;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    // A magnet that never resolves must fail visibly, not hang the console.
    const timer = setTimeout(() => answer(504, { error: 'timed out waiting for torrent metadata' }), 20000);
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { magnet, torrentPath } = JSON.parse(body);
        let source = null;
        if (typeof magnet === 'string' && magnet.startsWith('magnet:')) {
          source = magnet;
        } else if (typeof torrentPath === 'string') {
          // Torrent files live directly in TORRENT_DIR; a path that leaves it is
          // a traversal attempt, not a filename.
          const name = path.basename(torrentPath);
          if (name !== torrentPath || !name.endsWith('.torrent')) {
            clearTimeout(timer);
            answer(400, { error: 'torrentPath must be a .torrent filename in the torrent directory' });
            return;
          }
          source = path.join(TORRENT_DIR, name);
          if (!fs.existsSync(source)) {
            clearTimeout(timer);
            answer(404, { error: 'torrent file not found' });
            return;
          }
        }
        if (!source) {
          clearTimeout(timer);
          answer(400, { error: 'magnet or torrentPath required' });
          return;
        }
        const quotaCheck = (incomingBytes) =>
          fits({
            quotaBytes: QUOTA_BYTES,
      limits: { uploadBytesPerSecond: UPLOAD_LIMIT, downloadBytesPerSecond: DOWNLOAD_LIMIT },
            usedBytes: usedBytes(),
            incomingBytes,
            freeBytes: diskUsage()?.free,
            reserveBytes: DISK_RESERVE_BYTES,
          });
        const hint = exactLengthFromMagnet(source);
        const early = quotaCheck(hint);
        if (!early.ok) {
          clearTimeout(timer);
          answer(507, {
            error: `not enough space on this node (${early.reason})`,
            headroomBytes: early.headroomBytes,
          });
          return;
        }
        client.add(source, { path: DOWNLOAD_PATH, announce: ANNOUNCE }, (torrent) => {
          // `xl` is a hint; the metadata length is the fact. Checking here aborts
          // before the payload moves, which is the only place a cap can hold.
          const settled = quotaCheck(torrent.length);
          if (!settled.ok) {
            torrent.destroy({ destroyStore: true }, () => {
              clearTimeout(timer);
              answer(507, {
                error: `not enough space on this node (${settled.reason})`,
                headroomBytes: settled.headroomBytes,
              });
            });
            return;
          }
          persistSource(torrent, source);
          clearTimeout(timer);
          answer(200, { ok: true, name: torrent.name, infoHash: torrent.infoHash });
        });
      } catch (e) {
        clearTimeout(timer);
        answer(500, { error: e.message });
      }
    });
    return;
  }

  /**
   * POST /api/metadata { magnet } -> { name, infoHash, size, files, magnet }
   *
   * Resolves a magnet far enough to know what it is, then destroys it. The
   * console uses this to learn a release's size before adding it, and for the
   * magnet converter, so it must not keep the data: `destroyStore` removes
   * whatever was fetched while the metadata handshake ran.
   */
  if (url.pathname === '/api/metadata' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let answered = false;
      const answer = (status, payload) => {
        if (answered) return;
        answered = true;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      const magnet = (() => {
        try { return JSON.parse(body).magnet; } catch { return null; }
      })();
      if (typeof magnet !== 'string' || !magnet.startsWith('magnet:')) {
        answer(400, { error: 'a magnet: URI is required' });
        return;
      }
      const info = (torrent) => ({
        name: torrent.name,
        infoHash: torrent.infoHash,
        size: torrent.length,
        files: torrent.files.length,
        magnet: torrent.magnetURI,
      });
      const hash = new URL(magnet).searchParams.get('xt')?.replace('urn:btih:', '').toLowerCase();
      const held = hash && client.torrents.find((t) => t.infoHash.toLowerCase() === hash);
      if (held && held.length) {
        answer(200, info(held));
        return;
      }

      const timer = setTimeout(() => answer(504, { error: 'timed out waiting for metadata' }), 25000);
      let torrent;
      try {
        torrent = client.add(magnet, { path: DOWNLOAD_PATH, destroyStore: true }, (ready) => {
          clearTimeout(timer);
          const payload = info(ready);
          ready.destroy({ destroyStore: true }, () => answer(200, payload));
        });
      } catch (e) {
        clearTimeout(timer);
        answer(400, { error: e.message });
        return;
      }
      torrent.on('error', (e) => {
        clearTimeout(timer);
        try { torrent.destroy({ destroyStore: true }, () => answer(502, { error: e.message })); }
        catch { answer(502, { error: e.message }); }
      });
    });
    return;
  }

  if (url.pathname === '/api/files') {
    try {
      const files = fs.readdirSync(TORRENT_DIR).filter(f => f.endsWith('.torrent'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (url.pathname.startsWith('/api/torrents/') && req.method === 'DELETE') {
    const hash = url.pathname.split('/').pop();
    // `keepData=1` stops seeding but leaves the payload: the library is also the
    // HTTP source, so removing a torrent from a node must not delete the files
    // the web seed serves. The console's "unplace" uses this; "purge" does not.
    removeTorrent(hash, res, { keepData: url.searchParams.get('keepData') === '1' });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(ADMIN_PORT, () => {
  log.success(`Admin UI running on port ${ADMIN_PORT}`);
  log.info(`Peer port ${TORRENT_PORT} (TCP+UDP) — publish it in the compose file to accept inbound peers`);
});

// Stats logging
setInterval(() => {
  const totalPeers = client.torrents.reduce((s, t) => s + t.numPeers, 0);
  log.info(`[stats] torrents=${client.torrents.length} peers=${totalPeers} ↑${(client.uploadSpeed/1024).toFixed(1)}KB/s ↓${(client.downloadSpeed/1024).toFixed(1)}KB/s`);
}, 30000);

process.on('SIGTERM', () => {
  log.warning('Shutting down...');
  client.destroy(() => process.exit(0));
});
