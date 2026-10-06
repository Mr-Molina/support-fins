import { assertEquals } from 'jsr:@std/assert@1';

Deno.test('ci: desktop release workflow has proper permissions and cross-platform matrix', () => {
  const content = Deno.readTextFileSync('.github/workflows/desktop-release.yml');
  assertEquals(content.includes('permissions:'), true);
  assertEquals(content.includes('contents: write'), true);
  assertEquals(content.includes('windows-latest'), true);
  assertEquals(content.includes('ubuntu-latest'), true);
  assertEquals(content.includes('electron-builder'), true);
});
