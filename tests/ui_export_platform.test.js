import { assertEquals } from 'jsr:@std/assert@1';
import { isDesktop, saveFile, openExternal } from '../web/ui/platform.js';
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

Deno.test('ui/platform: openExternal delegates to desktopAPI on desktop', () => {
  let openedUrl = null;
  globalThis.window = {
    desktopAPI: {
      isDesktop: true,
      openExternal: (u) => { openedUrl = u; },
    },
  };

  try {
    openExternal('https://github.com/Mr-Molina/support-fins');
    assertEquals(openedUrl, 'https://github.com/Mr-Molina/support-fins');
  } finally {
    delete globalThis.window;
  }
});

Deno.test('ui/platform: openExternal falls back to window.open on browser', () => {
  let openedUrl = null;
  let openedTarget = null;
  let openedFeatures = null;

  globalThis.window = {
    open: (u, t, f) => {
      openedUrl = u;
      openedTarget = t;
      openedFeatures = f;
    },
  };

  try {
    openExternal('https://ko-fi.com/matthewtrahan');
    assertEquals(openedUrl, 'https://ko-fi.com/matthewtrahan');
    assertEquals(openedTarget, '_blank');
    assertEquals(openedFeatures, 'noopener,noreferrer');
  } finally {
    delete globalThis.window;
  }
});

