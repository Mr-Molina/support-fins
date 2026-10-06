// Tests for Phase 3 - Tier 3 Sub-Batch 3B (Computational Geometry & Math Polish)
import { assert, assertClose } from './_util.js';

const WEB = new URL('../web/', import.meta.url).href;
const fins = await import(`${WEB}fins.js`);
const sway = await import(`${WEB}sway.js`);
const cutout = await import(`${WEB}cutout.js`);
const prop = await import(`${WEB}prop.js`);

Deno.test('GEOM-LOGIC-005: firstLayerOutline with vertices exactly on zc produces outline segments without dropping', () => {
  const zc = 0.1;
  // A triangle whose base lies exactly on the slicing plane z = zc
  // Vertex 0: [0, 0, 0.1]
  // Vertex 1: [10, 0, 0.1]
  // Vertex 2: [5, 10, 0.3] (above slicing plane)
  // Before fix: za = 0, zb = 0; (za < 0) === (zb < 0) was true for all edges, dropping outline.
  // With fix: slicing plane is perturbed by 1.000137e-7, yielding exactly 2 intersection points.
  const tris = new Float64Array([
    0, 0, 0.1,
    10, 0, 0.1,
    5, 10, 0.3,
  ]);

  const outline = fins.firstLayerOutline(tris, zc);
  assert(outline.segs.length === 4, `expected 1 segment (4 coordinates), got ${outline.segs.length}`);
  assert(outline.length > 0, `expected positive outline length, got ${outline.length}`);
  for (const c of outline.segs) {
    assert(Number.isFinite(c), `expected finite coordinate in outline segs, got ${c}`);
  }

  // Also test a closed prism with vertices at zc
  const prismTris = new Float64Array([
    // Triangle 1
    0, 0, 0.1,
    10, 0, 0.1,
    5, 10, 0.3,
    // Triangle 2 (below zc to above zc through zc)
    0, 0, 0.1,
    5, 10, 0.3,
    0, 10, -0.1,
  ]);
  const outline2 = fins.firstLayerOutline(prismTris, zc);
  assert(outline2.segs.length >= 4, `expected outline segments, got ${outline2.segs.length}`);
  assert(outline2.length > 0, `expected positive length, got ${outline2.length}`);
});

Deno.test('GEOM-LOGIC-007: perpColumns handles non-positive, NaN, and extreme pitches without looping or NaN', () => {
  const patch = { t0: 0, t1: 10, tris: [] };

  // Non-positive or NaN pitch -> []
  assert(fins.perpColumns(patch, 0, 20, 0).length === 0, 'pitch 0 should return empty array');
  assert(fins.perpColumns(patch, 0, 20, -5).length === 0, 'negative pitch should return empty array');
  assert(fins.perpColumns(patch, 0, 20, NaN).length === 0, 'NaN pitch should return empty array');

  // Non-finite lo / hi -> []
  assert(fins.perpColumns(patch, NaN, 20, 10).length === 0, 'NaN lo should return empty array');
  assert(fins.perpColumns(patch, 0, NaN, 10).length === 0, 'NaN hi should return empty array');
  assert(fins.perpColumns(patch, -Infinity, 20, 10).length === 0, '-Infinity lo should return empty array');
  assert(fins.perpColumns(patch, 0, Infinity, 10).length === 0, 'Infinity hi should return empty array');

  // Span <= 0 -> []
  assert(fins.perpColumns(patch, 20, 10, 5).length === 0, 'inverted lo/hi should return empty array');
  assert(fins.perpColumns(patch, 10, 10, 5).length === 0, 'zero span should return empty array');

  // Extreme large pitch -> 1 centered column
  const largeCols = fins.perpColumns(patch, 0, 20, 1e6);
  assert(largeCols.length === 1, `expected 1 column for large pitch, got ${largeCols.length}`);
  assertClose(largeCols[0], 10, 1e-4, 'large pitch column should be at span center');

  // Extreme small pitch -> capped at PERP.maxRow (14), all finite numbers, no infinite loop
  const smallCols = fins.perpColumns(patch, 0, 50, 0.0001);
  assert(smallCols.length <= 14, `expected <= 14 columns, got ${smallCols.length}`);
  assert(smallCols.length > 0, 'expected at least 1 column');
  for (const c of smallCols) {
    assert(Number.isFinite(c), `expected finite column coordinate, got ${c}`);
  }
});

Deno.test('GEOM-LOGIC-008: swayClashesWall ignores aerial wall segments above rib height', () => {
  const rib = {
    foot: [[0, 0], [10, 0]],
    halfW: 2.0,
    height: 20,
  };

  // An aerial wall directly overlapping rib foot in XY ([5, 0.5]), but at elevation z = 40 (well above rib.height = 20)
  const aerialWall = [
    [[5, 0.5, 40], [6, 0.5, 40]],
  ];
  assert(!sway.swayClashesWall(rib, aerialWall), 'aerial wall at z=40 should not clash with 20mm tall rib');

  // A grounded wall overlapping in XY at elevation z = 5
  const groundedWall = [
    [[5, 0.5, 5], [6, 0.5, 5]],
  ];
  assert(sway.swayClashesWall(rib, groundedWall), 'grounded wall at z=5 should clash with 20mm tall rib');

  // A subterranean wall below bed (z = -10 < -SWAY.clearance)
  const subWall = [
    [[5, 0.5, -10], [6, 0.5, -10]],
  ];
  assert(!sway.swayClashesWall(rib, subWall), 'subterranean wall should not clash with rib');

  // Single-point walls
  const aerialPoint = [[[5, 0.5, 40]]];
  assert(!sway.swayClashesWall(rib, aerialPoint), 'aerial single point should not clash');

  const groundedPoint = [[[5, 0.5, 5]]];
  assert(sway.swayClashesWall(rib, groundedPoint), 'grounded single point should clash');

  const subPoint = [[[5, 0.5, -10]]];
  assert(!sway.swayClashesWall(rib, subPoint), 'subterranean single point should not clash');
});

Deno.test('GEOM-LOGIC-010: cutWall station normal interpolation across opposing vectors produces no NaN', () => {
  const wasPattern = cutout.CUT.pattern;
  cutout.CUT.pattern = 'lattice';

  try {
    const N = 21;
    const st = [];
    const full = [];
    const L = 40; // 40mm length
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * L;
      const y = 0;
      // Stations 0..10 have normal pointing +Y ([0, 1]), stations 11..20 have normal pointing -Y ([0, -1])
      // Opposing normals will lerp through (0, 0) at the midpoint
      const sx = 0;
      const sy = i <= 10 ? 1 : -1;
      const top = 30;
      const ztip = 29.5;
      const bot = 0;
      const botTip = 1.0;

      st.push({
        p: [x, y],
        sx,
        sy,
        top,
        ztip,
        bot,
        botTip,
        taperBot: false,
      });

      full.push([
        [x, y - 0.2, top],
        [x, y - 0.6, ztip],
        [x, y - 0.6, botTip],
        [x, y + 0.6, botTip],
        [x, y + 0.6, ztip],
        [x, y + 0.2, top],
      ]);
    }

    const out = [];
    const wall = { minStations: 3, th: 1.2, tip: 0.4 };
    const ok = cutout.cutWall(st, full, out, wall);
    assert(ok, 'cutWall should succeed with valid stations and lattice pattern');
    assert(out.length > 0, 'cutWall should emit triangles to out');

    // Check all emitted vertices for NaN or non-finite values
    let nanCount = 0;
    for (let i = 0; i < out.length; i++) {
      const p = out[i];
      for (let j = 0; j < p.length; j++) {
        if (!Number.isFinite(p[j])) {
          nanCount++;
        }
      }
    }
    assert(nanCount === 0, `cutWall emitted ${nanCount} NaN or non-finite coordinates across opposing station normals`);
  } finally {
    cutout.CUT.pattern = wasPattern;
  }
});
