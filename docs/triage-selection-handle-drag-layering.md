# Animation Triage Notes (Selection, Handle Pairing, Drag Inputs, Layering)

## Selection helpers and centralization
- Core helpers live in `packages/animation/src/functions/selection-state-manager.ts` and are used by `packages/animation/src/actions/click-marker.ts`. `isMarkerSelected` is only referenced by selection tests (`packages/animation/src/tests/selection/*`).
- View logic is split across components/actions:
  - `packages/animation/src/components/canvas-sheet/data-point.tsx` derives `isSelected` by checking whether any foreground point is selected (based on `LayerBand` + `selectionState.keypoints`) and filters `selectionPoints` by `selectable` before calling `clickMarker`.
  - `packages/animation/src/actions/click-line.ts` now uses shared helpers for row-foreground keypoints and instance inference.
  - `packages/animation/src/components/canvas-sheet/data-renderer.tsx` uses a track-level selection check (`selectionState.keypoints`) to gate handle rendering, not marker-level selection.
  - `packages/animation/src/subscriptions/update-instanced-track-sources.ts` derives `LayerBand` by collapsing selection into a track-level lookup (string parsing of track keys), which is different from marker-level selection logic.
  - `packages/animation/src/components/animatable-editor.tsx` no longer uses `clickMarker` (value drags run through `startValueDrag`).
- Differences worth preserving if centralized:
  - `selection-state-manager.extractKeypoints` now filters by `selectable`, aligning with `DataPoint` and `click-line`.
  - `DataPoint` treats a marker as selected if any foreground point is selected; helper `isMarkerSelected` returns true only when all keypoints are selected (still divergent).
  - `selection-state-manager` now includes row-foreground helpers that account for `LayerBand` via render markers.

## Handle pairing
- Functionality appears implemented in code:
  - UI computes paired deltas in view space and sends `handleDeltas` (`packages/animation/src/components/canvas-sheet/bezier-handles.tsx`).
  - Pairing inference + base pairing set in `packages/animation/src/actions/drag/start-handle-drag.ts`.
  - Pairing intent + handle diffs stored in `packages/animation/src/actions/drag/update-handle-drag.ts`.
  - Preview/derived geometry applies `handleDiffs` (`packages/animation/src/functions/compute-row-data.ts`).
  - Commit writes diffs to canonical keypoints (`packages/animation/src/actions/drag/commit-drag.ts`).
- Potential cleanup:
  - `update-handle-drag.ts` still supports a legacy path when `handleDeltas` are absent; tests like `packages/animation/src/tests/drag/handle-vertical-move.test.ts` use this path, while the UI uses `handleDeltas`. This may just be test coverage or legacy compatibility.
  - The doc checklist in `packages/animation/docs/handle-pairing-plan.md` likely wasn’t updated after the preview/commit plumbing landed.
- Tests present for vertical freedom and crossing (`packages/animation/src/tests/drag/handle-vertical-move.test.ts`, `packages/animation/src/tests/drag/handle-crossing-persists-world.test.ts`), but no test for view-length preservation when paired.

## Drag interactions standardization
- Canvas spline editor (marker drag):
  - Uses `useDragGestures` to compute normalized deltas from pixel movement and updates via `startDrag`/`updateDrag`/`commitDrag` (`packages/animation/src/components/canvas-sheet/data-point.tsx`).
  - Computes horizontal snapping with `computeDragStamp`, uses `selectionPoints` filtered by `selectable`, and passes `valueScale` derived from row bounds.
- Slider/editor controls:
  - `packages/animation/src/components/animatable-editor.tsx` now uses value-driven drag actions (`startValueDrag`/`updateValueDrag`/`commitValueDrag`/`cancelValueDrag`), reading `state.values` by track key for display. It inserts a keypoint at the current stamp when missing and removes it on cancel/no-move.
  - Direct value edits (`packages/animation/src/components/control-widget.tsx`) call `updateKeypoints`/`updateKeypoint` instead of using the drag pipeline.
- Alignment status:
  - Value-driven drags now normalize through `startValueDrag`/`updateValueDrag` and share the same preview/commit pipeline as canvas drags.
  - Drag previews avoid `updateKeypoints` during a drag; direct edits still use `updateKeypoints`/`updateKeypoint`.
  - `startDrag` now anchors to the dragged marker id (not the first selected marker), avoiding horizontal jumps when multi-selection drags begin.
  - Package-level tests (`npx turbo run test --filter=@semio/animation -- --watch=false`) pass without Firebase emulators.
  - Multi-selection drag anchor offset issue addressed (anchored to dragged marker; regression test added).
- Open issues:
  - Value-driven drags intentionally use literal row bounds (`verticalBounds`), not view padding/offset. Documented in `value-drag.ts`/`drag-state.ts`.
  - Added coverage for value-driven drag normalization vs spline view padding in `packages/animation/src/tests/drag/value-drag-bounds.test.ts`.

## Layering
- Implementation looks current:
  - `LayerBand` is derived in `packages/animation/src/subscriptions/update-instanced-track-sources.ts` and `packages/animation/src/functions/compute-source-rows-from-sources.ts`.
  - Z offsets are applied via `LAYER_BAND_OFFSETS` and `ROW_DEPTH_EPSILON` (`packages/animation/src/components/canvas-sheet/data-point.tsx`, `packages/animation/src/components/canvas-sheet/transition-segment.tsx`, `packages/animation/src/components/canvas-sheet/bezier-handles.tsx`).
  - Global filter planes are in `packages/animation/src/components/canvas-sheet/tracks-renderer.tsx`.
- Docs likely stale:
  - `packages/animation/docs/canvas-sheet-layering-migration.md` and `packages/animation/docs/z-layering-analysis.md` still show pending tasks and describe superseded migration steps.
  - `computeRowBaseZ` is defined but unused (`packages/animation/src/constants.ts`), suggesting the plan shifted to layer bands + filter planes without updating docs.
- Action taken:
  - Removed `packages/animation/docs/canvas-sheet-layering-migration.md`.
  - Removed `packages/animation/docs/z-layering-analysis.md`.
