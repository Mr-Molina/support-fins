// Shared test helpers. No network deps -- a tiny local assert so `deno test
// --allow-read tests/` runs offline. The support engine is pure geometry, so
// every test is: build some geometry, assert an invariant on the triangle soup.

// Provide headless DOM shims so web/ui modules can be imported under Deno test runner
if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  const fakeEl = {
    addEventListener: noop, removeEventListener: noop,
    setAttribute: noop, appendChild: noop, removeChild: noop,
    classList: { add: noop, remove: noop, toggle: noop },
    style: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => fakeEl,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    clientWidth: 800, clientHeight: 600,
  };
  globalThis.document = {
    getElementById: () => fakeEl,
    querySelector: () => fakeEl,
    querySelectorAll: () => [],
    createElement: () => fakeEl,
    body: fakeEl,
  };
  globalThis.window = globalThis;
}

import { fileURLToPath } from 'node:url';

export const WEB = new URL('../web/', import.meta.url).href;
export const MODELS = fileURLToPath(new URL('../prototype/stress/models/', import.meta.url));

export const { buildTopology, analyze } = await import(`${WEB}overhangs.js`);
export const fins = await import(`${WEB}fins.js`);
export const prop = await import(`${WEB}prop.js`);
export const { insidePart } = await import(`${WEB}inside.js`);

// --- assertions -----------------------------------------------------------
export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
export function assertClose(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg || 'not close'}: ${a} vs ${b} (tol ${tol})`);
}

// --- STL + geometry --------------------------------------------------------
export function readSTL(bytes) {
  if (bytes.byteLength < 84) throw new Error('STL too short: missing header/count');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = dv.getUint32(80, true);
  if (bytes.byteLength < 84 + n * 50) {
    throw new Error(`truncated STL: expected at least ${84 + n * 50} bytes for ${n} triangles, got ${bytes.byteLength}`);
  }
  const pos = new Float32Array(n * 9);
  for (let f = 0; f < n; f++) {
    const o = 84 + f * 50 + 12;
    for (let i = 0; i < 9; i++) pos[f * 9 + i] = dv.getFloat32(o + i * 4, true);
  }
  return pos;
}

export function loadModel(name) {
  const pos = readSTL(Deno.readFileSync(`${MODELS}${name}.stl`));
  return buildTopology({ getAttribute: (k) => (k === 'position' ? { array: pos } : null) });
}

/** A solid axis-aligned block as a closed triangle-soup position array. */
export function block(x0, x1, y0, y1, z0, z1) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
             [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const q = (a, b, c, d) => [v[a], v[b], v[c], v[a], v[c], v[d]];
  const t = [...q(0, 3, 2, 1), ...q(4, 5, 6, 7), ...q(0, 1, 5, 4),
             ...q(2, 3, 7, 6), ...q(1, 2, 6, 5), ...q(0, 4, 7, 3)];
  const arr = new Float32Array(t.length * 3);
  let i = 0;
  for (const p of t) { arr[i++] = p[0]; arr[i++] = p[1]; arr[i++] = p[2]; }
  return arr;
}
export function blockTopo(...args) {
  const pos = block(...args);
  return buildTopology({ getAttribute: (k) => (k === 'position' ? { array: pos } : null) });
}

/** A block with a rotation about X BAKED into its vertices, reseated so min z = 0
 *  -- i.e. a part a user tilted and the STL was saved tilted (rot stays identity).
 *  degX = 45 gives faces whose normals land exactly on |nz| = sin(45). */
export function tiltedBlockTopo(x0, x1, y0, y1, z0, z1, degX) {
  const a = (degX * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const raw = block(x0, x1, y0, y1, z0, z1);
  let minZ = Infinity;
  const rot = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 3) {
    const y = raw[i + 1], z = raw[i + 2];
    rot[i] = raw[i]; rot[i + 1] = y * c - z * s; rot[i + 2] = y * s + z * c;
    if (rot[i + 2] < minZ) minZ = rot[i + 2];
  }
  for (let i = 0; i < rot.length; i += 3) rot[i + 2] -= minZ;
  return buildTopology({ getAttribute: (k) => (k === 'position' ? { array: rot } : null) });
}

/** A wide thin plate x[-X,X] y[-Y,Y] z[0,TH] with a rectangular bore x[-hx,hx]
 *  y[-hy,hy] punched through Z, as a watertight frame slab. Tilt it with rotX(45)
 *  and its -Z face is a broad downward overhang with a bore through it -- the
 *  angle-bracket case. */
export function holedPlateTopo(X, Y, TH, hx, hy) {
  const tris = [];
  const quad = (a, b, c, d) => { tris.push(a, b, c, a, c, d); };
  const V = (x, y, z) => [x, y, z];
  const frame = (z, up) => {
    const strips = [[-X, -Y, -hx, Y], [hx, -Y, X, Y], [-hx, -Y, hx, -hy], [-hx, hy, hx, Y]];
    for (const [x0, y0, x1, y1] of strips) {
      const p = [V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z)];
      up ? quad(p[0], p[1], p[2], p[3]) : quad(p[0], p[3], p[2], p[1]);
    }
  };
  frame(TH, true); frame(0, false);
  const wall = (x0, y0, x1, y1, out) => {
    const a = V(x0, y0, 0), b = V(x1, y1, 0), c = V(x1, y1, TH), d = V(x0, y0, TH);
    out ? quad(a, b, c, d) : quad(a, d, c, b);
  };
  wall(-X, -Y, X, -Y, true); wall(X, -Y, X, Y, true); wall(X, Y, -X, Y, true); wall(-X, Y, -X, -Y, true);
  wall(-hx, -hy, hx, -hy, false); wall(hx, -hy, hx, hy, false); wall(hx, hy, -hx, hy, false); wall(-hx, hy, -hx, -hy, false);
  const pos = new Float32Array(tris.length * 3);
  let i = 0; for (const v of tris) { pos[i++] = v[0]; pos[i++] = v[1]; pos[i++] = v[2]; }
  return buildTopology({ getAttribute: (k) => (k === 'position' ? { array: pos } : null) });
}

/** A non-convex L-shaped bracket model fixture as a watertight topology object. */
export function lShapeTopo(w = 30, h = 30, d = 10, t = 10) {
  const tris = [];
  const V = (x, y, z) => [x, y, z];
  const quad = (a, b, c, d) => { tris.push(a, b, c, a, c, d); };
  // Front face (y = 0, normal -Y): 3 non-overlapping rectangles: [0,t]x[0,t], [t,w]x[0,t], [0,t]x[t,h]
  quad(V(0, 0, 0), V(t, 0, 0), V(t, 0, t), V(0, 0, t));
  quad(V(t, 0, 0), V(w, 0, 0), V(w, 0, t), V(t, 0, t));
  quad(V(0, 0, t), V(t, 0, t), V(t, 0, h), V(0, 0, h));
  // Back face (y = d, normal +Y)
  quad(V(0, d, t), V(t, d, t), V(t, d, 0), V(0, d, 0));
  quad(V(t, d, t), V(w, d, t), V(w, d, 0), V(t, d, 0));
  quad(V(0, d, h), V(t, d, h), V(t, d, t), V(0, d, t));
  // 8 walls connecting y=0 to y=d
  const loop = [
    [0, 0], [t, 0], [w, 0], [w, t], [t, t], [t, h], [0, h], [0, t],
  ];
  for (let i = 0; i < loop.length; i++) {
    const [x0, z0] = loop[i];
    const [x1, z1] = loop[(i + 1) % loop.length];
    quad(V(x0, 0, z0), V(x0, d, z0), V(x1, d, z1), V(x1, 0, z1));
  }
  const pos = new Float32Array(tris.length * 3);
  let i = 0; for (const v of tris) { pos[i++] = v[0]; pos[i++] = v[1]; pos[i++] = v[2]; }
  return buildTopology({ getAttribute: (k) => (k === 'position' ? { array: pos } : null) });
}

/** A non-convex C-channel model fixture with an overhang as a watertight topology object. */
export function cChannelTopo(w = 30, h = 30, d = 10, t = 10) {
  const tris = [];
  const V = (x, y, z) => [x, y, z];
  const quad = (a, b, c, d) => { tris.push(a, b, c, a, c, d); };
  // Front face (y = 0): 5 rectangles:
  // [0,t]x[0,t], [t,w]x[0,t], [0,t]x[t,h-t], [0,t]x[h-t,h], [t,w]x[h-t,h]
  quad(V(0, 0, 0), V(t, 0, 0), V(t, 0, t), V(0, 0, t));
  quad(V(t, 0, 0), V(w, 0, 0), V(w, 0, t), V(t, 0, t));
  quad(V(0, 0, t), V(t, 0, t), V(t, 0, h - t), V(0, 0, h - t));
  quad(V(0, 0, h - t), V(t, 0, h - t), V(t, 0, h), V(0, 0, h));
  quad(V(t, 0, h - t), V(w, 0, h - t), V(w, 0, h), V(t, 0, h));

  // Back face (y = d):
  quad(V(0, d, t), V(t, d, t), V(t, d, 0), V(0, d, 0));
  quad(V(t, d, t), V(w, d, t), V(w, d, 0), V(t, d, 0));
  quad(V(0, d, h - t), V(t, d, h - t), V(t, d, t), V(0, d, t));
  quad(V(0, d, h), V(t, d, h), V(t, d, h - t), V(0, d, h - t));
  quad(V(t, d, h), V(w, d, h), V(w, d, h - t), V(t, d, h - t));

  // 12 walls connecting y=0 to y=d
  const loop = [
    [0, 0], [t, 0], [w, 0], [w, t], [t, t], [t, h - t],
    [w, h - t], [w, h], [t, h], [0, h], [0, h - t], [0, t],
  ];
  for (let i = 0; i < loop.length; i++) {
    const [x0, z0] = loop[i];
    const [x1, z1] = loop[(i + 1) % loop.length];
    quad(V(x0, 0, z0), V(x0, d, z0), V(x1, d, z1), V(x1, 0, z1));
  }
  const pos = new Float32Array(tris.length * 3);
  let i = 0; for (const v of tris) { pos[i++] = v[0]; pos[i++] = v[1]; pos[i++] = v[2]; }
  return buildTopology({ getAttribute: (k) => (k === 'position' ? { array: pos } : null) });
}

// --- rotations (column-major 3x3, THREE.Matrix3.elements order) -----------
const d2r = (d) => (d * Math.PI) / 180;
export const rotX = (d) => { const c = Math.cos(d2r(d)), s = Math.sin(d2r(d)); return [1, 0, 0, 0, c, s, 0, -s, c]; };
export const rotY = (d) => { const c = Math.cos(d2r(d)), s = Math.sin(d2r(d)); return [c, 0, -s, 0, 1, 0, s, 0, c]; };

// --- invariant helpers -----------------------------------------------------
/** How many of these [x,y,z] verts are strictly inside the seated part. */
export function insideCount(topo, rot, offset, tris) {
  let c = 0;
  for (const v of tris) if (insidePart(topo, rot, offset, v[0], v[1], v[2])) c++;
  return c;
}

/** Is the triangle-soup a closed surface (every undirected edge shared evenly)? */
export function isClosed(tris, { allowComposite = true } = {}) {
  if (!tris.length) return true;
  const coord = (v) => (Math.round(v * 1e4) / 1e4 + 0).toFixed(4);
  const key = (p) => `${coord(p[0])},${coord(p[1])},${coord(p[2])}`;
  const undirected = new Map();
  const directed = new Map();
  for (let i = 0; i < tris.length; i += 3) {
    for (let e = 0; e < 3; e++) {
      const a = key(tris[i + e]), b = key(tris[i + (e + 1) % 3]);
      if (a === b) return false;
      const u = a < b ? `${a}|${b}` : `${b}|${a}`;
      undirected.set(u, (undirected.get(u) ?? 0) + 1);
      const d = `${a}->${b}`;
      directed.set(d, (directed.get(d) ?? 0) + 1);
    }
  }
  for (const c of undirected.values()) {
    if (allowComposite ? c % 2 !== 0 : c !== 2) return false;
  }
  for (const [d, count] of directed.entries()) {
    const [a, b] = d.split('->');
    if (directed.get(`${b}->${a}`) !== count) return false;
  }
  return true;
}

/** Squared distance from point p to triangle (a,b,c) (each [x,y,z]). */
export function ptTriDist2(p, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return dot(ap, ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return dot(bp, bp);
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return dot(cp, cp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); const q = [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; const w = sub(p, q); return dot(w, w); }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); const q = [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; const u = sub(p, q); return dot(u, u); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); const q = [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; const u = sub(p, q); return dot(u, u); }
  const denom = 1 / (va + vb + vc), v = vb * denom, w = vc * denom;
  const q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
  const u = sub(p, q); return dot(u, u);
}

/** Horizontal INWARD unit normal of the seated part face nearest point p, or null
 *  if that face is near-horizontal (no sideways grip). Independent of the engine's
 *  own biteDirAt -- a test using this checks the bite from scratch. */
export function nearestFaceInwardH(topo, rot, offset, p) {
  const { pos, nrm, nFaces } = topo;
  const seat = (o) => [rot[0] * pos[o] + rot[3] * pos[o + 1] + rot[6] * pos[o + 2] + offset.x,
                       rot[1] * pos[o] + rot[4] * pos[o + 1] + rot[7] * pos[o + 2] + offset.y,
                       rot[2] * pos[o] + rot[5] * pos[o + 1] + rot[8] * pos[o + 2] + offset.z];
  let best = Infinity, bf = -1;
  for (let f = 0; f < nFaces; f++) {
    const o = f * 9, d2 = ptTriDist2(p, seat(o), seat(o + 3), seat(o + 6));
    if (d2 < best) { best = d2; bf = f; }
  }
  if (bf < 0) return null;
  const nx = nrm[bf * 3], ny = nrm[bf * 3 + 1], nz = nrm[bf * 3 + 2];
  const sx = rot[0] * nx + rot[3] * ny + rot[6] * nz;
  const sy = rot[1] * nx + rot[4] * ny + rot[7] * nz;
  const hx = -sx, hy = -sy, hm = Math.hypot(hx, hy);
  if (hm < 0.2) return null;
  return { x: hx / hm, y: hy / hm };
}

/** axis-aligned bounding box of a [x,y,z] vert list */
export function bbox(tris) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of tris) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  return { lo, hi };
}
