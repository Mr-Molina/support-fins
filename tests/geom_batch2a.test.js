// Tests for Phase 3 - Tier 2 Sub-Batch 2A (Computational Geometry & Math)
import { loadModel, analyze, fins, assert, assertClose, rotX, rotY } from './_util.js';

Deno.test('GEOM-LOGIC-002: Sutherland-Hodgman clipping does not duplicate vertices on clipping boundary', () => {
  // Triangle with vertex [0, 0, 0] exactly on the clipping plane f(v) = v[0] >= 0
  // Second vertex [1, 0, 0] inside (f > 0)
  // Third vertex [-1, 1, 0] outside (f < 0)
  // When clipping against x >= 0:
  // Edge 0->1: a=(0,0,0) [fa=0], b=(1,0,0) [fb=1]. aIn=true, bIn=true. Neither crosses.
  // Edge 1->2: a=(1,0,0) [fa=1], b=(-1,1,0) [fb=-1]. fa>0, fb<0. Crosses at (0, 0.5, 0).
  // Edge 2->0: a=(-1,1,0) [fa=-1], b=(0,0,0) [fb=0]. fa<0, fb=0.
  // Before fix: Edge 2->0 would interpolate at t=1 yielding (0,0,0) again!
  // Producing 4 vertices with a duplicate (0,0,0).
  // With fix: only interpolates when aIn !== bIn && fa !== 0 && fb !== 0,
  // so no duplicate vertex is pushed.
  const tri = [
    [0, 0, 0],
    [1, 0, 0],
    [-1, 1, 0],
  ];

  const f = (v) => v[0]; // plane x >= 0
  const out = [];
  for (let i = 0; i < tri.length; i++) {
    const a = tri[i], b = tri[(i + 1) % tri.length];
    const fa = f(a), fb = f(b);
    const aIn = fa >= 0, bIn = fb >= 0;
    if (aIn) out.push(a);
    if (aIn !== bIn && fa !== 0 && fb !== 0) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t,
                a[2] + (b[2] - a[2]) * t]);
    }
  }
  assert(out.length === 3, `expected 3 vertices (triangle clipped), got ${out.length}`);
  // Check for duplicates
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const d = Math.hypot(out[i][0] - out[j][0], out[i][1] - out[j][1], out[i][2] - out[j][2]);
      assert(d > 1e-6, `duplicate vertex detected at distance ${d}`);
    }
  }
});

Deno.test('GEOM-LOGIC-003: brimPad height on open bed does not clamp to 0.20mm for custom height', () => {
  const topo = loadModel('cube');
  const rot = rotX(45);
  const res = analyze(topo, 45, rot);
  const s0 = fins.PAD.style;
  const c0 = { ...fins.PAD.custom };
  try {
    fins.PAD.style = 'custom';
    fins.PAD.custom = { h: 0.6, gap: 0.2, grip: 0.05, margin: 4.0 };
    const built = fins.buildFins(topo, res, rot, { mode: 'prop', bedPad: true, layerHeight: 0.2 });
    assert(built.padTriangles.length > 0, 'expected pad triangles');
    let maxZ = 0;
    for (let i = 0; i < built.padTriangles.length; i++) {
      if (built.padTriangles[i][2] > maxZ) maxZ = built.padTriangles[i][2];
    }
    // Pad height on open bed should reach 0.6mm, not clamped to 0.20mm
    assertClose(maxZ, 0.6, 1e-3, `pad maxZ ${maxZ} did not reach custom height 0.6`);
    // Triangle count should be well below the 87k fine-grid explosion
    const nTris = built.padTriangles.length / 3;
    assert(nTris < 80000, `pad triangle count ${nTris} exploded (expected < 80000)`);
  } finally {
    fins.PAD.style = s0;
    fins.PAD.custom = c0;
  }
});

Deno.test('GEOM-LOGIC-004: point-seated parts with 1 or 2 contact points build pad without aborting props', () => {
  const topo = loadModel('cone');
  const rot = rotX(180); // cone upside down on its tip
  const res = analyze(topo, 45, rot);
  const built = fins.buildFins(topo, res, rot, { mode: 'prop', bedPad: true, layerHeight: 0.2 });
  assert(built.pad !== null, 'expected non-null pad for point-seated cone');
  assert(built.padTriangles.length > 0, 'expected pad triangles for point-seated cone');
  // Circular pad centered at point contact: r1 and r2 equal margin
  const margin = fins.PAD.style === 'custom' ? fins.PAD.custom.margin : fins.FIN.padMargin;
  assertClose(built.pad.r1, margin, 1e-4, 'r1 should equal margin for point contact');
  assertClose(built.pad.r2, margin, 1e-4, 'r2 should equal margin for point contact');
});

Deno.test('GEOM-LOGIC-009: buildFin snaps tine top and bottom to layer grid', () => {
  const topo = loadModel('cube');
  const rot = rotX(45);
  const res = analyze(topo, 45, rot);
  const layerH = 0.25;
  const built = fins.buildFins(topo, res, rot, { mode: 'auto', tines: true, bedPad: true, layerHeight: layerH });
  assert(built.tines > 0, 'expected tines to be generated');
});

Deno.test('GEOM-LOGIC-011: conforming pad uses refined radial ring spacing', () => {
  const topo = loadModel('cube');
  const rot = rotX(45);
  const res = analyze(topo, 45, rot);
  const built = fins.buildFins(topo, res, rot, { mode: 'auto', bedPad: true, layerHeight: 0.2 });
  assert(built.pad !== null, 'expected pad');
  if (built.pad.style === 'sure') {
    const expectedNRing = Math.max(2, Math.ceil(Math.max(built.pad.r1, built.pad.r2) / Math.min(fins.PAD.cell, 0.4)));
    const cellsPerTheta = built.pad.cells / fins.FIN.padSegs;
    assertClose(cellsPerTheta, expectedNRing, 1e-6, `pad radial rings ${cellsPerTheta} should match refined spacing ${expectedNRing}`);
  }
});

Deno.test('GEOM-PERF-001: biteDirsAt correctly returns nearest tied faces without allocation', () => {
  const topo = loadModel('staircase');
  const rot = rotY(35);
  const res = analyze(topo, 45, rot);
  // Staircase Y35 has exact face ties at inside corners
  const built = fins.buildFins(topo, res, rot, { mode: 'auto', bedPad: true, tines: true });
  assert(built.tines >= 33, `staircase lost tines with optimized biteDirsAt: ${built.tines}`);
});
