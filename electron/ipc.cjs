const { ipcMain, dialog, BrowserWindow, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');

let handlersRegistered = false;

function registerIpcHandlers(mainWindow) {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle('dialog:openFile', async (_event, opts = {}) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;

    let title = 'Open 3D Model';
    if (typeof opts.title === 'string') title = opts.title;

    let filters = [];
    if (Array.isArray(opts.filters)) {
      filters = opts.filters.filter(f => 
        typeof f === 'object' && f !== null && typeof f.name === 'string' && 
        Array.isArray(f.extensions) && f.extensions.every(ext => typeof ext === 'string')
      );
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title,
      filters,
      properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) return { canceled: true };
    const filePath = filePaths[0];

    const stat = await fs.stat(filePath);
    if (stat.size > 100 * 1024 * 1024) throw new Error('File exceeds maximum allowed size of 100MB');

    const data = await fs.readFile(filePath);
    return {
      canceled: false,
      file: {
        name: path.basename(filePath),
        data
      }
    };
  });

  ipcMain.handle('dialog:saveFile', async (_event, opts = {}) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;

    let title = 'Save File';
    if (typeof opts.title === 'string') title = opts.title;

    let filters = [];
    if (Array.isArray(opts.filters)) {
      filters = opts.filters.filter(f => 
        typeof f === 'object' && f !== null && typeof f.name === 'string' && 
        Array.isArray(f.extensions) && f.extensions.every(ext => typeof ext === 'string')
      );
    }

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title,
      defaultPath: typeof opts.defaultPath === 'string' ? opts.defaultPath : undefined,
      filters
    });
    return { canceled, filePath };
  });

  ipcMain.handle('fs:writeFile', async (_event, filePath, buffer) => {
    try {
      if (typeof filePath !== 'string') throw new Error('Invalid filePath: must be a string');
      if (filePath.includes('..')) throw new Error('Invalid filePath: path traversal detected');
      const normalizedPath = path.normalize(filePath);
      
      const nodeBuf = Buffer.from(buffer);
      if (nodeBuf.length > 100 * 1024 * 1024) throw new Error('Buffer exceeds maximum allowed size of 100MB');
      
      await fs.writeFile(normalizedPath, nodeBuf);
      return true;
    } catch (err) {
      console.error('fs:writeFile error:', err);
      throw err;
    }
  });

  ipcMain.on('window:setTitle', (_event, title) => {
    if (typeof title !== 'string') return;
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (win && !win.isDestroyed()) {
      win.setTitle(title ? `${title} - support-fins` : 'support-fins');
    }
  });

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
        await shell.openExternal(url);
        return true;
      }
    } catch (err) {
      console.error('shell:openExternal error:', err);
    }
    return false;
  });
}

module.exports = { registerIpcHandlers };

