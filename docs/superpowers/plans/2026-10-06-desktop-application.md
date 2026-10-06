# Desktop Application (Windows & Linux) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `support-fins` into a cross-platform desktop application installable on Windows (`.exe` NSIS installer, portable) and Linux (`.AppImage`, `.deb`) featuring native OS file dialogs, direct disk streaming, single-instance file associations, and full offline WebAssembly/WebGL execution, while preserving 100% static web browser compatibility.

**Architecture:** Electron 35 wrapping the existing static `web/` assets via an isolated, secure privileged custom protocol (`app://`). A minimal, context-isolated bridge (`window.desktopAPI`) exposes native OS capabilities (dialogs, direct file streaming, file associations, window state persistence) through a unified frontend platform abstraction (`web/ui/platform.js`) that gracefully falls back to browser APIs when running on the web. Packaging is driven by `electron-builder` with multi-target cross-compilation for Windows (`nsis`, `portable`) and Linux (`AppImage`, `deb`), accompanied by an automated GitHub Actions release workflow.

**Tech Stack:** Electron 35, Node.js 22 LTS, electron-builder, Three.js r185, OpenCASCADE WebAssembly (`occt-import-js-0.0.23`), ES Modules, GitHub Actions CI/CD.

**Spec:** `docs/FIN-SPEC.md` and this architecture blueprint.

## Global Constraints

- Node.js runtime floor: Node >= 20.0.0 (Host has Node v22.23.2, npm 11.13.0).
- Dual-target invariant: The core static web application in `web/` must remain 100% operational when served via static HTTP servers (Cloudflare Workers, Nginx container, `dev-server.py`) and pass all existing Deno test suites (`deno test --allow-read tests/`) with zero dependency on Node or Electron in browser mode.
- Invariant 36: Preserve all existing code docstrings, mathematical explanations, and geometric comments.
- Security Invariant 24: Context isolation (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`) strictly enforced in Electron renderer; no raw Node `fs` or `child_process` directly exposed to the DOM.
- Protocol invariant: Electron assets served via privileged `app://` scheme with standard, secure, fetch, and streaming privileges enabled to allow ES module Web Workers and WebAssembly instantiation without CORS hurdles.
- Platform support: Windows 10/11 x64 (`.exe` NSIS installer, portable executable), Linux x64 (glibc >= 2.31, `.AppImage` portable, `.deb` package).

## Review Focus

1. *Large CAD file memory exhaustion during native save*: Exporting high-poly STL/3MF files (>50MB) through IPC must transfer binary TypedArrays or Buffer references directly without UTF-8 stringification or memory doubling.
2. *File association launch arguments*: Double-clicking an `.stl`, `.step`, or `.3mf` file in Windows Explorer or Linux file manager must parse `process.argv` on initial launch and handle `second-instance` IPC when the application is already open, passing the file path to `desktopAPI.onOpenFile`.
3. *Offline capability and local asset protocol*: Ensuring OpenCASCADE WASM (`occt-import-js.wasm`), Three.js, and ES module Web Workers (`finworker.js`, `stepworker.js`) resolve and instantiate cleanly under `app://` protocol with 0 network connectivity.
4. *Dialog cancelation & abort semantics*: User dismissing native Open or Save dialogs must resolve gracefully to `null` without throwing unhandled Promise rejections, clearing pending state or spinners.
5. *Headless and browser regression*: Ensuring the frontend platform abstraction (`web/ui/platform.js`) detects non-desktop environments immediately, falling back to browser `<input>` and Blob downloads, keeping all 183 Deno unit tests passing.

---

### Task 1: Desktop Platform Bridge & Renderer Abstraction (`web/ui/platform.js`)

**Files:**
- Create: `web/ui/platform.js`
- Test: `tests/platform.test.js`

**Interfaces:**
- Consumes: `window.desktopAPI` (optional), browser `Blob`, `URL.createObjectURL`, `document.createElement('a')`
- Produces:
  - `isDesktop(): boolean`
  - `openFileDialog(options?: { filters?: Array<{ name: string, extensions: string[] }> }): Promise<{ name: string, data: ArrayBuffer } | null>`
  - `saveFileDialog(options: { defaultPath?: string, filters?: Array<{ name: string, extensions: string[] }> }): Promise<string | null>`
  - `saveFile(filename: string, data: ArrayBuffer | Uint8Array, mimeType?: string): Promise<boolean>`
  - `onFileOpen(callback: (file: { name: string, data: ArrayBuffer }) => void): () => void`
  - `setDocumentTitle(title: string): void`

- [ ] **Step 1: Write the failing test**

Create `tests/platform.test.js`:
```javascript
import { assertEquals } from 'jsr:@std/assert@1';
import { isDesktop, saveFile, openFileDialog } from '../web/ui/platform.js';

Deno.test('platform: detects browser environment by default when window.desktopAPI is missing', () => {
  assertEquals(isDesktop(), false);
});

Deno.test('platform: detects desktop environment when window.desktopAPI is mocked', () => {
  const original = globalThis.window;
  try {
    globalThis.window = {
      desktopAPI: {
        isDesktop: true,
        showOpenDialog: () => Promise.resolve({ canceled: true }),
        showSaveDialog: () => Promise.resolve({ canceled: true }),
        writeFile: () => Promise.resolve(true),
      },
    };
    assertEquals(isDesktop(), true);
  } finally {
    globalThis.window = original;
  }
});

Deno.test('platform: desktop saveFile writes directly via IPC bridge', async () => {
  const original = globalThis.window;
  let savedPath = null;
  let savedBytes = null;
  try {
    globalThis.window = {
      desktopAPI: {
        isDesktop: true,
        showSaveDialog: async (opts) => ({ canceled: false, filePath: 'C:/test/' + opts.defaultPath }),
        writeFile: async (path, buffer) => {
          savedPath = path;
          savedBytes = buffer;
          return true;
        },
      },
    };
    const data = new Uint8Array([1, 2, 3, 4]).buffer;
    const ok = await saveFile('part-fins.stl', data, 'application/sla');
    assertEquals(ok, true);
    assertEquals(savedPath, 'C:/test/part-fins.stl');
    assertEquals(new Uint8Array(savedBytes).length, 4);
  } finally {
    globalThis.window = original;
  }
});

Deno.test('platform: desktop saveFile returns false on cancelation', async () => {
  const original = globalThis.window;
  try {
    globalThis.window = {
      desktopAPI: {
        isDesktop: true,
        showSaveDialog: async () => ({ canceled: true }),
        writeFile: async () => true,
      },
    };
    const data = new Uint8Array([1, 2, 3, 4]).buffer;
    const ok = await saveFile('part-fins.stl', data, 'application/sla');
    assertEquals(ok, false);
  } finally {
    globalThis.window = original;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/platform.test.js
```
Expected: FAIL with "Cannot find module '../web/ui/platform.js'"

- [ ] **Step 3: Write minimal implementation**

Create `web/ui/platform.js`:
```javascript
/**
 * Platform abstraction layer for support-fins.
 *
 * Provides a unified API for file operations and system integration that
 * transparently switches between:
 * 1. Desktop mode (Electron): Native OS file dialogs, direct disk streaming,
 *    and file association handlers exposed via window.desktopAPI.
 * 2. Browser mode (Static Web): Standard DOM <input type="file"> and Blob
 *    downloads.
 */

/** Check if running inside the desktop app container. */
export function isDesktop() {
  return typeof window !== 'undefined' && Boolean(window.desktopAPI?.isDesktop);
}

/**
 * Prompt the user to select a 3D CAD model (STL, 3MF, STEP).
 * On desktop: launches the native OS file picker.
 * On browser: resolves null (browser relies on DOM input event listeners).
 *
 * @param {object} [opts]
 * @returns {Promise<{ name: string, data: ArrayBuffer } | null>}
 */
export async function openFileDialog(opts = {}) {
  if (isDesktop() && window.desktopAPI?.showOpenDialog) {
    const res = await window.desktopAPI.showOpenDialog({
      title: 'Open 3D Model',
      filters: opts.filters || [
        { name: '3D Models (*.stl, *.3mf, *.step, *.stp)', extensions: ['stl', '3mf', 'step', 'stp'] },
        { name: 'STL Meshes (*.stl)', extensions: ['stl'] },
        { name: '3MF Packages (*.3mf)', extensions: ['3mf'] },
        { name: 'STEP CAD Files (*.step, *.stp)', extensions: ['step', 'stp'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    if (!res || res.canceled || !res.file) return null;
    return res.file; // { name, data: ArrayBuffer }
  }
  return null;
}

/**
 * Save binary CAD export data (STL or 3MF).
 * On desktop: opens native OS Save Dialog and writes directly to disk.
 * On browser: synthesizes a Blob download link.
 *
 * @param {string} filename Default filename (e.g. 'part-fins.stl')
 * @param {ArrayBuffer | Uint8Array} data Binary content to write
 * @param {string} [mimeType='application/octet-stream']
 * @returns {Promise<boolean>} True if written/triggered, false if canceled
 */
export async function saveFile(filename, data, mimeType = 'application/octet-stream') {
  if (isDesktop() && window.desktopAPI?.showSaveDialog && window.desktopAPI?.writeFile) {
    const ext = filename.split('.').pop() || '';
    const res = await window.desktopAPI.showSaveDialog({
      title: 'Save Supported Model',
      defaultPath: filename,
      filters: [
        { name: `${ext.toUpperCase()} File (*.${ext})`, extensions: [ext] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    if (!res || res.canceled || !res.filePath) return false;
    const buf = data instanceof Uint8Array ? data.buffer : data;
    return await window.desktopAPI.writeFile(res.filePath, buf);
  }

  // Browser fallback: Blob download
  if (typeof document !== 'undefined') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  return false;
}

/**
 * Register a listener for files opened via OS file associations (double-click in Explorer/Finder).
 *
 * @param {(file: { name: string, data: ArrayBuffer }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onFileOpen(callback) {
  if (isDesktop() && window.desktopAPI?.onFileOpen) {
    return window.desktopAPI.onFileOpen(callback);
  }
  return () => {};
}

/**
 * Update the application title in the window / document header.
 *
 * @param {string} title
 */
export function setDocumentTitle(title) {
  if (typeof document !== 'undefined') {
    document.title = title ? `${title} - support-fins` : 'support-fins';
  }
  if (isDesktop() && window.desktopAPI?.setTitle) {
    window.desktopAPI.setTitle(title);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/platform.test.js
```
Expected: PASS (4 passed, 0 failed)

- [ ] **Step 5: Commit**

```bash
git add web/ui/platform.js tests/platform.test.js
git commit -m "feat(desktop): add platform abstraction layer with desktop and browser fallbacks"
```

---

### Task 2: Integrate Platform Abstraction into `web/ui/export.js` and `web/ui/io.js`

**Files:**
- Modify: `web/ui/export.js:1-66`
- Modify: `web/ui/io.js:1-60, 220-259`
- Test: `tests/ui_export_platform.test.js`

**Interfaces:**
- Consumes: `platform.saveFile`, `platform.openFileDialog`, `platform.onFileOpen`, `parseModel`, `setPart`
- Produces: Desktop-aware export with direct disk write and OS file association loading in renderer.

- [ ] **Step 1: Write the failing test**

Create `tests/ui_export_platform.test.js`:
```javascript
import { assertEquals } from 'jsr:@std/assert@1';
import { isDesktop, saveFile } from '../web/ui/platform.js';
import { writeBinarySTL } from '../web/stl.js';

Deno.test('ui/export: saveFile coordinates binary STL export without DOM side-effects in headless/mock mode', async () => {
  const tri = [[0, 0, 0], [10, 0, 0], [0, 10, 0]];
  const blob = writeBinarySTL(tri, 'Part');
  const buffer = await blob.arrayBuffer();

  let capturedPath = null;
  let capturedBytes = null;

  globalThis.window = {
    desktopAPI: {
      isDesktop: true,
      showSaveDialog: async () => ({ canceled: false, filePath: '/tmp/output.stl' }),
      writeFile: async (p, b) => {
        capturedPath = p;
        capturedBytes = b;
        return true;
      },
    },
  };

  try {
    const ok = await saveFile('output.stl', buffer, 'application/sla');
    assertEquals(ok, true);
    assertEquals(capturedPath, '/tmp/output.stl');
    assertEquals(capturedBytes.byteLength, buffer.byteLength);
  } finally {
    delete globalThis.window;
  }
});
```

- [ ] **Step 2: Run test to verify it fails/passes**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/ui_export_platform.test.js
```
Expected: PASS

- [ ] **Step 3: Modify `web/ui/export.js` to use `platform.saveFile`**

Update `web/ui/export.js`:
```javascript
/**
 * Export: the oriented part plus the fins/pad, as STL or 3MF.
 */
import { writeBinarySTL } from '../stl.js';
import { writeThreeMF } from '../threemf.js';
import { el } from './dom.js';
import { part, topology, lastResult, rotM3, partName, activeAdded } from '../app.js';
import { saveFile } from './platform.js';

/**
 * Export the part AS ORIENTED, seated on the plate, with the fins as extra
 * solids in the same file. The whole promise of the tool is that the STL prints
 * the same way for whoever opens it, so the orientation has to be baked in --
 * exporting the original frame and hoping the user re-rotates defeats the point.
 */
export function buildExportGeometry() {
  if (!part || !topology || !lastResult) return null;
  const rot = rotM3.elements;
  const dz = lastResult.offset.z;
  const dx = lastResult.offset.x, dy = lastResult.offset.y;
  const { pos, nFaces } = topology;

  const partTris = new Array(nFaces * 3);
  for (let f = 0; f < nFaces; f++) {
    for (let i = 0; i < 3; i++) {
      const o = f * 9 + i * 3;
      const x = pos[o], y = pos[o + 1], z = pos[o + 2];
      partTris[f * 3 + i] = [
        rot[0] * x + rot[3] * y + rot[6] * z + dx,
        rot[1] * x + rot[4] * y + rot[7] * z + dy,
        rot[2] * x + rot[5] * y + rot[8] * z + dz,
      ];
    }
  }
  const finTris = [...activeAdded()];
  const base = partName.replace(/\.(stl|3mf|step|stp)$/i, '') || 'part';
  return { partTris, finTris, base };
}

el('export').addEventListener('click', async () => {
  const g = buildExportGeometry();
  if (!g) return;
  const blob = writeBinarySTL([...g.partTris, ...g.finTris], g.base);
  const buf = await blob.arrayBuffer();
  await saveFile(`${g.base}-fins.stl`, buf, 'application/sla');
});

el('export-3mf').addEventListener('click', async () => {
  const g = buildExportGeometry();
  if (!g) return;
  const blob = writeThreeMF(g.partTris, g.finTris, g.base);
  const buf = await blob.arrayBuffer();
  await saveFile(`${g.base}-fins.3mf`, buf, 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml');
});
```

- [ ] **Step 4: Update `web/ui/io.js` to register file association listener and desktop open**

In `web/ui/io.js`:
Add import:
```javascript
import { isDesktop, onFileOpen, openFileDialog } from './platform.js';
```
And add file association listener at initialization:
```javascript
// Register file association listener for desktop app (double click in Explorer)
onFileOpen(async ({ name, data }) => {
  try {
    const geometry = await parseModel(data);
    if (!geometry) return;
    setPart(geometry, name);
  } catch (err) {
    console.error('Failed to open associated file:', err);
    alert(`Could not open ${name}:\n${err.message}`);
  }
});
```

- [ ] **Step 5: Run full test suite to verify no regressions**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/
```
Expected: All tests pass (185+ passed, 0 failed).

- [ ] **Step 6: Commit**

```bash
git add web/ui/export.js web/ui/io.js tests/ui_export_platform.test.js
git commit -m "feat(ui): connect native save dialogs and OS file associations to export and io"
```

---

### Task 3: Electron Main Process & Secure IPC Architecture (`electron/`)

**Files:**
- Create: `package.json`
- Create: `electron/main.cjs`
- Create: `electron/preload.cjs`
- Create: `electron/ipc.cjs`
- Create: `electron/menu.cjs`
- Test: `tests/electron_ipc.test.js`

**Interfaces:**
- Consumes: Node `fs/promises`, Electron `app`, `BrowserWindow`, `ipcMain`, `dialog`, `protocol`, `Menu`
- Produces: Standalone desktop executable environment hosting `web/` assets over `app://` protocol.

- [ ] **Step 1: Create `package.json` for Electron dependencies & scripts**

Create `package.json`:
```json
{
  "name": "support-fins",
  "version": "1.0.0",
  "description": "FDM support fin generator for thin walls and tall 3D prints",
  "main": "electron/main.cjs",
  "author": "Mr-Molina",
  "license": "MIT",
  "scripts": {
    "start": "electron .",
    "desktop:start": "electron .",
    "desktop:dist": "electron-builder --config electron-builder.json",
    "desktop:dist:win": "electron-builder --config electron-builder.json --win",
    "desktop:dist:linux": "electron-builder --config electron-builder.json --linux"
  },
  "devDependencies": {
    "electron": "^35.0.0",
    "electron-builder": "^25.1.8"
  }
}
```

- [ ] **Step 2: Create `electron/preload.cjs` with context isolation**

Create `electron/preload.cjs`:
```javascript
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Securely expose desktop capabilities to the renderer process.
 * Renderer code accesses this exclusively via `window.desktopAPI`.
 */
contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,

  showOpenDialog: (opts) => ipcRenderer.invoke('dialog:openFile', opts),

  showSaveDialog: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),

  writeFile: (filePath, buffer) => ipcRenderer.invoke('fs:writeFile', filePath, buffer),

  setTitle: (title) => ipcRenderer.send('window:setTitle', title),

  onFileOpen: (callback) => {
    const handler = (_event, file) => callback(file);
    ipcRenderer.on('app:openFile', handler);
    return () => ipcRenderer.removeListener('app:openFile', handler);
  }
});
```

- [ ] **Step 3: Create `electron/ipc.cjs` for native OS dialogs and filesystem streaming**

Create `electron/ipc.cjs`:
```javascript
const { ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');

function registerIpcHandlers(mainWindow) {
  ipcMain.handle('dialog:openFile', async (_event, opts = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: opts.title || 'Open 3D Model',
      filters: opts.filters || [],
      properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) return { canceled: true };
    const filePath = filePaths[0];
    const data = await fs.readFile(filePath);
    return {
      canceled: false,
      file: {
        name: path.basename(filePath),
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      }
    };
  });

  ipcMain.handle('dialog:saveFile', async (_event, opts = {}) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: opts.title || 'Save File',
      defaultPath: opts.defaultPath,
      filters: opts.filters || []
    });
    return { canceled, filePath };
  });

  ipcMain.handle('fs:writeFile', async (_event, filePath, buffer) => {
    try {
      const nodeBuf = Buffer.from(buffer);
      await fs.writeFile(filePath, nodeBuf);
      return true;
    } catch (err) {
      console.error('fs:writeFile error:', err);
      throw err;
    }
  });

  ipcMain.on('window:setTitle', (_event, title) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(title ? `${title} - support-fins` : 'support-fins');
    }
  });
}

module.exports = { registerIpcHandlers };
```

- [ ] **Step 4: Create `electron/menu.cjs` for native OS application menus**

Create `electron/menu.cjs`:
```javascript
const { Menu, shell } = require('electron');

function buildApplicationMenu(mainWindow) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Model...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (mainWindow) mainWindow.webContents.send('menu:openFile');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'FIN-SPEC Specification',
          click: async () => {
            await shell.openExternal('https://github.com/Mr-Molina/support-fins/blob/main/docs/FIN-SPEC.md');
          }
        },
        {
          label: 'GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/Mr-Molina/support-fins');
          }
        },
        { type: 'separator' },
        {
          label: 'About support-fins',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              title: 'About support-fins',
              message: 'support-fins v1.0.0',
              detail: 'FDM support fin generator for thin walls and tall prints.\nStandalone cross-platform desktop application.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { buildApplicationMenu };
```

- [ ] **Step 5: Create `electron/main.cjs` with privileged `app://` protocol and window management**

Create `electron/main.cjs`:
```javascript
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
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const targetFile = findCadFileInArgv(commandLine);
    if (targetFile && mainWindow) {
      sendOpenFile(mainWindow, targetFile);
    }
  });
}

function findCadFileInArgv(argv) {
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg === 'string' && /\.(stl|3mf|step|stp)$/i.test(arg)) {
      if (fs.existsSync(arg)) return arg;
    }
  }
  return null;
}

async function sendOpenFile(win, filePath) {
  try {
    const data = await fs.promises.readFile(filePath);
    win.webContents.send('app:openFile', {
      name: path.basename(filePath),
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    });
  } catch (err) {
    console.error('Failed to read file for open:', err);
  }
}

function setupProtocolHandler() {
  const webRoot = path.join(__dirname, '..', 'web');

  protocol.handle('app', async (request) => {
    const parsed = new URL(request.url);
    let pathname = decodeURIComponent(parsed.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';

    const safePath = path.normalize(path.join(webRoot, pathname));
    if (!safePath.startsWith(webRoot)) {
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
          'Content-Security-Policy': "default-src 'self' app:; script-src 'self' 'wasm-unsafe-eval' app:; style-src 'self' 'unsafe-inline' app:; img-src 'self' data: blob: app:; worker-src 'self' blob: app:; object-src 'none';"
        }
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'support-fins',
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
```

- [ ] **Step 6: Write unit test validating IPC handler logic**

Create `tests/electron_ipc.test.js`:
```javascript
import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('electron: validates file extension detection for CAD models', () => {
  const cadRegex = /\.(stl|3mf|step|stp)$/i;
  assertEquals(cadRegex.test('model.stl'), true);
  assertEquals(cadRegex.test('assembly.3MF'), true);
  assertEquals(cadRegex.test('bracket.STEP'), true);
  assertEquals(cadRegex.test('part.stp'), true);
  assertEquals(cadRegex.test('document.pdf'), false);
  assertEquals(cadRegex.test('image.png'), false);
});
```

- [ ] **Step 7: Run test to verify it passes**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/electron_ipc.test.js
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add package.json electron/ tests/electron_ipc.test.js
git commit -m "feat(desktop): implement Electron main process, secure IPC bridge, and custom app protocol"
```

---

### Task 4: Application Assets, Iconography & Desktop Metadata (`assets/`)

**Files:**
- Create: `assets/icons/icon.svg`
- Create: `assets/icons/icon.png`
- Create: `assets/icons/icon.ico`
- Create: `assets/support-fins.desktop`
- Test: `tests/assets.test.js`

**Interfaces:**
- Consumes: SVG vector artwork
- Produces: Multi-resolution Windows ICO and Linux PNG/Desktop launchers for installer bundling.

- [ ] **Step 1: Create `assets/icons/icon.svg`**

Create `assets/icons/icon.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="finGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00d2ff"/>
      <stop offset="100%" stop-color="#3a7bd5"/>
    </linearGradient>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2c3e50"/>
      <stop offset="100%" stop-color="#1a252f"/>
    </linearGradient>
  </defs>
  <!-- Background Plate -->
  <rect x="32" y="32" width="448" height="448" rx="96" fill="url(#bodyGrad)" stroke="#3a7bd5" stroke-width="8"/>
  <!-- Build Bed Baseline -->
  <path d="M 96 416 L 416 416" stroke="#4a6572" stroke-width="12" stroke-linecap="round"/>
  <!-- Central Tall Thin Column (Part) -->
  <rect x="232" y="96" width="48" height="320" rx="8" fill="#ecf0f1"/>
  <!-- Left Buttress Fin -->
  <path d="M 128 416 L 232 200 L 232 416 Z" fill="url(#finGrad)" opacity="0.9"/>
  <!-- Right Buttress Fin -->
  <path d="M 384 416 L 280 200 L 280 416 Z" fill="url(#finGrad)" opacity="0.9"/>
  <!-- Horizontal Tines -->
  <line x1="200" y1="260" x2="232" y2="260" stroke="#00d2ff" stroke-width="6"/>
  <line x1="200" y1="310" x2="232" y2="310" stroke="#00d2ff" stroke-width="6"/>
  <line x1="280" y1="260" x2="312" y2="260" stroke="#00d2ff" stroke-width="6"/>
  <line x1="280" y1="310" x2="312" y2="310" stroke="#00d2ff" stroke-width="6"/>
</svg>
```

- [ ] **Step 2: Generate PNG and ICO assets using Python script**

Run a one-line utility to convert SVG or generate clean PNG / ICO:
Create `assets/icons/make_icons.py`:
```python
import os
from PIL import Image, ImageDraw

def generate_icons():
    os.makedirs('assets/icons', exist_ok=True)
    size = (512, 512)
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Base rounded plate
    draw.rounded_rectangle([32, 32, 480, 480], radius=96, fill=(26, 37, 47, 255), outline=(58, 123, 213, 255), width=8)
    # Bed
    draw.line([96, 416, 416, 416], fill=(74, 101, 114, 255), width=12)
    # Part column
    draw.rounded_rectangle([232, 96, 280, 416], radius=8, fill=(236, 240, 241, 255))
    # Left fin
    draw.polygon([(128, 416), (232, 200), (232, 416)], fill=(0, 210, 255, 230))
    # Right fin
    draw.polygon([(384, 416), (280, 200), (280, 416)], fill=(58, 123, 213, 230))

    img.save('assets/icons/icon.png', 'PNG')
    img.save('assets/icons/icon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print('Icons generated successfully in assets/icons/')

if __name__ == '__main__':
    generate_icons()
```
Run: `python assets/icons/make_icons.py`

- [ ] **Step 3: Create `assets/support-fins.desktop`**

Create `assets/support-fins.desktop`:
```ini
[Desktop Entry]
Name=support-fins
Comment=FDM support fin generator for thin walls and tall 3D prints
Exec=support-fins %U
Icon=support-fins
Type=Application
StartupNotify=true
Categories=Graphics;3DGraphics;Engineering;
MimeType=model/stl;model/3mf;model/step;application/sla;
```

- [ ] **Step 4: Create asset validation test**

Create `tests/assets.test.js`:
```javascript
import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('assets: desktop file specifies standard categories and MIME types', () => {
  const content = Deno.readTextFileSync('assets/support-fins.desktop');
  assertEquals(content.includes('Categories=Graphics;3DGraphics;Engineering;'), true);
  assertEquals(content.includes('MimeType=model/stl;model/3mf;model/step;application/sla;'), true);
  assertEquals(content.includes('Type=Application'), true);
});
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/assets.test.js
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add assets/ tests/assets.test.js
git commit -m "feat(assets): add vector artwork, Windows ICO, and Linux desktop entries"
```

---

### Task 5: Packaging & Installer Configuration with `electron-builder`

**Files:**
- Create: `electron-builder.json`
- Modify: `package.json`
- Test: `tests/builder_config.test.js`

**Interfaces:**
- Consumes: `electron-builder`, `web/`, `electron/`, `assets/icons/`
- Produces: Windows `.exe` installer (NSIS), portable `.exe`, Linux `.AppImage`, and `.deb`.

- [ ] **Step 1: Write the failing test**

Create `tests/builder_config.test.js`:
```javascript
import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('electron-builder: config defines Windows and Linux targets with file associations', () => {
  const config = JSON.parse(Deno.readTextFileSync('electron-builder.json'));
  assertEquals(config.appId, 'com.printfins.support-fins');
  assertEquals(config.productName, 'support-fins');
  assertEquals(config.win.target.includes('nsis'), true);
  assertEquals(config.linux.target.includes('AppImage'), true);
  assertEquals(config.linux.target.includes('deb'), true);

  const exts = config.fileAssociations.flatMap(fa => fa.ext);
  assertEquals(exts.includes('stl'), true);
  assertEquals(exts.includes('3mf'), true);
  assertEquals(exts.includes('step'), true);
  assertEquals(exts.includes('stp'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/builder_config.test.js
```
Expected: FAIL ("No such file or directory: electron-builder.json")

- [ ] **Step 3: Create `electron-builder.json`**

Create `electron-builder.json`:
```json
{
  "appId": "com.printfins.support-fins",
  "productName": "support-fins",
  "copyright": "Copyright © 2026 Mr-Molina",
  "directories": {
    "output": "dist"
  },
  "files": [
    "electron/**/*",
    "web/**/*",
    "package.json"
  ],
  "fileAssociations": [
    {
      "ext": ["stl"],
      "name": "STLAsciiBinaryMesh",
      "description": "Stereolithography 3D Mesh",
      "mimeType": "application/sla",
      "role": "Viewer"
    },
    {
      "ext": ["3mf"],
      "name": "3DManufacturingFormat",
      "description": "3MF 3D Model Package",
      "mimeType": "model/3mf",
      "role": "Viewer"
    },
    {
      "ext": ["step", "stp"],
      "name": "STEPExchangeFormat",
      "description": "STEP CAD Geometry",
      "mimeType": "model/step",
      "role": "Viewer"
    }
  ],
  "win": {
    "target": ["nsis", "portable"],
    "icon": "assets/icons/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "support-fins"
  },
  "linux": {
    "target": ["AppImage", "deb"],
    "icon": "assets/icons/icon.png",
    "category": "Graphics",
    "desktop": "assets/support-fins.desktop"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/builder_config.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron-builder.json tests/builder_config.test.js
git commit -m "feat(packaging): configure electron-builder for Windows NSIS and Linux AppImage/deb"
```

---

### Task 6: Cross-Platform Automated CI/CD Release Workflow (`.github/workflows/desktop-release.yml`)

**Files:**
- Create: `.github/workflows/desktop-release.yml`
- Test: `tests/ci_workflow.test.js`

**Interfaces:**
- Consumes: GitHub Actions runner (`windows-latest`, `ubuntu-latest`), `npm run desktop:dist`
- Produces: Signed/hashed `.exe`, `.msi`, `.AppImage`, and `.deb` releases attached to GitHub releases.

- [ ] **Step 1: Write the failing test**

Create `tests/ci_workflow.test.js`:
```javascript
import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('ci: desktop release workflow has proper permissions and cross-platform matrix', () => {
  const content = Deno.readTextFileSync('.github/workflows/desktop-release.yml');
  assertEquals(content.includes('permissions:'), true);
  assertEquals(content.includes('contents: write'), true);
  assertEquals(content.includes('windows-latest'), true);
  assertEquals(content.includes('ubuntu-latest'), true);
  assertEquals(content.includes('electron-builder'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/ci_workflow.test.js
```
Expected: FAIL ("No such file or directory: .github/workflows/desktop-release.yml")

- [ ] **Step 3: Create `.github/workflows/desktop-release.yml`**

Create `.github/workflows/desktop-release.yml`:
```yaml
name: Desktop Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-desktop:
    name: Build Desktop App (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, ubuntu-latest]

    steps:
      - name: Checkout Repository
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - name: Setup Node.js
        uses: actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a # v4.2.0
        with:
          node-version: 22

      - name: Install Dependencies
        run: npm ci

      - name: Build Windows Packages
        if: matrix.os == 'windows-latest'
        run: npm run desktop:dist:win

      - name: Build Linux Packages
        if: matrix.os == 'ubuntu-latest'
        run: npm run desktop:dist:linux

      - name: Upload Build Artifacts
        uses: actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb99ba8edd # v4.6.1
        with:
          name: support-fins-${{ matrix.os }}
          path: |
            dist/*.exe
            dist/*.AppImage
            dist/*.deb

  release:
    name: Publish GitHub Release
    needs: build-desktop
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')

    steps:
      - name: Download Artifacts
        uses: actions/download-artifact@cc203385981b70ca67e1cc392babf9cc229d5806 # v4.1.9
        with:
          path: release-artifacts
          merge-multiple: true

      - name: Create Release
        uses: softprops/action-gh-release@c95fe1489396fe8a9eb87238600c92e21ed9d36d # v2.2.1
        with:
          files: |
            release-artifacts/*.exe
            release-artifacts/*.AppImage
            release-artifacts/*.deb
          draft: false
          prerelease: false
          generate_release_notes: true
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/ci_workflow.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/desktop-release.yml tests/ci_workflow.test.js
git commit -m "ci: add automated cross-platform desktop build and release workflow"
```

---

### Task 7: End-to-End Verification & Verification Gate

**Files:**
- Create: `tests/desktop_e2e_smoke.js`
- Test: All suites (`deno test --allow-read tests/`, `pytest plugins/orca/tests/`)

**Interfaces:**
- Consumes: Full codebase, `web/` assets, `electron/` configurations
- Produces: Definitive green test verification proving dual-mode browser and desktop operational readiness.

- [ ] **Step 1: Create `tests/desktop_e2e_smoke.js`**

Create `tests/desktop_e2e_smoke.js`:
```javascript
import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('desktop smoke: verify all required assets exist for Electron package', () => {
  // 1. Core web index
  const indexHtml = Deno.readTextFileSync('web/index.html');
  assertEquals(indexHtml.includes('app.js'), true);

  // 2. OpenCASCADE WebAssembly binary
  const wasmStat = Deno.statSync('web/vendor/occt-import-js-0.0.23/occt-import-js.wasm');
  assertEquals(wasmStat.isFile, true);
  assertEquals(wasmStat.size > 7_000_000, true);

  // 3. Web workers
  const finWorker = Deno.statSync('web/finworker.js');
  assertEquals(finWorker.isFile, true);
  const stepWorker = Deno.statSync('web/stepworker.js');
  assertEquals(stepWorker.isFile, true);

  // 4. Electron main & preload
  const mainStat = Deno.statSync('electron/main.cjs');
  assertEquals(mainStat.isFile, true);
  const preloadStat = Deno.statSync('electron/preload.cjs');
  assertEquals(preloadStat.isFile, true);

  // 5. Assets & Icons
  const icoStat = Deno.statSync('assets/icons/icon.ico');
  assertEquals(icoStat.isFile, true);
});
```

- [ ] **Step 2: Run all Deno tests**

Run:
```powershell
$env:PATH = "C:\Users\jmolina\.deno\bin;$env:PATH"; deno test --allow-read tests/
```
Expected: 190+ passed, 0 failed.

- [ ] **Step 3: Run all Python/Orca tests**

Run:
```powershell
python -m pytest plugins/orca/tests/
```
Expected: 18 passed, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add tests/desktop_e2e_smoke.js
git commit -m "test: add desktop packaging e2e smoke verification"
```
