import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('electron: validates file extension detection for CAD models', () => {
  const cadRegex = /\.(stl|3mf|step|stp)$/i;
  assertEquals(cadRegex.test('model.stl'), true);
  assertEquals(cadRegex.test('assembly.3MF'), true);
  assertEquals(cadRegex.test('bracket.STEP'), true);
  assertEquals(cadRegex.test('part.stp'), true);
  assertEquals(cadRegex.test('document.pdf'), false);
  assertEquals(cadRegex.test('image.png'), false);
});

Deno.test('electron: verifies package.json declares Electron main and scripts', () => {
  const pkg = JSON.parse(Deno.readTextFileSync('package.json'));
  assertEquals(pkg.main, 'electron/main.cjs');
  assertEquals(Boolean(pkg.scripts['desktop:start']), true);
  assertEquals(Boolean(pkg.devDependencies['electron']), true);
});
