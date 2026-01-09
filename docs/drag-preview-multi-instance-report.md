# Multi-instance Drag Preview: Problem and Fix Options

## Problem Summary
Dragging keypoints previews only the active instance. Other instances that share the same track stay on canonical data until commit, even though the canonical track data is shared and will affect all instances after commit. This causes a visible mismatch between the active instance and the other instances during drag.

Two issues are interleaved:
- Derived preview generation is gated to the active instance, so preview points and preview interpolators exist only for that instance.
- UI suppression logic (`includesDraggedTrack`) relies on ad-hoc string parsing, which is fragile and unrelated to the preview scope problem.

## Root Cause (current code path)

### Derived preview gating is instance-scoped
- In `packages/animation/src/functions/compute-row-data.ts`:
  - `shouldPreview` only becomes true when `selectionState.instanceId === dragState.instanceId`.
  - When projecting per-row tracks, `usePreview` is gated by `datum.instanceId === dragState.instanceId`.
  - Result: preview points are only applied to the active instance.
- In `packages/animation/src/functions/build-derived-snapshot.ts`:
  - Preview interpolators are built from `dragPreviewCache.trackViews`.
  - `trackViews` are only populated for row entries that passed the instance gate in `computeRowData`.
  - Result: preview interpolators also exist only for the active instance.
- Preview violations are likewise gated to the active instance, so violations for other instances do not update during drag.

### UI suppression uses string parsing
- `packages/animation/src/components/canvas-sheet/data-point.tsx` and
  `packages/animation/src/components/canvas-sheet/transition-segment.tsx` split `trackKey` strings to infer base track ids.
- This is only used to disable spring animations while dragging, but it couples UI behavior to key formats and adds cost to render-time logic.
- It does not cause the preview scope problem, but it should be fixed to avoid fragile string parsing.

## Proposed Fix (recommended)

### Core change: preview per trackId, not per instance
1. Build a `draggedTrackIds` set from the drag state (see the path-splitting section below for recommended storage).
2. Compute preview points once per `trackId` and reuse them across all row entries with the same `trackId`.
3. Apply preview points to every `trackKey` that references the dragged track id, regardless of instance.
4. Populate `dragPreviewCache.trackViews` for every `trackKey` that uses preview points, so `buildDerivedSnapshot` builds preview interpolators for all instances.
5. Recompute preview violations for every affected instance (not just the active one) so derived warnings stay in sync.

### Why this fits the model
- Tracks are canonical and shared across instances. A drag modifies the track points, so all instances should preview that change.
- The drag selection remains instance-scoped (only the active instance defines which points move), but the projected track points are global and should be reused for all instances.

### Implementation sketch (key touch points)
- `compute-row-data.ts`:
  - Keep selection/drag gating for generating preview diffs (only when `dragState` is valid).
  - Remove the `datum.instanceId === dragState.instanceId` restriction when applying preview points.
  - Use `draggedTrackIds.has(datum.trackId)` to choose preview points.
  - Always record `previewCache.trackViews` for every affected `trackKey`.
  - When computing preview violations, use the same `draggedTrackIds` gating instead of instance equality.
- `build-derived-snapshot.ts`:
  - No structural change required once `trackViews` includes all trackKeys.

### Expected behavior
- While dragging, all instances render the same previewed track values (as they will after commit).
- Canonical track data still only changes on commit, so data integrity is preserved.
- Violations, interpolators, and previews stay consistent across instances.

## Alternatives and Tradeoffs

### Option A (recommended): Track-level preview overlay (described above)
- Clarity: High. Matches shared track data model.
- Efficiency: Good. `computeDragDiffOps` runs once per trackId per row, but previews are reused across instances.
- Robustness: High. Keeps selection model unchanged and reduces UI coupling to instance ids.

### Option B: Centralized preview overlays in `dragState`
- Store a precomputed `projectedTracks` map in `dragState` and bypass per-row diff computation.
- Pros: Can reduce repeated preview computation.
- Cons: Adds more mutation and state synchronization, complicates derived orchestrator flow, and needs careful invalidation when canonical inputs change.

### Option C: Expand selection to multiple instances
- Treat selection as multi-instance and compute diffs per instance.
- Pros: Gives per-instance selection semantics.
- Cons: Violates the current single-instance selection model, increases complexity, and is not necessary to fix preview scope.

### Option D: Mutate canonical tracks during drag
- Update canonical data and rely on derived snapshot to re-render all instances.
- Pros: Simple preview propagation.
- Cons: Violates the requirement to only commit on drag end; introduces undo complexity and potential data corruption.

**Recommendation:** Option A is the simplest and most consistent with the shared track model.

## Handling Track Key Path Splitting

### Problem
`includesDraggedTrack` in `data-point.tsx` and `transition-segment.tsx` parses strings to infer track ids. This is fragile and makes UI logic depend on the formatting of track keys (namespace/instance/trackId) and derived track suffixes (e.g., `.x`). It also mixes preview intent with render-time string parsing.

### Recommended solution: precomputed track id sets
- Add a `dragState.draggedTrackIds` set computed at drag start (or stored in `derivedSnapshot.dragOverlay`).
- Populate the set with:
  - The base track ids from `selectionState.keypoints.keys()` or `dragState.trackSnapshots`.
  - Any derived track ids that should be treated as part of the same drag (e.g., `position.x`, `position.y`), using explicit metadata rather than splitting at render time.
- Update UI components to check membership directly:
  - `includesDraggedTrack = points.some(p => draggedTrackIds.has(p.trackId))`
  - `includesDraggedTrack = sourceRow.data.some(d => draggedTrackIds.has(d.trackId))`

This removes string parsing from hot render paths and makes the UI logic independent of key formatting.

### Alternative: propagate `trackIdBase` to frames and rows
- Ensure `SourceRowData` and `InstancedFrameInfo` always carry `trackIdBase`.
- Use `trackIdBase` instead of parsing `trackKey` or suffixes.
- This is a good complement to the set approach but should not be required in components if `draggedTrackIds` is precomputed.

### Avoid in components: `parseTrackKey` or manual splitting
- A centralized `parseTrackKey` helper is still string parsing and keeps format coupling in UI code.
- Use it once when building `draggedTrackIds`, not on every render.

## Recommendation and Next Steps
- Implement Option A (track-level preview overlay) and remove instance gating in preview application.
- Add `dragState.draggedTrackIds` (or `derivedSnapshot.dragOverlay.draggedTrackIds`) and update UI components to use it instead of string parsing.
- Update preview violations to run for all affected instances.
- Validate with a multi-instance drag scenario and ensure canonical data remains unchanged until commit.
