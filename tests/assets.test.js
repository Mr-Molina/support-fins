import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('assets: desktop file specifies standard categories and MIME types', () => {
  const content = Deno.readTextFileSync('assets/support-fins.desktop');
  assertEquals(content.includes('Categories=Graphics;3DGraphics;Engineering;'), true);
  assertEquals(content.includes('MimeType=model/stl;model/3mf;model/step;application/sla;'), true);
  assertEquals(content.includes('Type=Application'), true);
});

Deno.test('assets: icons exist for desktop packaging', () => {
  const svg = Deno.statSync('assets/icons/icon.svg');
  assertEquals(svg.isFile, true);
  const png = Deno.statSync('assets/icons/icon.png');
  assertEquals(png.isFile, true);
  const ico = Deno.statSync('assets/icons/icon.ico');
  assertEquals(ico.isFile, true);
});
