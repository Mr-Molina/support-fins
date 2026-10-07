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

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  onFileOpen: (callback) => {
    const handler = (_event, file) => callback(file);
    ipcRenderer.on('app:openFile', handler);
    return () => ipcRenderer.removeListener('app:openFile', handler);
  }
});
