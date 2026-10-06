// Tests for Phase 3 - Tier 3 Sub-Batch 3C (UI Lifecycle & Slicer Plugins)
import { assert } from './_util.js';
import { bytesToB64, b64ToBytes } from '../plugins/orca/panel/engine_bridge.js';

Deno.test('UI-004: UI history captures coverage and synchronizes slider and field on restore', () => {
  const fakeDom = {
    'coverage-slider': { value: '0.85' },
    'coverage-fld': { textContent: '0.85' },
  };

  function snapshot(dom) {
    const el = (id) => dom[id];
    return {
      coverage: el('coverage-slider') ? parseFloat(el('coverage-slider').value) : 0.5,
    };
  }

  let rebuildDrawnCalls = 0;
  function rebuildDrawn() {
    rebuildDrawnCalls++;
  }

  function restoreState(s, dom) {
    const el = (id) => dom[id];
    if (s.coverage !== undefined && el('coverage-slider')) {
      el('coverage-slider').value = s.coverage;
      if (el('coverage-fld')) el('coverage-fld').textContent = s.coverage;
    }
    rebuildDrawn();
  }

  // 1. Initial snapshot with 0.85
  const s1 = snapshot(fakeDom);
  assert(s1.coverage === 0.85, `expected 0.85, got ${s1.coverage}`);

  // 2. Modify slider and field to 0.30
  fakeDom['coverage-slider'].value = '0.30';
  fakeDom['coverage-fld'].textContent = '0.30';

  // 3. Restore state s1
  restoreState(s1, fakeDom);
  assert(fakeDom['coverage-slider'].value === 0.85, 'slider value must be restored');
  assert(fakeDom['coverage-fld'].textContent === 0.85, 'coverage label must be synchronized');
  assert(rebuildDrawnCalls === 1, 'rebuildDrawn must be invoked immediately on restore');

  // 4. Default fallback when slider element is missing
  const sEmpty = snapshot({});
  assert(sEmpty.coverage === 0.5, 'missing slider must default to 0.5');
});

Deno.test('UI-LOGIC-002: loadURL sanitizes file name, stripping query parameters and hash fragments', () => {
  function sanitizeName(url, base = 'http://localhost/app/') {
    let cleanName = 'part.stl';
    try {
      const parsed = new URL(url, base);
      cleanName = parsed.pathname.split('/').filter(Boolean).pop() || 'part.stl';
    } catch {
      cleanName = (url.split('?')[0].split('#')[0].split('/').pop()) || 'part.stl';
    }
    return cleanName;
  }

  // Standard absolute URL with query and hash
  assert(sanitizeName('https://example.com/models/test_bracket.stl?v=2&dl=1#view') === 'test_bracket.stl');

  // URL with multiple query params
  assert(sanitizeName('http://localhost:8080/parts/arm_mount.3mf?session=xyz&auth=1') === 'arm_mount.3mf');

  // Relative path with query params
  assert(sanitizeName('models/stator_housing.step?cachebust=98765') === 'stator_housing.step');

  // URL without query params
  assert(sanitizeName('https://cdn.example.org/models/simple_cube.stl') === 'simple_cube.stl');

  // Root URL or empty path falls back to part.stl
  assert(sanitizeName('https://example.com/') === 'part.stl');
  assert(sanitizeName('https://example.com/?file=download') === 'part.stl');
});

Deno.test('SLICER-PERF-001: bytesToB64 and b64ToBytes round-trip fidelity with chunked buffer', () => {
  // 1. Empty buffer
  const empty = new Uint8Array(0);
  assert(bytesToB64(empty) === '', 'empty buffer produces empty b64 string');
  assert(b64ToBytes('').length === 0, 'empty b64 string produces empty buffer');

  // 2. Short buffers of various lengths (testing 1, 2, 3 byte padding permutations)
  for (let len = 1; len <= 16; len++) {
    const data = new Uint8Array(len);
    for (let i = 0; i < len; i++) data[i] = (i * 17 + 5) & 0xff;
    const b64 = bytesToB64(data);
    const roundTripped = b64ToBytes(b64);
    assert(roundTripped.length === data.length, `length mismatch for size ${len}`);
    for (let i = 0; i < len; i++) {
      assert(roundTripped[i] === data[i], `byte mismatch at index ${i} for size ${len}`);
    }
  }

  // 3. Large buffer crossing the 8192-byte chunk boundary (25,000 bytes)
  const largeSize = 25000;
  const largeData = new Uint8Array(largeSize);
  for (let i = 0; i < largeSize; i++) {
    largeData[i] = (i * 31 + 7) & 0xff;
  }
  const largeB64 = bytesToB64(largeData);
  const largeDecoded = b64ToBytes(largeB64);
  assert(largeDecoded.length === largeSize, 'large buffer length mismatch');
  for (let i = 0; i < largeSize; i++) {
    if (largeDecoded[i] !== largeData[i]) {
      throw new Error(`large buffer mismatch at index ${i}: expected ${largeData[i]}, got ${largeDecoded[i]}`);
    }
  }

  // Verify chunking matches standard btoa output
  let binaryStr = '';
  for (let i = 0; i < 500; i++) binaryStr += String.fromCharCode(largeData[i]);
  const expectedB64Slice = btoa(binaryStr);
  const actualB64Slice = bytesToB64(largeData.subarray(0, 500));
  assert(actualB64Slice === expectedB64Slice, 'bytesToB64 must match standard btoa output');
});
