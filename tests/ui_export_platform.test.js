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
