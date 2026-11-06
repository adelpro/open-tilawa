const { app, BrowserWindow, ipcMain } = require('electron');
const net = require('node:net');
const dgram = require('node:dgram');
const natUpnp = require('nat-upnp');
const path = require('node:path');

const PEER_PORT = 6881;
const ADMIN_PORT = 8085;
let window = null;
let upnpOn = false;
let quitting = false;
const mapped = new Set();

function canBindTcp(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    const done = (free) => {
      server.removeAllListeners();
      resolve(free);
    };
    server.once('error', () => done(false));
    server.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
      server.close(() => done(true));
    });
  });
}

function canBindUdp(port) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const done = (free) => {
      socket.removeAllListeners();
      try { socket.close(); } catch { /* not bound */ }
      resolve(free);
    };
    socket.once('error', () => done(false));
    socket.bind({ port, address: '0.0.0.0', exclusive: true }, () => done(true));
  });
}

async function checkPorts() {
  return {
    tcp6881: await canBindTcp(PEER_PORT),
    udp6881: await canBindUdp(PEER_PORT),
    tcp8085: await canBindTcp(ADMIN_PORT),
  };
}

function map(protocol) {
  return new Promise((resolve, reject) => {
    const client = natUpnp.createClient();
    client.portMapping(
      {
        public: PEER_PORT,
        private: PEER_PORT,
        protocol,
        ttl: 0,
        description: 'Tilawah seeder',
      },
      (error) => (error ? reject(new Error(String(error.message || error))) : resolve()),
    );
  });
}

function unmap(protocol) {
  return new Promise((resolve) => {
    const client = natUpnp.createClient();
    client.portUnmapping(
      { public: PEER_PORT, protocol },
      () => resolve(),
    );
  });
}

async function clearMappings() {
  await Promise.all([...mapped].map((protocol) => unmap(protocol)));
  mapped.clear();
  upnpOn = false;
}

async function setUpnp(next) {
  if (next === upnpOn) return { on: upnpOn };
  if (!next) {
    await clearMappings();
    return { on: false };
  }

  try {
    await map('TCP');
    mapped.add('TCP');
    await map('UDP');
    mapped.add('UDP');
    upnpOn = true;
    return { on: true };
  } catch (error) {
    await clearMappings();
    throw error;
  }
}

ipcMain.handle('ports:check', () => checkPorts());
ipcMain.handle('upnp:set', (_event, next) => setUpnp(Boolean(next)));

function createWindow() {
  window = new BrowserWindow({
    width: 620,
    height: 640,
    minWidth: 520,
    minHeight: 560,
    title: 'Tilawah Seeder',
    backgroundColor: '#f7f5f0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (quitting || !upnpOn) return;
  // TTL is 0: wait for the router to drop the mapping before the app exits.
  event.preventDefault();
  quitting = true;
  clearMappings().finally(() => app.quit());
});
