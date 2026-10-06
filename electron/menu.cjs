const { Menu, shell, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');

function buildApplicationMenu(mainWindow) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Model...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Open 3D Model',
              filters: [
                { name: '3D Models (*.stl, *.3mf, *.step, *.stp)', extensions: ['stl', '3mf', 'step', 'stp'] },
                { name: 'All Files (*.*)', extensions: ['*'] }
              ],
              properties: ['openFile']
            });
            if (canceled || filePaths.length === 0) return;
            const filePath = filePaths[0];
            try {
              const data = await fs.readFile(filePath);
              mainWindow.webContents.send('app:openFile', {
                name: path.basename(filePath),
                data
              });
            } catch (err) {
              console.error('Menu open model failed:', err);
            }
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
