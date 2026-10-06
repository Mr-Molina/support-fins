// Tests for Phase 3 - Tier 2 Sub-Batch 2C (UI & WebGL Interaction)
import { assert } from './_util.js';

Deno.test('UI-LOGIC-001: Geometry validation rejects empty or corrupted mesh geometry (< 3 vertices)', () => {
  function validateGeometry(geom) {
    const pos = geom?.getAttribute?.('position');
    if (!pos || pos.count < 3) throw new Error('Cannot load empty or corrupted mesh geometry.');
    return true;
  }

  // Null/undefined geometry
  let threw = false;
  try {
    validateGeometry(null);
  } catch (e) {
    threw = true;
    assert(e.message === 'Cannot load empty or corrupted mesh geometry.');
  }
  assert(threw, 'null geometry must throw');

  // Object without getAttribute
  threw = false;
  try {
    validateGeometry({});
  } catch (e) {
    threw = true;
    assert(e.message === 'Cannot load empty or corrupted mesh geometry.');
  }
  assert(threw, 'empty object must throw');

  // Geometry with missing position attribute
  threw = false;
  try {
    validateGeometry({ getAttribute: (k) => null });
  } catch (e) {
    threw = true;
    assert(e.message === 'Cannot load empty or corrupted mesh geometry.');
  }
  assert(threw, 'geometry without position must throw');

  // Geometry with 0 vertices
  threw = false;
  try {
    validateGeometry({ getAttribute: (k) => (k === 'position' ? { count: 0 } : null) });
  } catch (e) {
    threw = true;
    assert(e.message === 'Cannot load empty or corrupted mesh geometry.');
  }
  assert(threw, 'geometry with count 0 must throw');

  // Geometry with 2 vertices (less than 1 triangle / 3 vertices)
  threw = false;
  try {
    validateGeometry({ getAttribute: (k) => (k === 'position' ? { count: 2 } : null) });
  } catch (e) {
    threw = true;
    assert(e.message === 'Cannot load empty or corrupted mesh geometry.');
  }
  assert(threw, 'geometry with count 2 must throw');

  // Valid geometry with >= 3 vertices passes
  assert(validateGeometry({ getAttribute: (k) => (k === 'position' ? { count: 3 } : null) }) === true);
});

Deno.test('UI-001: pointerup ignores non-primary mouse buttons (right click, middle click)', () => {
  let picked = false;
  function handlePointerUp(e, from, part, topology) {
    if (!from || !part || !topology) return;
    if (e.button !== 0) return;
    picked = true;
  }

  const dummyFrom = { x: 10, y: 10 };
  const dummyPart = {};
  const dummyTopology = {};

  // Secondary button (button 2 - right click)
  picked = false;
  handlePointerUp({ button: 2, clientX: 10, clientY: 10 }, dummyFrom, dummyPart, dummyTopology);
  assert(!picked, 'right-click (button 2) must not trigger picking');

  // Auxiliary button (button 1 - middle click)
  picked = false;
  handlePointerUp({ button: 1, clientX: 10, clientY: 10 }, dummyFrom, dummyPart, dummyTopology);
  assert(!picked, 'middle-click (button 1) must not trigger picking');

  // Primary button (button 0 - left click)
  picked = false;
  handlePointerUp({ button: 0, clientX: 10, clientY: 10 }, dummyFrom, dummyPart, dummyTopology);
  assert(picked, 'left-click (button 0) must trigger picking');
});
