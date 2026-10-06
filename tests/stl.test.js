// Binary STL exporter test suite (QA-COV-001).
// Pins binary STL export fidelity, exact byte length calculations,
// header title formatting with 79-character cap, and readSTL round-trip accuracy.

import { writeBinarySTL } from '../web/stl.js';
import { readSTL, assert, assertClose, block } from './_util.js';

const toTriples = (flat) => {
  const tris = [];
  for (let i = 0; i < flat.length; i += 3) {
    tris.push([flat[i], flat[i + 1], flat[i + 2]]);
  }
  return tris;
};

Deno.test('writeBinarySTL: round-trip fidelity and exact byte length on known block', async () => {
  const b = block(0, 10, 0, 20, 0, 30);
  const tris = toTriples(b);
  const blob = writeBinarySTL(tris, 'TestBlock');

  // Assert byte length is exact: 84 + (tris.length / 3) * 50
  const expectedBytes = 84 + (tris.length / 3) * 50;
  assert(blob.size === expectedBytes, `expected ${expectedBytes} bytes, got ${blob.size}`);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert(bytes.byteLength === expectedBytes, `arrayBuffer length mismatch`);

  // Read back via readSTL and assert coordinate equality within floating tolerance
  const readBack = readSTL(bytes);
  assert(readBack.length === b.length, `coordinate count mismatch: ${readBack.length} vs ${b.length}`);
  for (let i = 0; i < b.length; i++) {
    assertClose(readBack[i], b[i], 1e-5, `mismatch at coordinate ${i}`);
  }
});

Deno.test('writeBinarySTL: header title formatting and 79-character truncation cap', async () => {
  const tris = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0]
  ];

  // Standard header formatting
  const blobStandard = writeBinarySTL(tris, 'MyModel');
  const bytesStandard = new Uint8Array(await blobStandard.arrayBuffer());
  const headerText = new TextDecoder().decode(bytesStandard.subarray(0, 80));
  assert(headerText.startsWith('MyModel - support-fins'), 'header should contain formatted title');

  // Default name formatting
  const blobDefault = writeBinarySTL(tris);
  const bytesDefault = new Uint8Array(await blobDefault.arrayBuffer());
  const defaultHeaderText = new TextDecoder().decode(bytesDefault.subarray(0, 80));
  assert(defaultHeaderText.startsWith('Support Fins - support-fins'), 'default header should format correctly');

  // Long name truncation (79-character cap)
  const longName = 'A'.repeat(100);
  const blobLong = writeBinarySTL(tris, longName);
  const bytesLong = new Uint8Array(await blobLong.arrayBuffer());
  const expectedCapped = `${longName} - support-fins`.slice(0, 79);
  const actualHeader79 = new TextDecoder().decode(bytesLong.subarray(0, 79));
  assert(actualHeader79 === expectedCapped, 'header must be capped at 79 chars');
  assert(bytesLong[79] === 0, '80th byte of header must remain 0 delimiter');
});

Deno.test('writeBinarySTL: empty triangle array produces 84-byte header-only STL', async () => {
  const blob = writeBinarySTL([]);
  assert(blob.size === 84, `expected 84 bytes for empty STL, got ${blob.size}`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const readBack = readSTL(bytes);
  assert(readBack.length === 0, 'empty STL should read back 0 vertices');
});
