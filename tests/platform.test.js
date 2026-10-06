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
