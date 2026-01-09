# On store init
  1. `useDefaultAnimationStore.getState().initAnimationSubscriptions()` runs immediately after the default store is created in `packages/animation/src/store.ts`.
  2. `createAnimationStore` normalizes inputs, creates a store, and then calls `store.getState().initAnimationSubscriptions()`.
  3. Returns: both paths end with subscriptions registered and a cleanup function available from `initAnimationSubscriptions`.

# `initAnimationSubscriptions`
Sets up all store subscriptions, including the derived snapshot orchestrator, and returns a cleanup function.
  1. Checks `api.__derivedCleanup`; if present, calls it and clears the cached cleanup to prevent duplicate subscriptions.
  2. Builds the initializer list in order: `updatePlayerLoop`, `updateOverallDuration`, `initDerivedOrchestrator`, `updateInstancedTrackSources`, `updateGlobalSources`, `updateSourceRowIds`, `updateConsolidatedSourceRow`.
  3. Calls each initializer with `(api, set, get)` and collects their unsubscribe callbacks.
    1. `initDerivedOrchestrator`: orchestrates derived snapshot + drag preview updates.
      1. Captures a `latestSnapshot` reference for quick reuse on player ticks.
      2. Reads current store state and builds `DerivedInputs` (`tracks`, `animatables`, `namespaces`, `animations`, `instancedTrackSources`, `dragState`, `selectionState`, `editorViews`, `sourceRowIds`).
      3. Defines `maybeApplyDerived(inputs)` to recompute derived state when inputs change.
        1. Computes a `versionHint` from `latestSnapshot?.version` or `currentState.derivedSnapshot?.version`, then increments it.
        2. Computes derived outputs (inline `computeDerivedState`).
          1. `buildDerivedSnapshot`: builds canonical tracks, row render outputs, and drag overlays.
            1. Initializes caches (`derivedTracks`, `canonicalViolationsByTrackKey`, `trackContextByKey`).
            2. If `dragState` exists, creates a `dragOverlay` scaffold with `draggedTrackIds` and a per-track preview cache.
            3. Defines `applyEffectiveTransitions(points)` to clamp transitions per segment and return points with effective `in/out` transitions.
            4. Canonical track pass (namespaces -> instances -> tracks).
              1. Resolves `animation`, `track`, and `animatable`; skips if any are missing.
              2. Builds `trackKey = buildTrackKey(namespaceId, instanceId, trackId)`.
              3. Applies effective transitions to track points.
              4. Builds `canonicalTrack` and calls `computeTrackInterpolator` to build the canonical interpolator.
              5. Builds the derivative interpolator via `computeDerivativeInterpolator` using the animation duration.
              6. Calls `computeTrackViolations` to produce canonical violations.
              7. Stores canonical interpolator, derivative, violations, and metadata on `derivedTracks[trackKey]`.
            5. Row pass (each `instancedTrackSources` row).
              1. Calls `computeRowData` (proposal below) with canonical violations, animatables, drag/selection state, and the preview cache.
              2. Builds `trackKeys` for the row entries and stores `{ id, trackKeys, computed }` in `derivedRows`.
            6. Preview interpolator pass (only if drag overlay exists).
              1. For each preview `trackKey`, applies effective transitions to preview points.
              2. Calls `computeTrackInterpolator` and `computeTrackViolations` for the preview track.
              3. Stores `derivedTracks[trackKey].preview` for downstream preview interpolation/violations.
            7. Builds the `dragOverlay` by attaching:
              1. `draggedTrackIds` (precomputed set used by rendering).
              2. `state` with `pendingDiffs` and `pendingSelectionCleanups` for commit parity.
              3. Note: `projectedTracks` remains part of the canonical drag state (not the overlay) unless explicitly migrated.
            8. Optionally builds a shared `renderSampleCache` when row data requests shared samples.
            9. Returns `DerivedSnapshot` with `version`, `dragOverlay`, `tracks`, `rows`, and optional `renderSampleCache`.
          2. `projectRowVerticalAxes` projects per-view vertical ranges onto row data.
            1. Normalizes `sourceRowIds` into flat/spline row lists.
            2. Builds view contexts from `editorViews` (track render mode, vertical axis mode, row set, optional uniform range).
            3. For each row, computes a per-view `VerticalAxisRange` (uniform or row-local), with spline padding when applicable.
            4. Returns updated row data plus a `changed` flag.
          3. Builds `trackInterpolators` and `canonicalViolations` from `snapshot.tracks`, keyed by `getLookup(namespaceId, animatableId)`.
          4. Replaces each row's `computed` data with the view-adjusted version from `projectRowVerticalAxes`.
          5. Calls `computeValueAndVelocityMaps` to compute current values/velocities from the adjusted snapshot.
          6. Returns `{ snapshot, trackInterpolators, canonicalViolations, values, velocities }`.
        3. Logs a derived event (version, track count, row count).
        4. Writes `derivedSnapshot`, `trackInterpolators`, `violations`, `values`, and `velocities` into the store.
        5. Returns to the caller.
      4. Subscribes to store slices (`tracks`, `animatables`, `namespaces`, `animations`, `instancedTrackSources`, `dragState`, `selectionState`, `editorViews`, `sourceRowIds`) with shallow equality.
        1. On any change, calls `maybeApplyDerived` with the updated inputs.
        2. Returns to the subscription callback.
      5. Subscribes to the player store (`stamp`, `running`, `speed`, `_currentDirection`).
        1. If `latestSnapshot` exists, calls `computeValueAndVelocityMaps` and updates store `values`/`velocities`.
        2. Returns to the player subscription callback.
      6. Calls `maybeApplyDerived(initialInputs)` immediately to bootstrap derived data.
      7. Returns a cleanup function that unsubscribes both store and player subscriptions.
    2. Other initializers (`updatePlayerLoop`, `updateOverallDuration`, `updateInstancedTrackSources`, `updateGlobalSources`, `updateSourceRowIds`, `updateConsolidatedSourceRow`) register their own subscriptions and return their own cleanup functions.
  4. Stores the combined cleanup in `api.__derivedCleanup` and returns it.

# `computeValueAndVelocityMaps`
Builds live `values` and `velocities` maps from the derived snapshot and player state (unchanged from current flow).
  1. If `snapshot` is missing, returns empty maps.
  2. Reads player `stamp`, `running`, `speed`, and `_currentDirection` to compute a velocity multiplier.
  3. Iterates `snapshot.tracks` and for each track:
    1. Uses `TrackDerivedState.metadata` when available to avoid parsing `TrackInstanceKey`.
    2. Falls back to parsing `trackKey` if metadata is missing.
    3. Builds a lookup key using `getLookup(namespaceId, animatableId)`.
    4. Evaluates the canonical interpolator at the current stamp and stores the result in `values`.
    5. Evaluates the canonical derivative:
      1. When running, scales by speed and direction.
      2. When stopped, replaces with `matchingIdentityRawValue` (zero velocity shape).
    6. Stores the velocity (or `undefined`) in `velocities`.
  4. Returns `{ values, velocities }`.

# `computeRowData` (proposal)
Computes per-row render outputs with preview overlays. The output is `RowDerivedData` (selection frames, render payload, bounds, violations).
  1. Builds row context (`trackIds`, `trackKeys`, `instanceIds`, `namespaceIds`) and a `trackContextByTrackId` map (prefers the active drag instance for anchors).
  2. Filters canonical violations to the row's track ids and the row's instance/namespace scope.
  3. Computes `valueBounds` via `computeVerticalBounds` (canonical-only).
  4. Determines preview gating:
    1. `shouldPreview` is true only when `dragState` exists and `selectionState.instanceId === dragState.instanceId`.
    2. Builds `draggedTrackIds` from `dragState.trackSnapshots` (or `selectionState.keypoints.keys()` fallback).
  5. If preview is enabled, computes per-track projections:
    1. For each `trackId` in `draggedTrackIds`, call `computeDragDiffOps` with the base or snapshot points and constraint bounds.
    2. Overlay `handleDiffs` by replacing `transitions.in/out/pairing` on preview points.
    3. Store `{ projectedPoints, framePoints, diffs, selectionCleanup }` in `previewByTrackId`.
  6. Build marker outputs (row render space):
    1. For each row entry, select preview points when `trackId` is in `draggedTrackIds`.
    2. Convert keypoint stamp/value to row-space `x/y` and emit `RenderMarker` entries.
  7. Build selection frames (selection/range logic):
    1. Group markers by stamp to build `SelectionFrame[]` entries.
    2. Reference markers by id and carry selection metadata only (no duplicated positions).
  8. Build handle outputs (editing only):
    1. Resolve raw/effective handle world positions from transitions and clamp results.
    2. Emit `RenderHandle` entries (raw + effective positions, pairing, and side).
  9. Build line segments (polyline samples):
    1. For each track segment, sample points at fixed resolution.
    2. Store the sample directly per segment (row space), or use a shared sample reference with a range + affine transform.
    3. Emit `RenderSegment` entries for hit-testing and drawing.
 10. Compute preview violations:
    1. For each row entry whose `trackId` is in `draggedTrackIds`, recompute violations using preview points.
    2. Merge preview violations into canonical violations for all instances (not just the active instance).
 11. Build `violationSet` and return `RowDerivedData` with selection, render payload, bounds, and violations.

# `computeDragDiffOps`
Produces per-track drag diffs and projected points; used by `computeRowData` and `commitDrag`.
  1. If `dragState` is missing or `selection.instanceId` does not match, returns base points and no diffs.
  2. Applies `applyDragDeltas` to each base point to produce `updatedPoints`.
    1. Skips points unless they are selected (anchor or selected keypoint) or have handle offsets.
    2. Applies horizontal stamp delta when the drag axis includes horizontal, clamping to `[0, 1]`.
    3. Applies vertical value delta when the drag axis includes vertical, scaling by bounds or value scale, then clamping and applying precision.
    4. Applies handle offsets to `transitions.in/out` for explicit handle drags.
  3. Compares `updatedPoints` to base points to build `updateKeypoint` diffs (stamp/value/transitions).
  4. Detects anchor collisions and emits `deleteKeypoint` diffs for coincident points.
  5. Computes a `reorderKeypoints` diff when the sorted order differs from the baseline.
  6. Builds `selectionCleanup` when points were removed.
  7. Applies diffs to produce `projectedPoints` and `framePoints`.
  8. Returns `{ diffs, projectedPoints, framePoints, selectionCleanup }`.

# Alignment considerations
  1. `SelectionFrame[]` should reference `RenderMarker.id` (stable keypoint id) so selection logic does not duplicate positions. Preserve anchor ids during drag to avoid selection churn.
  2. Selection logic currently relies on `InstancedFrameInfo` in `selection-state-manager`/`click-line`; those flows must be migrated to `SelectionFrame[]` + `RenderMarker` without rejoining positions.
  3. Populate `TrackDerivedState.metadata` for all tracks and prefer it in `computeValueAndVelocityMaps` to avoid parsing `TrackInstanceKey`.
  4. `RenderSampleCache` + `SegmentSample` transforms must apply to vertex positions (not object scale) so line thickness stays screen-space.
  5. `RenderMarker.value` is numeric; for non-numeric `ValueType` tracks either provide a numeric mapping or skip line/marker rendering with an explicit guard.
  6. `DragOverlay` stays derived-only; keep canonical `DragState` as the commit source and ensure `pendingDiffs`/`pendingSelectionCleanups` remain in sync.
