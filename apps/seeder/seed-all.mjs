import chalk from 'chalk';
import events from 'events';
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
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
const MAX_CONNS = 100;

events.EventEmitter.defaultMaxListeners = 20;

const log = {
  info: (msg) => console.log(chalk.blue(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warning: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.log(chalk.red(msg)),
};

if (!fs.existsSync(DOWNLOAD_PATH)) {
  fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
}

const client = new WebTorrent({ maxConns: MAX_CONNS, dht: true, ut_pex: true });
globalThis.wtClient = client;

const torrentFiles = fs.readdirSync(TORRENT_DIR).filter(f => f.endsWith('.torrent'));
log.info(`Found ${torrentFiles.length} torrent files in ${TORRENT_DIR}`);

for (const tf of torrentFiles) {
  const fullPath = path.join(TORRENT_DIR, tf);
  client.add(fullPath, { path: DOWNLOAD_PATH }, (torrent) => {
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
        client.add(source, { path: DOWNLOAD_PATH }, (torrent) => {
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
