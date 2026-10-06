# Master Deep Code Audit Report: support-fins
**Date:** October 5, 2026  
**Repository:** `support-fins` (`s:\Github\support-fins`)  
**Scope:** Full repository (~16K LOC across JS, Python, Lua, and Infrastructure)  
**Methodology:** 6-Persona Adversarial Committee (Deep Code Audit Protocol)  
**Total Canonical Defects Identified:** 74 (3 Critical, 25 High, 32 Medium, 14 Low)

---

## Master Remediation Matrix

### Tier 1: CRITICAL Severity (3 Findings)
| Priority | ID | Domain | File | Line(s) | Title | Blocked By |
| :---: | :--- | :---: | :--- | :--- | :--- | :---: |
| 1 | `CAD-LOGIC-04` | CAD | `web/threemf.js` | 198–221 | Infinite loop in `scanXML` on malformed closing tags / trailing slash whitespace freezing tab | — |
| 2 | `GEOM-LOGIC-001` | Geometry | `web/inside.js` | 475–487 | Parity ray crossing inversion on shared triangle edges and at $z=0$ bed interface | — |
| 3 | `QA-CI-001` | QA | `.github/workflows/test.yml` | 9–19 | CI workflow executes only Deno tests, completely bypassing Pytest and Lua suites | — |

---

### Tier 2: HIGH Severity (25 Findings)
| Priority | ID | Domain | File | Line(s) | Title | Blocked By |
| :---: | :--- | :---: | :--- | :--- | :--- | :---: |
| 4 | `GEOM-LOGIC-002` | Geometry | `web/fins.js`, `web/sway.js`, `web/cutout.js` | 380–394 | Sutherland-Hodgman clipping duplicates boundary vertices causing false obstruction in `wallIsClear` | — |
| 5 | `GEOM-LOGIC-003` | Geometry | `web/fins.js` | 1008–1031 | `brimPad` height capped at 0.20mm on open bed due to bounded `dist`, breaking custom pads & causing 87k-tri explosion | — |
| 6 | `GEOM-LOGIC-004` | Geometry | `web/fins.js` | 830, 1722–1736 | Rejection of point-seated parts in `buildPad` aborts support creation via `noProps()` | — |
| 7 | `GEOM-LOGIC-009` | Geometry | `web/fins.js` | 583–596, 642–645 | Missing layer-grid snapping in `buildFin` creates multi-layer welds violating `FIN-SPEC.md` | — |
| 8 | `GEOM-LOGIC-011` | Geometry | `web/fins.js` | 874–882, 912–960 | Coarse radial grid interpolation (1.2mm) in conforming pad pierces shallow overhang flanks | — |
| 9 | `GEOM-PERF-001` | Geometry | `web/prop.js` | 1349–1365 | Unbounded `Float64Array(nFaces)` allocation and $O(\text{nFaces})$ scan in `biteDirsAt` per tine | — |
| 10 | `CAD-CONC-01` | CAD | `web/step.js` | 111–140 | Missing request correlation token and promise race condition in singleton `stepWorker` | — |
| 11 | `CAD-CONC-02` | CAD | `web/stepworker.js`, `web/step.js` | 20–32, 134–140 | Kernel error deserialization failure & orphaned WASM state on `ReadStepFile` failure | `CAD-CONC-01` |
| 12 | `CAD-LOGIC-02` | CAD | `web/zip.js` | 160–165, 234 | Unbounded Deflate decompression bomb (Zip Bomb) vulnerability in `unzip` | — |
| 13 | `CAD-PERF-01` | CAD | `web/step.js` | 137 | Redundant structured cloning of large STEP ArrayBuffers across thread boundary | — |
| 14 | `CAD-PERF-02` | CAD | `web/finworker.js`, `web/fins.js` | 20–21, 1861–1871 | Non-transferable support mesh vertex arrays causing deep structured cloning & heap bloat | — |
| 15 | `UI-001` | UI | `web/app.js` | 1433–1498 | Missing pointer button guard in `pointerup` executes destructive picks on right/middle-click | — |
| 16 | `UI-002` | UI | `web/app.js` | 54–72 | TransformControls gizmo rotations bypass history stack, preventing undo/redo | — |
| 17 | `UI-PERF-002` | UI | `web/app.js`, `web/ui/remove.js` | 1368–1422 | Un-throttled synchronous raycasting on `pointermove` causes UI freeze on dense meshes | — |
| 18 | `UI-LOGIC-001` | UI | `web/app.js`, `web/overhangs.js`, `web/ui/io.js` | 115–156 | Missing triangle count validation on imported geometry causes `NaN` bounding boxes & camera corruption | — |
| 19 | `UI-003` | UI | `web/app.js` | 115–185 | `setPart()` fails to dispose `drawnMesh` and `selMesh`, causing ghost meshes and dangling selection | — |
| 20 | `SLICER-LOGIC-001` | Slicer | `plugins/orca/src/support_fins_orca.py` | 305–326 | `SliceFrame` affine calibration corrupted by discrete 2D slice bounding box | — |
| 21 | `SLICER-LOGIC-002` | Slicer | `plugins/orca/src/support_fins_orca.py` | 73–109, 521–530 | Singleton V8 context `_engine` retains poisoned or crashed state across slicing failures | — |
| 22 | `SLICER-LOGIC-003` | Slicer | `plugins/orca/support_fins_probe.py` | 150–165 | `support_fins_probe.py` passes raw untransformed mesh vertices, ignoring object/volume transforms | — |
| 23 | `SLICER-LOGIC-006` | Slicer | `plugins/onshape/supportFins.fs` | 681–703 | Disjoint support bodies cause `opBoolean(UNION)` to fail, scattering unmerged tines across Part Studio | — |
| 24 | `QA-INVAR-001` | QA | `tests/_util.js` | 113–126 | `isClosed` manifold checker permits non-manifold pinch edges and discards winding orientation | — |
| 25 | `QA-ISO-001` | QA | `tests/cutout.test.js` | 246–268 | Test mutation of global `CUT.pattern` leaks outside `try/finally` on assertion failures | — |
| 26 | `QA-COV-001` | QA | `web/stl.js` | 22–63 | `writeBinarySTL` binary exporter has zero unit or integration test coverage | — |
| 27 | `INFRA-01` | Infra | `Dockerfile` | 12–35 | Container runs as root without user demotion | — |
| 28 | `SEC-01` | Security | `nginx.conf` | 8–50 | Missing HTTP security headers and Nginx `add_header` block replacement hazard | — |

---

### Tier 3: MEDIUM Severity (32 Findings)
| Priority | ID | Domain | File | Line(s) | Title | Blocked By |
| :---: | :--- | :---: | :--- | :--- | :--- | :---: |
| 29 | `SEC-02` | Security | `web/_headers` | 1–6 | Missing application cache invalidation policy and global security headers in production | — |
| 30 | `GEOM-LOGIC-005` | Geometry | `web/fins.js` | 817–824 | Incomplete polygon intersection in `firstLayerOutline` when triangle vertices land on slice height $z_c$ | — |
| 31 | `GEOM-LOGIC-006` | Geometry | `web/fins.js` | 684–700, 1492 | `applyTunables` does not propagate `tineBite` or sway clearances to `PROP` and `SWAY` modules | — |
| 32 | `GEOM-LOGIC-007` | Geometry | `web/fins.js` | 1427–1454 | Potential infinite loop and NaN column count in `perpColumns` spatial binning | — |
| 33 | `GEOM-LOGIC-008` | Geometry | `web/sway.js`, `web/fins.js` | 432–447 | `swayClashesWall` performs 2D bed footprint clash check against aerial part-attached props | — |
| 34 | `GEOM-LOGIC-010` | Geometry | `web/cutout.js` | 414 | Unguarded vector normalization in `cutWall` generates NaN coordinates on opposing station normals | — |
| 35 | `CAD-CONC-03` | CAD | `web/finworker.js`, `web/stepworker.js` | 17–26 | Missing top-level `onerror` and `onunhandledrejection` handlers in Web Workers | — |
| 36 | `CAD-LOGIC-01` | CAD | `web/fins.js` | 684–700 | Worker module state pollution via non-idempotent `applyTunables` global object mutation | `GEOM-LOGIC-006` |
| 37 | `CAD-LOGIC-03` | CAD | `web/zip.js` | 173–236 | Unchecked DataView offsets in central directory and local header traversal | — |
| 38 | `CAD-LOGIC-05` | CAD | `web/step.js` | 35–38 | STEP detection buffer truncation rejecting valid Part 21 files with leading comments | — |
| 39 | `CAD-LOGIC-06` | CAD | `web/step.js`, `web/stepworker.js` | 111–114 | Persistent OpenCASCADE WASM linear memory growth retaining heap indefinitely | `CAD-CONC-01` |
| 40 | `UI-PERF-001` | UI | `web/app.js` | 64–70 | Redundant duplicate `refreshFins()` on gizmo drag release causes WebWorker churn | `UI-002` |
| 41 | `UI-PERF-003` | UI | `web/ui/scene.js`, `web/ui/volume.js` | 60–95 | `buildPlate` calls `plate.clear()` without disposing child BufferGeometries and Materials | — |
| 42 | `UI-PERF-004` | UI | `web/app.js` | 677–688 | Continuous `bandGeom.setFromPoints` reallocates buffer attributes on every pointermove | — |
| 43 | `UI-004` | UI | `web/ui/history.js` | 47–74 | `restoreState` desynchronizes `coverage-fld` and delays `rebuildDrawn()` rendering | `UI-002` |
| 44 | `UI-005` | UI | `web/ui/io.js` | 96–114 | Object picker modal re-entrancy leaks `keydown` listeners and leaves orphaned Promises | — |
| 45 | `UI-LOGIC-002` | UI | `web/ui/io.js`, `web/app.js` | 205–215 | `loadURL()` silently swallows fetch errors and includes URL query strings in export filenames | — |
| 46 | `SLICER-LOGIC-004` | Slicer | `plugins/orca/src/support_fins_orca.py` | 423–435 | Fin surfaces added to layer 0 default to `SurfaceType.stInternal` instead of `stBottom` | — |
| 47 | `SLICER-LOGIC-005` | Slicer | `plugins/prusa/.../add_fin.lua` | 49–56 | `execute(opts)` crashes with Lua runtime error if `opts` or parameter fields are nil | — |
| 48 | `SLICER-LOGIC-007` | Slicer | `plugins/orca/src/support_fins_orca.py` | 414–418 | Multi-region layer fins injected exclusively into first region `regions[0]` | — |
| 49 | `SLICER-PERF-001` | Slicer | `plugins/orca/panel/engine_bridge.js` | 33–46 | `bytesToB64` executes O(N) string concatenations creating GC pressure in embedded V8 | — |
| 50 | `INFRA-02` | Infra | `Dockerfile` | 12 | Base image uses floating `nginx:stable-alpine` tag without digest pinning | `INFRA-01` |
| 51 | `INFRA-03` | Infra | `docker-compose.yml` | 10–19 | Missing container CPU and memory constraints in `docker-compose.yml` | — |
| 52 | `INFRA-04` | Infra | `docker-compose.yml` | 10–19 | Missing runtime container hardening (read-only root, capability drop) | `INFRA-01` |
| 53 | `SEC-03` | Security | `dev-server.py` | 28–30, 65 | Unhandled IndexError on malformed requests, missing timeout, and log forgery | — |
| 54 | `SEC-04` | Security | `.github/workflows/test.yml` | 13–14 | CI/CD pipeline uses unpinned third-party actions (supply chain exposure) | `QA-CI-001` |
| 55 | `SEC-05` | Security | `.github/workflows/test.yml` | 18 | Permissive `-A` flag in CI test execution bypasses Deno security sandbox | `QA-CI-001` |
| 56 | `QA-ASSERT-001` | QA | `tests/fins.test.js` | 75–86 | Fin removal test asserts invariant on duplicated test-local loop rather than production code | — |
| 57 | `QA-ASSERT-002` | QA | `tests/perp_hole.test.js` | 56–66 | Boundary assertions for bore encroachment check allow 2mm geometry intrusion | — |
| 58 | `QA-TOL-001` | QA | `tests/cutout.test.js` | 263–265 | Volume comparison threshold permits up to 2% plastic addition on cutout walls | — |
| 59 | `QA-COV-002` | QA | `tests/_util.js` | 22–36 | Ingestion pipeline and utilities lack negative tests for truncated buffers & zero-area faces | — |
| 60 | `QA-FIXT-001` | QA | `tests/_util.js` | 58–97 | Core fin and sway suites rely on synthetic convex primitives rather than non-convex meshes | — |

---

### Tier 4: LOW Severity (14 Findings)
| Priority | ID | Domain | File | Line(s) | Title | Blocked By |
| :---: | :--- | :---: | :--- | :--- | :--- | :---: |
| 61 | `CAD-LOGIC-07` | CAD | `web/stl.js` | 22–33 | Unchecked 32-bit triangle count integer overflow in binary STL writer | — |
| 62 | `CAD-LOGIC-08` | CAD | `web/zip.js` | 38–107 | ZIP writer lacks ZIP64 support causing silent data truncation past 4GB limit | — |
| 63 | `UI-006` | UI | `web/app.js` | 1250 | Missing optional chaining on `el('bed-pad').selectedOptions[0]` throws TypeError | — |
| 64 | `UI-PERF-005` | UI | `web/ui/volume.js`, `web/ui/scene.js` | 65–70 | Unbounded custom volume dimensions trigger catastrophic array allocation in `buildPlate` | — |
| 65 | `UI-007` | UI | `web/ui/scene.js` | 130–136 | Zero-height viewport window resize sets camera aspect to `Infinity`/`NaN` | — |
| 66 | `SLICER-SEC-001` | Slicer | `plugins/orca/src/support_fins_orca.py` | 541–550 | Unlocked concurrent file writes and unbounded log file growth in plugin directory | — |
| 67 | `SLICER-SEC-002` | Slicer | `plugins/prusa/run-tests.sh` | 12–13 | Inline Python invocation `python3 -c` violates Project Invariant 31 & GLB-004 | — |
| 68 | `INFRA-05` | Infra | `docker-compose.yml` | 20–27 | Muted diagnostic output and missing network timeout in healthcheck | — |
| 69 | `INFRA-06` | Infra | `nginx.conf` | 34 | Nginx root canonicalization drops query arguments and bypasses normalized slashing | — |
| 70 | `SEC-06` | Security | `.github/workflows/test.yml` | 8–12 | Missing explicit least-privilege `permissions` block in GitHub Actions workflow | `QA-CI-001` |
| 71 | `QA-ISO-002` | QA | `plugins/prusa/tests/add_fin_test.lua` | 16–52 | Lua test pollutes global table `_G` and calls `os.exit`, obstructing modular test integration | — |
| 72 | `QA-ASSERT-003` | QA | `plugins/prusa/tests/add_fin_test.lua` | 101–102 | Tine comb height span check threshold (>3mm on 25mm fin) permits clustered placement | — |
| 73 | `QA-ISO-003` | QA | `plugins/orca/tests/test_plugin.py` | 217–220 | Direct mutation of `ORCA.registered` capability list lacks fixture teardown isolation | — |
| 74 | `QA-LIFECYCLE-001` | QA | `tests/cutout.test.js` | 141–145 | Top-level module eager evaluation of ray-intersection sampling delays discovery | — |

---

## Synthesis Summary & Next Steps
- **Total Canonical Defects:** 74
- **Critical Severity:** 3
- **High Severity:** 25
- **Medium Severity:** 32
- **Low Severity:** 14

*Phase 2 complete. Master Remediation Matrix saved to `.agents/audit-findings/2026-10-05-deep-code-audit-findings.md`.*
