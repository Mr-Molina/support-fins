const { ipcMain, dialog, BrowserWindow, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');

let handlersRegistered = false;

function registerIpcHandlers(mainWindow) {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle('dialog:openFile', async (_event, opts = {}) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
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
        data
      }
    };
  });

  ipcMain.handle('dialog:saveFile', async (_event, opts = {}) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
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

