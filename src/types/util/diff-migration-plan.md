# Diff Schema Adoption Plan

This doc tracks adoption of the explicit diff schema (`types/util/diff.ts`) and the preview/commit pipeline. It notes what is done vs. pending, and proposes next steps to address recompute and preview/commit mismatch issues.

## Status
- [x] Types: `diff.ts` defines Update/Delete/Insert/Reorder/Handle diffs with pairing; docstrings added.
- [x] DragState: Carries `pendingDiffs`, `pendingSelectionCleanups`, and cached `ProjectedTrackView[]` alongside handle deltas/snapshots.
- [x] Derived snapshot: Preview cache built per TrackKey via `computeRowData`; `buildDerivedSnapshot` reuses cached projections for preview tracks.
- [x] Preview violations/geometry: Per-entry overlays keyed by TrackKey; global rows no longer reuse a single preview track per base `trackId`.
- [x] Commit: Replays cached track diff ops from `dragContext` when available; selection cleanup plumbed from drag preview cache.
- [ ] Tests: Existing preview tests not sensitive to multi-instance/global rows.

## Key type surfaces to update

1) **DragState / drag snapshots**
   - CURRENT: `pendingDiffs`, `pendingSelectionCleanups`, and cached `ProjectedTrackView[]` are stored on drag context; handle diffs still ad hoc.
   - PLAN: Emit handle/pairing deltas as ops and fold into `pendingDiffs`.

2) **DerivedSnapshot / row computed data**
   - CURRENT: Rows populate a TrackKey-indexed preview cache (diffs + projected points) reused by derived tracks; still recomputed per row.
   - PLAN: Reuse cached ops across rows (incremental rebuild) and reduce recomputation churn.

3) **TrackDiff computation / application types**
   - CURRENT: `computeDragDiffOps` returns implicit shapes; commit applies ad-hoc loops.
   - PLAN: Emit/accept `TrackDiffOp[]`, including delete/insert/reorder; fold pairing into transitions.

4) **Handle diffs**
   - CURRENT: free-form `handleDiffs`.
   - PLAN: Emit `HandleDiff` ops during handle drags; merge with other ops for preview/commit.

5) **Selection / gesture stability**
   - PLAN unchanged; ensure selection cleanup aligns with delete ops.

6) **Renderer data plumbing**
   - PLAN unchanged; consume projected overlays instead of ad hoc patched points.

7) **Testing utilities**
   - PLAN unchanged; add multi-instance/global row regression.

## Types to add/adjust

- Extend `DragState` with an optional `pendingDiffs: DiffOp[]` (done; also stores selection cleanup and projected views).
- Consider a `ProjectedTrackView` type: `{ trackKey: string; points: Keypoint<RawValue>[]; appliedDiffs: TrackDiffOp[] }` for preview cache. (done)
- Add explicit `DeleteKeypointDiff` / `InsertKeypointDiff` handling to track diff application types.
- Update any transition-related types to include `pairing?: TransitionPairing` (already reflected in the diff schema).

## Migration notes

- Start by typing the diff pipeline end-to-end (compute → apply) without altering behavior, then adopt `DiffOp` usage.
- Maintain id stability: diffs must update/delete by id; avoid structural replacements.
- Preview remains non-destructive; commit applies the same `TrackDiffOp[]` plus any selection cleanup tied to `DeleteKeypointDiff`.

## Current modification patterns (store ops invoked from UI)

- **Marker drag (horizontal/vertical/both):** produces `updateKeypoint` diffs (stamp/value) and `reorderKeypoints` when stamps reorder; selection is preserved. Overwrite/erase is currently done ad hoc in commit when stamps coincide.
- **Handle drag:** produces changes to transitions (in/out) today via `handleDiffs`; planned to map to `HandleDiff`/`UpdateKeypointDiff.transitions` (including pairing) so the same diff set is shared between preview and commit.
- **Pairing toggle (future):** pairing can change independently or alongside handle movement; should be expressed as `UpdateKeypointDiff.transitions.pairing` or `HandleDiff` pairing.
- **Keypoint insert/delete (UI actions, not drag):** today handled via bespoke actions; in the schema these would be `InsertKeypointDiff` / `DeleteKeypointDiff`.
- **Reorder:** emitted when stamps change order; already modeled as `reorderKeypoints`.

## Expected behavior for diff application (preview vs commit)

- **Preview:** Apply `TrackDiffOp[]` non-destructively to build adjusted points; for overwrite projection, hide non-dragged coincident points in the dragged track in a projected view (render-time) without mutating ids or data. Handles/pairing changes use the same diff ops; no canonical mutation.
- **Commit:** Apply the same `TrackDiffOp[]` to canonical tracks. Perform overwrite/erase as explicit `DeleteKeypointDiff` (keep dragged id, remove others) and resort. Clean selection of removed ids. Pairing/handle changes are persisted via the same diffs.

## Integration outline for the new drag diff ops (proposal)

- **Diff computation (replacement for `computeTrackDiffsForDrag`):** use `computeDragDiffOps` to emit `TrackDiffOp[]` + `selectionCleanup`. It computes update/reorder from the captured snapshot, and emits `DeleteKeypointDiff` when the dragged stamp collides (anchor id wins). It also returns `projectedPoints` for preview reuse.
- **Preview plumbing:** in derived builders (`build-derived-snapshot`/`compute-row-data`), replace the per-row recompute with the proposal helper: project preview tracks via `computeDragDiffOps(...).projectedPoints` and cache per-track (future `ProjectedTrackView`). This removes mid-drag store mutations and avoids re-init thrash.
- **Commit:** swap the current commit loop + `collapseCoincidentKeypoints` for applying the same `TrackDiffOp[]` to the canonical track (`applyTrackDiffOpsToTrack`) and then apply the optional `selectionCleanup` to drop deleted ids from selection. No extra overwrite logic needed.
- **Handle/pairing path:** emit handle/pairing deltas as `HandleDiff`/`UpdateKeypointDiff.transitions` and merge into the same op set before preview/commit, instead of patching `dragState.handleDiffs`.
- **Drag state:** when storing `pendingDiffs`, retain the baseline snapshot used for `computeDragDiffOps` so replay is deterministic if the store changes mid-drag.
- **Legacy parity note:** tests (`tests/drag/drag-diff-ops.test.ts`) document that the current pipeline does not delete on collision; the new ops do, providing the desired overwrite behavior without UI thrash.

## Additional steps to address preview/commit mismatches and recompute

- Instance-aware overlays: Build projected tracks per TrackKey (namespace/instance/track) and compute violations/interpolators per entry; aggregate for rows. Avoid collapsing by base `trackId`.
- Centralize inference: Apply default transitions/pairing in the overlay builder (once), not in multiple consumers.
- Incremental derived rebuild: Cache canonical derived; recompute only affected TrackKeys when `pendingDiffs` change.
- Tests: Add regression that drags a shared track on the global row and asserts preview violations match post-commit recomputation using the same ops.

## Notes / findings for handoff

- Preview vs commit mismatch (global row):
  - Per-entry overlays now keyed by TrackKey and reused by derived tracks; preview cache also feeds commit via `pendingDiffs`/selection cleanup.
  - Tests to add: A full-store regression on the global row dragging a shared track marker; assert preview violations == recomputed violations from the projected track for that instance, and preview == post-commit.
- Implementation notes:
  - Emit `DiffOp[]` during drag (marker + handle), including pairing in transitions/HandleDiff.
  - Overlay builder should apply default transitions/pairing once; preview consumers should not re-infer.
  - Incremental derived rebuild: recompute overlays/violations/interpolators only for touched TrackKeys; reuse canonical derived elsewhere.
  - Selection cleanup now plumbed through drag preview cache; handle diffs still ad hoc.
