const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('seeder', {
  checkPorts: () => ipcRenderer.invoke('ports:check'),
  setUpnp: (on) => ipcRenderer.invoke('upnp:set', on),
});
