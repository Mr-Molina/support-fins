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
