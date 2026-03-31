const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  version: '1.0.0',
});