# Support Fins - Project Context & Operational Architecture

## Overview
Support Fins is a browser-based application that computes and generates designed-in breakaway support fins baked directly into 3D print mesh files (STL and 3MF).
- **Production URL**: [printfins.com](https://printfins.com)
- **Primary Runtime**: Client-side Vanilla ES Modules in `web/` (buildless, zero-transpilation).
- **Core Dependencies**: Vendored `three.js` (r185) in `web/vendor/three/`, `occt-import-js` (0.0.23) in `web/vendor/occt-import-js-0.0.23/`.
- **Hosting / Deploy**: Cloudflare Workers Static Assets (`wrangler.jsonc`) & Docker (`nginx:stable-alpine` via `docker-compose.yml`).

## Development & Testing Workflow
- **Local Dev Server**:
  ```bash
  python dev-server.py
  # Serves http://localhost:8731 with cache headers disabled
  ```
- **Test Suite**:
  ```bash
  deno test -A tests/
  ```
- **Geometry & CAD Extensions**:
  - `web/`: Core browser application, UI, web workers, and mesh math geometry engine.
  - `docs/FIN-SPEC.md`: Mathematical definitions and ground truth specifications for breakaway fin walls, tines, and sway braces.
  - `prototype/`: Python/NumPy/Trimesh algorithmic spikes and geometry proof of concepts.
  - `plugins/`: Slicer companion integrations (OrcaSlicer, PrusaSlicer, Onshape FeatureScript).

## Multi-Agent Cognitive Architecture & Governance
- Governance contracts reside in `.agents/`:
  - `AGENTS.md`: Persona roster and specialization boundaries.
  - `INFRASTRUCTURE_INVARIANTS.md`: Binding safety guardrails and execution invariants.
  - `PATTERN_LIBRARY.yaml`: Failure pattern classifications and mitigations.
  - `sessions.md`: Session handoff ledger and chronological continuity broadcasts.
- Mandatory Invariants:
  - **Invariant 13**: Debug artifact cleanup before handoff.
  - **Invariant 14 & 38**: Three strikes rule for troubleshooting.
  - **Invariant 24**: Zero cleartext secrets or credentials committed.
  - **Invariant 33 & 34**: Orchestrator delegation mandate (delegate heavy CVE scans, cleanups, deep research to subagents).
  - **Invariant 39**: Evidence before assertions (anti-guessing).
