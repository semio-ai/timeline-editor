# Handle Pairing Restoration Plan

Status: handles currently drag independently; pairing is ignored and vertical motion on handles (e.g., `o1` in the store factory) is clamped by the domain. This plan aligns with `docs/bezier-handles.md` and enumerates the concrete code touch points.

## Goals (from Bezier Handles spec)
- Paired handles: colinear, opposite direction, paired handle keeps its own length.
- Visual length is preserved in view space (per-track render scale), storage remains anchor-relative world deltas.
- Only X non-crossing against the anchor; no Y clamping during handle drags.
- Canonical data stays untouched during drag; diffs/snapshots drive preview/commit.

## Immediate unblock
- Remove Y clamping in `actions/drag/update-handle-drag.ts` (domain clamp + implicit flattening) so any handle (in/out) can move vertically. Only keep X non-crossing.

## Implementation outline

### 1) Capture baseline at drag start (`actions/drag/start-handle-drag.ts`)
- Resolve canonical handle vectors for both sides from transitions + neighbors (use `get-world-control-points`/`solveTransitionFromWorldCP` helpers or equivalent).
- Capture explicit pairing, infer if missing (colinear/opposite).
- Capture per-track render scales: `renderScaleX` (likely 1) and `renderScaleYFactor` (world → view span). These come from the UI (see BezierHandles).
- Store canonical paired lengths in view space for both sides; keep neighbor ids/stamp/value for both directions.

### 2) Drag update (`actions/drag/update-handle-drag.ts`)
- Compute next CP from pointer + `normalizedValueDelta` (no Y clamp), then apply X non-crossing.
- Solve back to anchor-relative deltas (`solveTransitionFromWorldCP` or equivalent).
- Resolve current transitions (canonical + handleDiffs) and effective pairing (Alt disables).
- If paired:
  - Convert dragged vector and canonical paired vector to view space via captured render scales.
  - Mirror angle (opposite) and set paired view-length to canonical paired length (not dragged length).
  - Convert paired vector back to world/canonical deltas and write to `handleDiffs` along with pairing flag.
- If free: just write the dragged delta (respect X guard).
- Keep precision handling as before; do not touch canonical transitions.

### 3) UI wiring (`components/canvas-sheet/bezier-handles.tsx`)
- Compute `renderScaleYFactor = |renderScaleY(max)-renderScaleY(min)| / |max-min|` per track and pass it (plus `renderScaleX`) into `startHandleDrag` as `viewScaleY`/`viewScaleX`.
- Maintain existing pointer → normalizedValueDelta path; only add the scale factors.

### 4) Snapshot/diff/commit integration
- `start-drag.ts`: marker drags already snapshot handle offsets; leave intact.
- `apply-drag-deltas.ts`: still uses `markerHandleOffsets` for marker moves; no change required for handle-only drags.
- `commit-drag.ts`: continues to replay `handleDiffs` into transitions; ensure pairing flag is included when present.

### 5) Tests
- Paired length (view-space) when dragging `out` and `in` (~225°) on `o1` with a non-uniform `viewScaleY`.
- Free-handle drag: vertical motion allowed for `o1` `out` when pairing is off.
- Crossing regression: world-space handle deltas survive marker crossing (existing tests stay green).

## Clarifications from review
- Pairing toggle mid-drag: pairing is evaluated per update (explicit/inferred base, overridden by Alt/keybind to force Free). The preview `handleDiffs` should carry the current pairing flag so preview == commit if released immediately.
- Render scale naming: use consistent world→view factors, e.g., `viewScaleX`/`viewScaleY`. Even if X is 1 today, pass it for symmetry; don’t mix “renderScaleYFactor” vs. “renderScaleX”.
- Precision handling: only (a) value rounding to `valueScale.precision`, and (b) flat-angle tolerance for “colinear enough” when auto-pairing/snap-to-flat in Free mode. No other implicit snapping.

## File-level specifics to apply
- `actions/drag/update-handle-drag.ts`: remove domain Y clamp; keep `clampHandleAgainstOwnKeypointX`; resolve transitions with current diffs; add `TransitionPairing` inference; view-space mirror using captured render scales and canonical lengths; write `pairing` into `handleDiffs`.
- `actions/drag/start-handle-drag.ts`: resolve canonical in/out vectors (world deltas) via transitions + neighbors; compute view-space lengths using passed render scales; stash `renderScaleX/renderScaleYFactor`, canonical lengths, explicit/inferred pairing, neighbor ids/stamp/value.
- `components/canvas-sheet/bezier-handles.tsx`: compute `renderScaleYFactor` from `renderScaleY`; pass `renderScaleX` (1) and factor into `startHandleDrag`.
- `types` (`DragState`, `HandleDragStartInput`, etc.): add fields for render scales, canonical lengths, resolved pairing.
- `functions/solve-handle-transition.ts`: keep X guard; ensure conversion remains world→anchor deltas; avoid any implicit normalization that would flatten Y.
- `actions/drag/commit-drag.ts`: when applying `handleDiffs`, also persist `pairing` if present.
- `functions/apply-drag-deltas.ts`: no change for handle drags; marker drag offsets remain as-is (world deltas captured in `start-drag.ts` snapshot).
- Tests: adjust fixtures if needed so `o1` starts paired/colinear; add view-scale assertions; keep crossing tests intact.

## Edge conditions
- Missing paired side: allow the dragged side to move freely; don’t fabricate the complement.
- Alt key: temporarily disables pairing during drag.
- Pairing inference: if explicit is missing, pair when both handles are colinear/opposite; otherwise free.

## Next steps
- Implement Y-unclamp fix, then pair-mirroring with view-space length preservation.
- Wire render scale factors from UI.
- Add/adjust tests above; validate visuals in the spline view. 
