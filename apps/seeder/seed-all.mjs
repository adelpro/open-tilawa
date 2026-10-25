import chalk from 'chalk';
import events from 'events';
import fs from 'fs';
import path from 'path';
import WebTorrent from 'webtorrent';

const TORRENT_DIR = process.env.TORRENT_DIR || '/data/torrents';
const DOWNLOAD_PATH = process.env.DOWNLOAD_PATH || '/app/downloads';
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

const torrentFiles = fs.readdirSync(TORRENT_DIR).filter(f => f.endsWith('.torrent'));
log.info(`Found ${torrentFiles.length} torrent files in ${TORRENT_DIR}`);

for (const tf of torrentFiles) {
  const fullPath = path.join(TORRENT_DIR, tf);
  client.add(fullPath, { path: DOWNLOAD_PATH }, (torrent) => {
    log.success(`Seeding: ${torrent.name} (${torrent.infoHash}) — ${torrent.files.length} files`);
    torrent.on('upload', () => {
      // periodic stats
    });
  });
}

// Print stats every 30s
setInterval(() => {
  const totalPeers = client.torrents.reduce((s, t) => s + t.numPeers, 0);
  const totalUp = client.uploadSpeed;
  const totalDown = client.downloadSpeed;
  log.info(`[stats] torrents=${client.torrents.length} peers=${totalPeers} ↑${(totalUp/1024).toFixed(1)}KB/s ↓${(totalDown/1024).toFixed(1)}KB/s`);
}, 30000);

process.on('SIGTERM', () => {
  log.warning('Shutting down...');
  client.destroy(() => process.exit(0));
});
