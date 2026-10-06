import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('electron-builder: config defines Windows and Linux targets with file associations', () => {
  const config = JSON.parse(Deno.readTextFileSync('electron-builder.json'));
  assertEquals(config.appId, 'com.printfins.support-fins');
  assertEquals(config.productName, 'support-fins');
  assertEquals(config.win.target.includes('nsis'), true);
  assertEquals(config.linux.target.includes('AppImage'), true);
  assertEquals(config.linux.target.includes('deb'), true);

  const exts = config.fileAssociations.flatMap(fa => fa.ext);
  assertEquals(exts.includes('stl'), true);
  assertEquals(exts.includes('3mf'), true);
  assertEquals(exts.includes('step'), true);
  assertEquals(exts.includes('stp'), true);
});
