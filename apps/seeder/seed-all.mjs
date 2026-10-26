import chalk from 'chalk';
import events from 'events';
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { exactLengthFromMagnet, fits, quotaFromEnv } from './lib/policy.mjs';
import TRACKERS from './constants/TRACKERS.js';
import { readFileSync as readFile, statfsSync } from 'fs';

/**
 * What this artefact is, stamped at build time.
 *
 * The dashboard compares it with the tag it expects, so "is this node running
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
 * The dashboard plans assignments against this: a node with 40 GB left should
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
/** 0 = unlimited. Enforced here, on the node, because a dashboard-side cap is a promise. */
const QUOTA_BYTES = quotaFromEnv();
const DISK_RESERVE_BYTES = Math.floor(Number(process.env.DISK_RESERVE_GB || 1) * 1024 ** 3);
/** A community node can keep the API and hide the browsable UI. */
const SERVE_ADMIN_UI = process.env.ADMIN_UI !== '0';
const MAX_CONNS = 100;
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
  dht: true,
  ut_pex: true,
  ...(UPLOAD_LIMIT > 0 ? { uploadLimit: UPLOAD_LIMIT } : {}),
  ...(DOWNLOAD_LIMIT > 0 ? { downloadLimit: DOWNLOAD_LIMIT } : {}),
});
globalThis.wtClient = client;

const torrentFiles = fs.readdirSync(TORRENT_DIR).filter(f => f.endsWith('.torrent'));
log.info(`Found ${torrentFiles.length} torrent files in ${TORRENT_DIR}`);

for (const tf of torrentFiles) {
  const fullPath = path.join(TORRENT_DIR, tf);
  // Announce to our tracker as well as whatever the .torrent already lists:
  // without this the node seeds happily but is invisible on the tracker.
  client.add(fullPath, { path: DOWNLOAD_PATH, announce: TRACKERS }, (torrent) => {
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
    // A magnet that never resolves must fail visibly, not hang the dashboard.
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
        client.add(source, { path: DOWNLOAD_PATH, announce: TRACKERS }, (torrent) => {
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
   * dashboard uses this to learn a release's size before adding it, and for the
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
    const torrent = client.get(hash);
    if (!torrent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    torrent.destroy(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(ADMIN_PORT, () => {
  log.success(`Admin UI running on port ${ADMIN_PORT}`);
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
