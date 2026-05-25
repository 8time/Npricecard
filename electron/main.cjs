const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// app:// カスタムプロトコルを安全なコンテキストとして登録
// showDirectoryPicker などの File System Access API を使うために必要
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

const distPath = path.join(__dirname, '..', 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL('app://localhost/index.html');

  // Ctrl+Shift+I で DevTools を開く（デバッグ用）
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.control && input.shift && input.key === 'I') {
      win.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    let { pathname } = new URL(request.url);
    pathname = decodeURIComponent(pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(distPath, pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
