const { app, BrowserWindow, protocol, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerIpcHandlers } = require('./ipc.cjs');
const { buildApplicationMenu } = require('./menu.cjs');

// Register 'app' as a standard, secure scheme capable of fetch & streaming WebAssembly
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: false,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

let mainWindow = null;
let fileToOpenOnReady = null;

// Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const targetFile = findCadFileInArgv(commandLine, workingDirectory || process.cwd());
    if (targetFile && mainWindow) {
      sendOpenFile(mainWindow, targetFile);
    }
  });
}

function findCadFileInArgv(argv, baseDir = process.cwd()) {
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg === 'string' && /\.(stl|3mf|step|stp)$/i.test(arg)) {
      const resolved = path.isAbsolute(arg) ? arg : path.resolve(baseDir, arg);
      if (fs.existsSync(resolved)) return resolved;
    }
  }
  return null;
}

async function sendOpenFile(win, filePath) {
  try {
    const data = await fs.promises.readFile(filePath);
    win.webContents.send('app:openFile', {
      name: path.basename(filePath),
      data
    });
  } catch (err) {
    console.error('Failed to read file for open:', err);
  }
}

function setupProtocolHandler() {
  const webRoot = path.join(__dirname, '..', 'web');
  const webRootPrefix = webRoot.endsWith(path.sep) ? webRoot : webRoot + path.sep;

  protocol.handle('app', async (request) => {
    const parsed = new URL(request.url);
    let pathname = decodeURIComponent(parsed.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';

    const safePath = path.normalize(path.join(webRoot, pathname));
    if (safePath !== webRoot && !safePath.startsWith(webRootPrefix)) {
      return new Response('Access Denied', { status: 403 });
    }

    try {
      const data = await fs.promises.readFile(safePath);
      let contentType = 'application/octet-stream';
      if (safePath.endsWith('.html')) contentType = 'text/html; charset=utf-8';
      else if (safePath.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
      else if (safePath.endsWith('.css')) contentType = 'text/css; charset=utf-8';
      else if (safePath.endsWith('.wasm')) contentType = 'application/wasm';
      else if (safePath.endsWith('.svg')) contentType = 'image/svg+xml';
      else if (safePath.endsWith('.png')) contentType = 'image/png';
      else if (safePath.endsWith('.json')) contentType = 'application/json';

      return new Response(data, {
        headers: {
          'Content-Type': contentType,
          'Content-Security-Policy': "default-src 'self' app:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' app:; style-src 'self' 'unsafe-inline' app:; img-src 'self' data: blob: app:; worker-src 'self' blob: app:; object-src 'none';"
        }
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '..', 'assets', 'icons', 'icon.ico')
    : path.join(__dirname, '..', 'assets', 'icons', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'support-fins',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webgl: true
    }
  });

  registerIpcHandlers(mainWindow);
  Menu.setApplicationMenu(buildApplicationMenu(mainWindow));

  mainWindow.loadURL('app://localhost/index.html');

  mainWindow.webContents.once('did-finish-load', () => {
    if (fileToOpenOnReady) {
      sendOpenFile(mainWindow, fileToOpenOnReady);
      fileToOpenOnReady = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupProtocolHandler();
  fileToOpenOnReady = findCadFileInArgv(process.argv);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
