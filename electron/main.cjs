const { app, BrowserWindow, session, desktopCapturer, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, '../public/icon.ico'),
    title: 'Yırak Remote',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform !== 'darwin' && {
      titleBarOverlay: {
        color: '#111010',
        symbolColor: '#c5a059',
        height: 40
      }
    })
  });

  // Ekran paylaşımı için izin ver
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    });
  });

  // Dış linkleri tarayıcıda aç
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
if (isDev) {
  win.loadURL('http://localhost:3000');
  win.webContents.openDevTools({ mode: 'detach' });
} else {
  win.loadFile(path.join(__dirname, '../dist/index.html'));
}

  win.setMenuBarVisibility(false);

  // Pencere hazır olduğunda göster
  win.once('ready-to-show', () => {
    win.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});