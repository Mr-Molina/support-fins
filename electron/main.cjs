const { app, BrowserWindow, protocol, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerIpcHandlers } = require('./ipc.cjs');
const { buildApplicationMenu } = require('./menu.cjs');

function appLog(...args) {
  try {
    const logDir = app.getPath('userData');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'main.log');
    const msg = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
    fs.appendFileSync(logFile, msg);
  } catch (_) {}
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  appLog('UNCAUGHT EXCEPTION:', err.stack || err.message);
  try {
    dialog.showErrorBox('Support Fins - Uncaught Error', err.stack || err.message);
  } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  appLog('UNHANDLED REJECTION:', reason);
});

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

appLog('Application starting. PID:', process.pid, 'Argv:', process.argv);

// Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  appLog('Single-instance lock denied. Exiting secondary process.');
  app.quit();
  process.exit(0);
} else {
  appLog('Single-instance lock acquired successfully.');
  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    appLog('Second-instance event received. commandLine:', commandLine);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true);
        mainWindow.setAlwaysOnTop(false);
      }
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
  appLog('createWindow: start');
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '..', 'assets', 'icons', 'icon.ico')
    : path.join(__dirname, '..', 'assets', 'icons', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'support-fins',
    show: true,
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

  mainWindow.once('ready-to-show', () => {
    appLog('mainWindow: ready-to-show');
    mainWindow.focus();
    if (process.platform === 'win32') {
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setAlwaysOnTop(false);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    appLog('mainWindow: did-fail-load', errorCode, errorDescription, validatedURL);
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    dialog.showErrorBox(
      'Support Fins Startup Error',
      `Failed to load application URL:\n${validatedURL}\n\nError: ${errorDescription} (${errorCode})`
    );
  });

  // Open all external web links in the system's default browser, never inside the application
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
        appLog('setWindowOpenHandler intercepted external url:', url);
        shell.openExternal(url);
      }
    } catch (e) {
      console.error('Failed to open external url:', e);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
        event.preventDefault();
        appLog('will-navigate intercepted external url:', url);
        shell.openExternal(url);
      }
    } catch (e) {
      console.error('Failed to open external url:', e);
    }
  });

  appLog('mainWindow: loadURL app://localhost/index.html');
  mainWindow.loadURL('app://localhost/index.html');

  mainWindow.webContents.once('did-finish-load', () => {
    appLog('mainWindow: did-finish-load');
    if (fileToOpenOnReady) {
      sendOpenFile(mainWindow, fileToOpenOnReady);
      fileToOpenOnReady = null;
    }
  });

  mainWindow.on('closed', () => {
    appLog('mainWindow: closed');
    mainWindow = null;
  });
  appLog('createWindow: complete');
}

app.whenReady().then(() => {
  if (!gotTheLock) return;
  appLog('app: whenReady');
  setupProtocolHandler();
  fileToOpenOnReady = findCadFileInArgv(process.argv);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  appLog('app: window-all-closed');
  if (process.platform !== 'darwin') {
    app.quit();
    setTimeout(() => process.exit(0), 400);
  }
});


