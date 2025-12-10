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
- Keep neighbor ids/stamp/value for both directions. Render scales stay in the UI; no need to store them in drag state.

### 2) Drag update (`actions/drag/update-handle-drag.ts`)
- Compute next CP from pointer + `normalizedValueDelta` (no Y clamp), then apply X non-crossing.
- UI computes both handle deltas in data space (mirrored as needed using render scales) and passes `{ in?, out?, pairing? }` plus flags (Alt, within snap tolerance). Store resolves current transitions (canonical + handleDiffs) and applies or ignores the paired side based on pairing/modifiers.
- Keep precision handling as before; do not touch canonical transitions.

### 3) UI wiring (`components/canvas-sheet/bezier-handles.tsx`)
- Compute per-track render scales locally to mirror handles and evaluate snap-to-flat; send data-space deltas for both handles plus pairing intent/flags to the action. Do not thread view scales into drag state.
- Maintain existing pointer → normalizedValueDelta path.

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
- `actions/drag/update-handle-drag.ts`: remove domain Y clamp; keep `clampHandleAgainstOwnKeypointX`; accept UI-provided `{ in?, out?, pairing? }` deltas/flags, resolve transitions with current diffs, and write `pairing` into `handleDiffs`.
- `actions/drag/start-handle-drag.ts`: resolve canonical in/out vectors (world deltas) via transitions + neighbors; stash canonical lengths/pairing and neighbor ids/stamp/value (no view-scale storage).
- `components/canvas-sheet/bezier-handles.tsx`: compute render scales locally, mirror handles in data space, evaluate snap-to-flat, and send ready `{ in?, out?, pairing? }` payload + flags; keep pointer → normalizedValueDelta path.
- `types` (`DragState`, `HandleDragStartInput`, etc.): add fields for canonical lengths/paired context and UI flags (Alt/within snap tolerance); view scales stay in the UI.
- `functions/solve-handle-transition.ts`: keep X guard; ensure conversion remains world→anchor deltas; avoid any implicit normalization that would flatten Y.
- `actions/drag/commit-drag.ts`: when applying `handleDiffs`, also persist `pairing` if present.
- `functions/apply-drag-deltas.ts`: no change for handle drags; marker drag offsets remain as-is (world deltas captured in `start-drag.ts` snapshot).
- Tests: adjust fixtures if needed so `o1` starts paired/colinear; add view-scale assertions; keep crossing tests intact.

## Edge conditions
- Missing paired side: allow the dragged side to move freely; don’t fabricate the complement.
- Alt key: temporarily disables pairing during drag.
- Pairing inference: if explicit is missing, pair when both handles are colinear/opposite; otherwise free.

## Data vs view responsibilities
- View: keep render/pixel math local. Each update, compute both handle deltas in data space (anchor-relative) using render scales, determine pairing intent flags (Alt, within snap tolerance), and send a ready `{ in?, out?, pairing? }` payload. No view scales live in drag state/store.
- Store/actions: decide whether/how to apply the provided deltas based on current pairing state and modifiers; persist pairing in the `HandleDiff` so preview/commit match. Store stays pixel-free.

## Next steps
- Implement Y-unclamp fix, then pair-mirroring with view-space length preservation.
- Wire render scale factors from UI.
- Add/adjust tests above; validate visuals in the spline view.

## Execution checklist
- [x] Types: keep `HandleDiff` as `{ in?, out?, pairing? }` (data-space); update handle drag inputs/state to accept UI-provided data-space deltas and intent flags (Alt, within snap tolerance) without threading viewScale into drag state.
- [x] Start handle drag: resolve canonical in/out vectors and pairing for context, stash neighbor ids/stamp/value; no view-scale storage required.
- [x] Update handle drag: remove Y clamp; apply X guard; accept precomputed deltas/flags from UI; write a single `HandleDiff` with both sides + pairing into `pendingDiffs`/`handleDiffs` based on conditions.
- [ ] Preview plumbing: fold `HandleDiff` (including pairing) into `computeRowData`/derived geometry; stop ad-hoc transition patching once ops path is live.
- [x] Commit: replay `HandleDiff` pairing/in/out into canonical transitions; ensure pairing persists.
- [x] UI wiring: component computes mirrored deltas and snap-to-flat tolerance in data space using render scales, then sends ready `{ in?, out?, pairing?, flags }` to the action; gesture hook stays pixel-only.
- [ ] Tests: paired view-length preservation with non-uniform scales; free-handle vertical freedom; crossing regression unchanged.

## Execution plan: migrate handle drags to ops in `pendingDiffs`

1) **Types & plumbing**
   - Keep `HandleDiff` op shape `{ type: "handle"; trackId; keypointId; changes: { in?, out?, pairing? } }` and allow `pendingDiffs` to carry it; update handle drag input/state to accept UI-provided deltas + intent flags (no viewScale in state).

2) **Start handle drag (`actions/drag/start-handle-drag.ts`)**
   - Resolve world-space control points for both sides via neighbors + transitions; capture explicit/inferred pairing and neighbor ids/stamp/value for context.

3) **Update handle drag (`actions/drag/update-handle-drag.ts`)**
   - Remove vertical/value clamping; keep X non-crossing guard only.
   - Accept precomputed data-space deltas `{ in?, out?, pairing? }` + flags (Alt, within snap tolerance) from UI; apply pairing conditions and emit a single `HandleDiff` per update, overwriting prior entries for the same keypoint/side.

4) **Preview/commit reuse**
   - Preview: `computeRowData` should fold `HandleDiff` ops into projected points/transitions (drop legacy `handleDiffs` map).
   - Commit: `commit-drag.ts` should replay `HandleDiff` from `pendingDiffs` into canonical transitions and selection cleanup as needed.

5) **UI wiring (`components/canvas-sheet/bezier-handles.tsx`)**
   - Compute render scales locally, mirror handles and snap-to-flat in data space, and send ready `{ in?, out?, pairing?, flags }`; keep pointer → normalizedValueDelta path unchanged.

6) **Tests**
   - Paired mirror with preserved view-length on `o1` (non-uniform `viewScaleY`), both in/out drags.
   - Free-handle drag allows full vertical motion when pairing off.
   - Crossing regression: handle deltas survive marker crossing; preview == commit.

7) **Cleanup**
   - Remove legacy `handleDiffs` map once ops path is live.
   - Update docs/README to reference `HandleDiff` ops and pairing preservation. 

## Pairing inference in row computation
- Ensure row computation (`compute-row-data` / `compute-frames`) consistently infers and assigns `pairing` on `InstancedFrameInfo` from effective transitions for both canonical and preview paths. The same inference should run when previewing handle diffs so paired status is explicit in frames/violations. 
