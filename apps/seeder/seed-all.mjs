import chalk from 'chalk';
import events from 'events';
import fs from 'fs';
import path from 'path';
import http from 'http';
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
  // Basic auth
  const auth = req.headers.authorization || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString();
    const [user, pass] = decoded.split(':');
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'change-me';
    if (user !== adminUser || pass !== adminPass) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Seeder Admin"' });
      res.end('Unauthorized');
      return;
    }
  } else {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Seeder Admin"' });
    res.end('Unauthorized');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(adminHtml);
    return;
  }

  if (url.pathname === '/api/torrents') {
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

  // Handle POST /api/torrents (add torrent)
  if (url.pathname === '/api/torrents' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { magnet, torrentPath } = JSON.parse(body);
        const source = magnet || (torrentPath ? path.join(TORRENT_DIR, torrentPath) : null);
        if (!source) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'magnet or torrentPath required' }));
          return;
        }
        client.add(source, { path: DOWNLOAD_PATH }, (torrent) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, name: torrent.name, infoHash: torrent.infoHash }));
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
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
