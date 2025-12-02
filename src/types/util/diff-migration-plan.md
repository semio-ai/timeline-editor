# Diff Schema Adoption Plan (types only, no code changes yet)

This document lists type surfaces that would need updates to adopt the explicit diff schema (with pairing support) defined in `types/util/diff.ts`. No code changes are applied here—this is an outline for future work.

## Key type surfaces to update

1) **DragState / drag snapshots**
   - `DragState` today carries `handleDiffs` and per-track `trackSnapshots`. Introduce a typed field for `pendingDiffs: DiffOp[]` (from `types/util/diff.ts`) and thread it through preview/commit. Optionally deprecate ad-hoc `handleDiffs` in favor of `HandleDiff` ops.
   - Ensure `DragState.anchor` includes `pairing` context if we start capturing it during drag.

2) **DerivedSnapshot / row computed data**
   - If we project a preview state from diffs, add optional fields to derived rows to cache the diff set or projected track map keyed by `trackId` (using `TrackDiffOp[]`/`DiffOp[]` types). This keeps preview/commit in sync and avoids ad hoc filters.

3) **TrackDiff computation / application types**
   - `computeTrackDiffsForDrag` / `applyTrackDiffsToPoints` / `applyTrackDiffsToTrack` should return/accept `TrackDiffOp[]` instead of the current implicit shape; add `deleteKeypoint` and `insertKeypoint` branches. Fold pairing into `transitions` where relevant.

4) **Handle diffs**
   - Replace free-form `handleDiffs` maps with `HandleDiff` ops. Drag code paths (start/update) should emit `HandleDiff` when pairing/out/in changes are requested.

5) **Selection / gesture stability**
   - Ensure selection types acknowledge that a `deleteKeypoint` may occur at commit; add a helper type for selection cleanup expectations (e.g., `SelectionCleanup { trackId: string; removedIds: string[] }`) if needed.

6) **Renderer data plumbing**
   - Any renderer types that currently read ad hoc projected points should accept a well-typed “projected view” built from `TrackDiffOp[]` so marker/geometry consumers stay consistent.

7) **Testing utilities**
   - Fixture builders and test store helpers should accept `DiffOp[]` (or `TrackDiffOp[]`) to build preview/commit scenarios in a consistent, typed way.

## Types to add/adjust

- Extend `DragState` with an optional `pendingDiffs: DiffOp[]`.
- Consider a `ProjectedTrackView` type: `{ trackId: string; points: Keypoint<RawValue>[]; appliedDiffs: TrackDiffOp[] }` for preview cache.
- Add explicit `DeleteKeypointDiff` / `InsertKeypointDiff` handling to track diff application types.
- Update any transition-related types to include `pairing?: TransitionPairing` (already reflected in the diff schema).

## Migration notes

- Start by typing the diff pipeline end-to-end (compute → apply) without altering behavior. Only after the types are in place should implementation adopt `DiffOp` usage.
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
