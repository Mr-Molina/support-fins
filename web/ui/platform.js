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
    try {
      return await window.desktopAPI.writeFile(res.filePath, buf);
    } catch (err) {
      console.error('Failed to write file to disk:', err);
      if (typeof alert !== 'undefined') {
        alert(`Failed to save ${filename}:\n${err?.message || err}`);
      }
      return false;
    }
  }

  // Browser fallback: Blob download
  if (typeof document !== 'undefined') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body?.appendChild(a);
    a.click();
    document.body?.removeChild(a);
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

/**
 * Open an external web link in the system default browser.
 * On desktop: requests the native OS to launch the system default browser via shell.openExternal.
 * On browser: opens a new tab via window.open(url, '_blank', 'noopener,noreferrer').
 *
 * @param {string} url
 */
export function openExternal(url) {
  if (isDesktop() && window.desktopAPI?.openExternal) {
    window.desktopAPI.openExternal(url);
    return;
  }
  if (typeof window !== 'undefined' && window.open) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// Intercept DOM link clicks: ensures any <a> clicks to http/https/mailto trigger the external browser
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a');
    if (!a || !a.href) return;
    try {
      const url = new URL(a.href, window.location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
        if (isDesktop()) {
          e.preventDefault();
          openExternal(a.href);
        }
      }
    } catch (_) {}
  }, true);
}

