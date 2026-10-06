import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('desktop smoke: verify all required assets exist for Electron package', () => {
  // 1. Core web index
  const indexHtml = Deno.readTextFileSync('web/index.html');
  assertEquals(indexHtml.includes('app.js'), true);

  // 2. OpenCASCADE WebAssembly binary
  const wasmStat = Deno.statSync('web/vendor/occt-import-js-0.0.23/occt-import-js.wasm');
  assertEquals(wasmStat.isFile, true);
  assertEquals(wasmStat.size > 7_000_000, true);

  // 3. Web workers
  const finWorker = Deno.statSync('web/finworker.js');
  assertEquals(finWorker.isFile, true);
  const stepWorker = Deno.statSync('web/stepworker.js');
  assertEquals(stepWorker.isFile, true);

  // 4. Electron main & preload
  const mainStat = Deno.statSync('electron/main.cjs');
  assertEquals(mainStat.isFile, true);
  const preloadStat = Deno.statSync('electron/preload.cjs');
  assertEquals(preloadStat.isFile, true);

  // 5. Assets & Icons
  const icoStat = Deno.statSync('assets/icons/icon.ico');
  assertEquals(icoStat.isFile, true);
});
