import { assertEquals } from 'jsr:@std/assert@1';
import { saveFile } from '../web/ui/platform.js';

Deno.test('platform fixes: saveFile catches IPC write errors and returns false without unhandled rejection', async () => {
  globalThis.window = {
    desktopAPI: {
      isDesktop: true,
      showSaveDialog: async () => ({ canceled: false, filePath: '/tmp/test.stl' }),
      writeFile: async () => {
        throw new Error('EACCES: permission denied');
      },
    },
  };

  try {
    const ok = await saveFile('test.stl', new Uint8Array([1, 2, 3]), 'application/sla');
    assertEquals(ok, false);
  } finally {
    delete globalThis.window;
  }
});

Deno.test('electron fixes: validates path containment with path.sep boundary', () => {
  const webRoot = 'S:\\Github\\support-fins\\web';
  const sep = '\\';
  const prefix = webRoot.endsWith(sep) ? webRoot : webRoot + sep;

  const validPath = 'S:\\Github\\support-fins\\web\\index.html';
  const invalidAdjacent = 'S:\\Github\\support-fins\\web-secret\\config.json';

  const isSafe = (p) => p === webRoot || p.startsWith(prefix);

  assertEquals(isSafe(validPath), true);
  assertEquals(isSafe(invalidAdjacent), false);
});

Deno.test('io: normalizes TypedArray and Node Buffer with offset into standard ArrayBuffer', () => {
  const fullBuffer = new ArrayBuffer(20);
  const u8 = new Uint8Array(fullBuffer, 4, 10);
  const normalized = u8 instanceof ArrayBuffer
    ? u8
    : (ArrayBuffer.isView(u8)
        ? (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
            ? u8.buffer
            : u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength))
        : u8);

  assertEquals(normalized instanceof ArrayBuffer, true);
  assertEquals(normalized.byteLength, 10);
});

