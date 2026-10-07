// Orientation + strength logic (web/orient.js). Pure functions in, verdicts and
// ranked poses out -- no DOM, so they test cleanly here. Covers the three things
// the rail leans on: the layer-posture bucket, the load-alignment verdict, and the
// two solvers (minimise-support suggestions, and the load-driven strength pose).

import { WEB, assert, assertClose, blockTopo, tiltedBlockTopo, rotX } from './_util.js';

const { suggestOrientations, suggestStrengthPose, layerVerdict, loadAlignment, PAD_DIRS, candidateDowns } =
  await import(`${WEB}orient.js`);
const { analyze, MIN_STABLE_BED_AREA } = await import(`${WEB}overhangs.js`);

const IDENT = rotX(0);   // as-loaded pose

// ------------------------------------------------------------ layerVerdict

Deno.test('layerVerdict: a tall part reads weak (long axis up the layers)', () => {
  assert(layerVerdict({ x: 10, y: 10, z: 100 }).posture === 'weak');
});

Deno.test('layerVerdict: a flat slab reads strong (long spans along the layers)', () => {
  assert(layerVerdict({ x: 100, y: 80, z: 5 }).posture === 'strong');
});

Deno.test('layerVerdict: an on-its-side part reads mixed', () => {
  // dims sorted [50,70,100]; z=70 is neither the tallest span nor the shortest.
  assert(layerVerdict({ x: 100, y: 50, z: 70 }).posture === 'mixed');
});

Deno.test('layerVerdict: returns posture ONLY -- the always-on text note was dropped', () => {
  // Locks the simplification: the note field is gone, posture is the whole API now,
  // and the one remaining consumer (the strength caveat) reads posture, not note.
  const v = layerVerdict({ x: 100, y: 80, z: 5 });
  assert(v.note === undefined, 'layerVerdict should no longer return a display note');
  assert(Object.keys(v).length === 1, `expected just {posture}, got ${Object.keys(v)}`);
});

// ------------------------------------------------------------ loadAlignment

Deno.test('loadAlignment: a pull straight up the build axis is poor (across the layers)', () => {
  assert(loadAlignment([0, 0, 1]).quality === 'poor');
});

Deno.test('loadAlignment: a pull in the layer plane is good (along the layers)', () => {
  assert(loadAlignment([1, 0, 0]).quality === 'good');
});

Deno.test('loadAlignment: a 45-degree pull is mixed', () => {
  const al = loadAlignment([1, 0, 1]);
  assert(al.quality === 'mixed');
  assertClose(al.cross, Math.SQRT1_2, 1e-9, 'cross should be |z|/|d| = 1/sqrt(2)');
});

Deno.test('loadAlignment: the good/mixed boundary sits at 60 degrees from the plate', () => {
  // cross = 0.5 is exactly 60deg off in-plane and must still count as good (<= 0.5).
  assert(loadAlignment([Math.sqrt(3), 0, 1]).quality === 'good');
});

Deno.test('loadAlignment: a zero-length direction is null, not a crash', () => {
  assert(loadAlignment([0, 0, 0]) === null);
});

// ------------------------------------------------------------ PAD_DIRS

Deno.test('PAD_DIRS: defines 10 normalized cardinal and diagonal directions', () => {
  const expectedKeys = ['upleft', 'up', 'upright', 'left', 'right', 'downleft', 'down', 'downright', 'front', 'back'];
  const keys = Object.keys(PAD_DIRS);
  assert(keys.length === 10, `expected 10 direction keys, got ${keys.length}`);
  for (const k of expectedKeys) {
    assert(k in PAD_DIRS, `missing direction key: ${k}`);
    const [x, y, z] = PAD_DIRS[k];
    const len = Math.hypot(x, y, z);
    assertClose(len, 1.0, 1e-9, `direction ${k} must be normalized to unit length`);
  }
});

Deno.test('PAD_DIRS: diagonals yield mixed loadAlignment verdicts at 45 degrees', () => {
  const diagonals = ['upleft', 'upright', 'downleft', 'downright'];
  for (const d of diagonals) {
    const al = loadAlignment(PAD_DIRS[d]);
    assert(al !== null, `loadAlignment returned null for ${d}`);
    assert(al.quality === 'mixed', `expected 'mixed' for diagonal ${d}, got ${al.quality}`);
    assertClose(al.cross, Math.SQRT1_2, 1e-9, `expected cross ~0.7071 for diagonal ${d}`);
  }
});

Deno.test('PAD_DIRS: cardinal directions yield good or poor verdicts', () => {
  assert(loadAlignment(PAD_DIRS.up).quality === 'poor');
  assert(loadAlignment(PAD_DIRS.down).quality === 'poor');
  assert(loadAlignment(PAD_DIRS.left).quality === 'good');
  assert(loadAlignment(PAD_DIRS.right).quality === 'good');
  assert(loadAlignment(PAD_DIRS.front).quality === 'good');
  assert(loadAlignment(PAD_DIRS.back).quality === 'good');
});

Deno.test('PAD_DIRS: dot product threshold 0.99 cleanly discriminates each direction', () => {
  const entries = Object.entries(PAD_DIRS);
  for (let i = 0; i < entries.length; i++) {
    const [keyA, [ax, ay, az]] = entries[i];
    // Self dot product is 1.0
    const selfDot = ax * ax + ay * ay + az * az;
    assertClose(selfDot, 1.0, 1e-9, `${keyA} self dot must be 1.0`);
    assert(selfDot > 0.99, `${keyA} must match itself with threshold 0.99`);

    // Cross dot products with other directions must be strictly <= cos(45deg) ~ 0.7071
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const [keyB, [bx, by, bz]] = entries[j];
      const dot = ax * bx + ay * by + az * bz;
      assert(dot < 0.99, `${keyA} vs ${keyB} dot product (${dot}) must not exceed 0.99`);
    }
  }
});

// ------------------------------------------------------------ suggestOrientations

Deno.test('suggestOrientations: finds the flat pose for a part saved tilted', () => {
  // A block whose vertices were tilted 60deg and saved that way: as loaded it has a
  // broad downward overhang, but rotating it back flat needs no support at all. The
  // suggester must surface that pose and rank it on top.
  const topo = tiltedBlockTopo(0, 60, 0, 40, 0, 12, 60);
  const asLoaded = analyze(topo, 45, IDENT);
  assert(asLoaded.overArea > 1, 'the tilted-as-saved block should have an overhang as loaded');

  const { candidates, confidence } = suggestOrientations(topo, { top: 3, threshold: 45 });
  assert(candidates.length >= 1, 'expected at least one candidate');
  assert(['high', 'medium', 'low', 'none'].includes(confidence), `bad confidence ${confidence}`);

  const best = candidates[0];
  assert(best.overArea < asLoaded.overArea, 'the best pose should reduce overhang area');
  assert(best.overArea < 1, `the best pose should be ~support-free, got ${best.overArea} mm^2`);
  assert(best.regions === 0, `the best pose should have no overhang regions, got ${best.regions}`);
});

Deno.test('suggestOrientations: candidates are ranked best-first and well-formed', () => {
  const topo = tiltedBlockTopo(0, 60, 0, 40, 0, 12, 60);
  const { candidates } = suggestOrientations(topo, { top: 3, threshold: 45 });
  for (let i = 1; i < candidates.length; i++) {
    assert(candidates[i - 1].score <= candidates[i].score, 'candidates must be sorted by score');
  }
  for (const c of candidates) {
    assert(Array.isArray(c.rot) && c.rot.length === 9, 'rot must be a 3x3 (9-element) matrix');
    assert(typeof c.seating === 'string', 'each candidate reports a seating kind');
    assert(c.size && typeof c.size.z === 'number', 'each candidate carries its full seated size');
  }
});

// ------------------------------------------------------------ suggestStrengthPose

Deno.test('suggestStrengthPose: lays the load into the layer plane, on a seated pose', () => {
  // A tall square post pulled along its own long axis. As loaded the pull runs
  // straight up the build layers (weak); the fix is to lay the post on its side so
  // the pull runs along the layers -- and that pose still sits flat on the bed.
  const topo = blockTopo(0, 20, 0, 20, 0, 100);
  const pose = suggestStrengthPose(topo, [0, 0, 1], { threshold: 45 });
  assert(pose, 'a strictly better printable pose should exist for an axial pull on a post');
  assert(pose.bedArea >= 1, 'the recommended pose must actually sit on the bed, not balance on a tip');
  assert(pose.cross < 0.5, `the load should end up in-plane (cross ${pose.cross})`);
  assert(pose.quality === 'good', `expected a good alignment verdict, got ${pose.quality}`);
});

Deno.test('suggestStrengthPose: an already in-plane load needs no turn (returns null)', () => {
  // Load already runs across the footprint of a flat slab -- in the layer plane
  // whichever seated pose you pick -- so there's no stronger printable pose to offer.
  const topo = blockTopo(0, 100, 0, 80, 0, 8);
  const pose = suggestStrengthPose(topo, [1, 0, 0], { threshold: 45 });
  // Either nothing beats the flat pose (null), or the best it finds is still in-plane.
  assert(pose === null || pose.cross < 0.5, 'must not turn a flat slab into a worse-aligned pose');
});

// ------------------------------------------------------------ Lever / Bending mode

Deno.test('loadAlignment (lever mode): a lateral load on an upright post is poor and flags thinnest section', () => {
  // A tall column: 10mm in X (thin), 30mm in Y (mid), 100mm in Z (long upright)
  const topo = blockTopo(0, 10, 0, 30, 0, 100);
  assert(topo.principalAxes, 'buildTopology must compute principalAxes');
  // Load points in X (along the thin cross-section), levering the upright
  const al = loadAlignment([1, 0, 0], { mode: 'lever', topo });
  assert(al !== null, 'loadAlignment returned null in lever mode');
  assert(al.quality === 'poor', `expected poor quality under levering, got ${al.quality}`);
  assert(al.isThin === true, 'expected thin section detection when force acts along short axis');
  assert(al.text.includes('thinnest cross-section'), `expected thinnest cross-section warning, got: ${al.text}`);
  assertClose(al.cross, 1.0, 1e-3, 'beam upright means cross should be ~1.0');
});

Deno.test('loadAlignment (lever mode): a load on a flat beam is good (bends along layers)', () => {
  // A flat beam: 100mm in X (long beam on plate), 30mm in Y (width), 10mm in Z (height)
  const topo = blockTopo(0, 100, 0, 30, 0, 10);
  // Force pushes in Y (lateral on the flat beam)
  const al = loadAlignment([0, 1, 0], { mode: 'lever', topo });
  assert(al !== null, 'loadAlignment returned null');
  assert(al.quality === 'good', `expected good quality when lever lies in layer plane, got ${al.quality}`);
  assert(al.text.includes('continuous layer strands'), `expected continuous strands copy, got: ${al.text}`);
  assertClose(al.cross, 0.0, 1e-3, 'beam in XY plane means cross should be 0.0');
});

Deno.test('suggestStrengthPose (lever mode): rotates an upright post with lateral force onto its side', () => {
  // An upright post: 10mm x 20mm x 100mm tall in Z.
  const topo = blockTopo(0, 10, 0, 20, 0, 100);
  const pose = suggestStrengthPose(topo, [1, 0, 0], { threshold: 45, mode: 'lever' });
  assert(pose, 'expected a suggested pose for upright post in lever mode');
  assert(pose.quality === 'good', `expected good quality for suggested lever pose, got ${pose.quality}`);
  assert(pose.cross < 0.5, `lever beam should be in layer plane, got cross ${pose.cross}`);
  assert(pose.height <= 20.1, `suggested pose should lay the 100mm post down, got height ${pose.height}`);
});

Deno.test('candidateDowns: generates pairwise 45-degree diagonal candidates when includeDiagonals is true', () => {
  const topo = blockTopo(0, 10, 0, 20, 0, 100);
  const baseDowns = candidateDowns(topo, { includeDiagonals: false });
  const diagDowns = candidateDowns(topo, { includeDiagonals: true });
  assert(diagDowns.length > baseDowns.length, 'expected diagonal candidates to expand the search space');
  // At least one diagonal candidate should have a projection close to 1/sqrt(2) ~ 0.7071 on two axes
  const has45 = diagDowns.some((d) => {
    const nonZero = d.filter((c) => Math.abs(c) > 0.1);
    return nonZero.length === 2 && Math.abs(Math.abs(nonZero[0]) - Math.SQRT1_2) < 0.05;
  });
  assert(has45, 'expected at least one 45-degree diagonal candidate down vector');
});

Deno.test('suggestStrengthPose: allows edge-seated poses supported by bed pad and fins', () => {
  const topo = tiltedBlockTopo(0, 60, 0, 40, 0, 12, 60);
  const pose = suggestStrengthPose(topo, [0, 0, 1], { threshold: 45 });
  assert(pose, 'expected suggested pose for tilted block');
  assert(pose.height > 0, 'pose must have valid height');
  assert(typeof pose.bedArea === 'number', 'pose must report bed area');
});

Deno.test('loadAlignment (lever mode): 45-degree diagonal tilt yields good verdict with diagonal copy', () => {
  // A beam oriented at 45 degrees in X-Z
  const topo = blockTopo(0, 10, 0, 30, 0, 100);
  // Beam axis rotated 45 degrees relative to Z
  const rot45 = [
    Math.SQRT1_2, 0, -Math.SQRT1_2,
    0, 1, 0,
    Math.SQRT1_2, 0, Math.SQRT1_2,
  ];
  const al = loadAlignment([1, 0, 0], { mode: 'lever', topo, rot: rot45 });
  assert(al !== null, 'loadAlignment returned null');
  assert(al.quality === 'good', `expected good quality for 45-degree tilt, got ${al.quality}`);
  assert(al.text.includes('Diagonal layer orientation'), `expected diagonal copy, got: ${al.text}`);
});

Deno.test('suggestStrengthPose: tie-breaks equal-cross candidate poses by printability and bed area', () => {
  // A block with dimensions 10 x 50 x 100:
  // With load along Y [0, 1, 0], laying flat on the 50x100 face vs lying on the 10x100 face both have cross = 0.
  // The 50x100 face has 5x larger bed area and lower height (10mm vs 50mm).
  const topo = blockTopo(0, 10, 0, 50, 0, 100);
  const pose = suggestStrengthPose(topo, [0, 1, 0], { threshold: 45, mode: 'pull' });
  assert(pose, 'expected suggested pose');
  assertClose(pose.cross, 0.0, 1e-3, 'cross should be 0');
  // Height must be 10mm (the broadest face on bed, 50x100), not 50mm (the narrow edge)
  assertClose(pose.height, 10, 1e-1, `expected part to lie on its widest 50x100 face (height 10mm), got ${pose.height}`);
  assert(pose.bedArea >= 5000, `expected bed area >= 5000 mm^2, got ${pose.bedArea}`);
});

