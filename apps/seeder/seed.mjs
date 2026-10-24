import chalk from 'chalk';
import events from 'events';
import fs from 'fs';
import WebTorrent from 'webtorrent';
import Semaphore from './utils/semaphore.js';
import TRACKERS from './constants/TRACKERS.js';
import getInfoHashFromMagnetLink from './utils/getInfoHashFromMagnetLink.js';
import MAGNETLINKS from './constants/MAGNETLINKS.js';

// CONSTANTS
const DOWNLOAD_PATH = '/app/downloads';
const MAX_CONNS = 100;
const MAX_LISTENERS = 20;
const MAX_CONCURRENT_DOWNLOADS = 3;

events.EventEmitter.defaultMaxListeners = MAX_LISTENERS; // Adjust the number as needed

// Initialize with color themes
const log = {
  info: (msg) => console.log(chalk.blue(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warning: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.log(chalk.red(msg)),
  stats: (msg) => console.log(chalk.magenta(msg)),
  peer: (msg) => console.log(chalk.cyan(msg)),
};

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
  return `${(bytesPerSecond / Math.pow(1024, exp)).toFixed(1)} ${units[exp]}`;
}

// Ensure the downloads folder exists
if (!fs.existsSync(DOWNLOAD_PATH)) {
  fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
  log.info('✅ Created downloads folder');
} else {
  log.warning('📂 Downloads folder already exists');
}

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:host.docker.internal:3478?transport=udp',
      username: process.env.TURN_USERNAME || 'openquran',
      credential: process.env.TURN_PASSWORD || 'change-me-in-prod',
    },
    {
      urls: 'turn:host.docker.internal:3478?transport=tcp',
      username: process.env.TURN_USERNAME || 'openquran',
      credential: process.env.TURN_PASSWORD || 'change-me-in-prod',
    },
  ],
};
const client = new WebTorrent({ maxConns: MAX_CONNS, dht: true, ut_pex: true, tracker: { rtcConfig } });

const semaphore = new Semaphore(MAX_CONCURRENT_DOWNLOADS);

const options = {
  path: DOWNLOAD_PATH,
  announce: TRACKERS
};

async function processMagnetLinks() {
  let fetchedMAGNETLINKS;
  try {
    const magnetsUrl = process.env.MAGNETS_URL || 'https://tilawa.quran.us.kg/api/magnet-uris';
    const response = await fetch(magnetsUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    fetchedMAGNETLINKS = await response.json();
    if (!Array.isArray(fetchedMAGNETLINKS)) throw new Error('Response is not an array');
    log.success(`🔗 Fetched ${fetchedMAGNETLINKS.length} magnet links from tilawa.quran.us.kg/api/magnet-uris`);
  } catch (err) {
    log.warning('Failed to fetch magnet links from tilawa.quran.us.kg/api/magnet-uris, loading default magnet links');
    fetchedMAGNETLINKS = MAGNETLINKS;
  }

  for (const magnet of fetchedMAGNETLINKS) {
    // Skip placeholder magnet if present
    if (magnet && magnet.includes('8f3b8f8f3b8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f')) {
      log.warning('Skipping placeholder magnet for Maher_Al_Fadl');
      continue;
    }
    // Skip Wadih Al Yamani magnet - seeded from local torrent file (wadee.torrent)
    if (magnet && magnet.includes('Wadih_Al_Yamani')) {
      log.info('Skipping Wadih_Al_Yamani magnet - seeded from /app/wadee.torrent');
      continue;
    }
    // Extract the info hash from the magnet link
    const infoHash = getInfoHashFromMagnetLink(magnet);

    // Try to acquire new slot
    await semaphore.acquire();
    let released = false;
    const releaseSlot = () => {
      if (!released) {
        released = true;
        semaphore.release();
      }
    };

    if (!infoHash) {
      log.error('Invalid magnet link:', magnet);
      releaseSlot();
      continue;
    }

    try {
      // Check if the torrent already exists
      const torrent = await client.get(infoHash);
      if (torrent) {
        const name = torrent.name;
        const progress = (torrent.progress * 100).toFixed(2); // Progress as a percentage
        const totalSize = (torrent.length / (1024 * 1024)).toFixed(2); // Total size in MB
        log.info(`Name: ${name}, Progress: ${progress}%, Total Size: ${totalSize} MB`)
        log.warning(`Torrent ${name} (${infoHash}) - ${totalSize} MB already added; skipping.`)
        semaphore.release();
        continue;
      }

      client.add(magnet, options, function (torrent) {
        log.peer(`Torrent added: ${torrent.infoHash}`);
        // Save .torrent file for frontend (metadata without WebRTC)
        try {
          const torrentDir = '/data/torrents';
          if (!fs.existsSync(torrentDir)) fs.mkdirSync(torrentDir, { recursive: true });
          fs.writeFileSync(torrentDir + '/' + torrent.infoHash + '.torrent', torrent.torrentFile);
          log.info(`Saved torrent file: ${torrent.infoHash}.torrent`);
        } catch (e) { log.error('Failed to save torrent file: ' + e.message); }

        // Add speed tracking interval
        const speedInterval = setInterval(() => {
          log.stats(
            `[${torrent.name}] ↓ ${formatSpeed(
              torrent.downloadSpeed
            )}/s | ↑ ${formatSpeed(torrent.uploadSpeed)}/s | ` +
            `Progress: ${(torrent.progress * 100).toFixed(1)}%`
          )
        }, 5000); // Update every 5 seconds

        const cleanup = () => {
          clearInterval(speedInterval);
          releaseSlot();
          // Avoid removing all listeners to prevent breaking WebTorrent internals
        };

        torrent.on('done', () => {
          log.peer(`Download completed: ${torrent.name}`);
          cleanup();
        });

        torrent.on('error', (err) => {
          log.error(`Error in torrent ${torrent.name}: ${err.message}`);
          cleanup();
        });

      });
    } catch (error) {
      log.error(`Error processing magnet link: ${error.message}`);
      if (typeof releaseSlot === 'function') {
        releaseSlot();
      } else {
        semaphore.release();
      }
    }
  }

  // Seed Wadih Al Yamani from local files (creates a new torrent, no verification needed).
  // The data must already exist under DOWNLOAD_PATH/Wadih_Al_Yamani/.
  const WADIH_DIR = DOWNLOAD_PATH + '/Wadih_Al_Yamani';
  if (fs.existsSync(WADIH_DIR)) {
    await semaphore.acquire();
    client.seed(WADIH_DIR, { name: 'Wadih_Al_Yamani', pieceLength: 2097152 }, function (torrent) {
      log.peer(`Seeding from files: ${torrent.infoHash} (${torrent.name})`);
      try {
        const torrentDir = '/data/torrents';
        if (!fs.existsSync(torrentDir)) fs.mkdirSync(torrentDir, { recursive: true });
        fs.writeFileSync(torrentDir + '/' + torrent.infoHash + '.torrent', torrent.torrentFile);
        log.info(`Saved torrent file: ${torrent.infoHash}.torrent`);
      } catch (e) { log.error('Failed to save torrent file: ' + e.message); }
      const cleanup = () => { semaphore.release(); clearInterval(speedInterval); };
      const speedInterval = setInterval(() => {
        log.stats(`[${torrent.name}] ↑ ${formatSpeed(torrent.uploadSpeed)}/s`);
      }, 10000);
      torrent.on('error', (err) => { log.error(`Error: ${err.message}`); cleanup(); });
    });
  }
}

function gracefulShutdown() {
  log.info('\n🛑 Shutting down gracefully...');
  client.destroy((err) => {
    if (err) {
      log.error(`❌ Error during client destruction: ${err.message}`);
      process.exit(1);
    } else {
      log.success('✅ Client destroyed successfully.');
      process.exit(0);
    }
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start processing magnet links
await processMagnetLinks();
