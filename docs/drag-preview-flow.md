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
          1. `buildDerivedSnapshot`: builds canonical tracks, row data, and preview overlays.
            1. Initializes caches (`derivedTracks`, `canonicalViolationsByTrackKey`, `trackContextByKey`) plus a `renderSampleCache` for shared polyline samples.
            2. If preview is active (`dragState` + matching `selectionState.instanceId`), resolves `draggedTrackIds` and creates `dragPreviewCache` (`trackViews`, `pendingDiffsByTrackId`, `selectionCleanups`, `draggedTrackIds`).
            3. Canonical track pass (namespaces -> instances -> tracks).
              1. Resolves `animation`, `track`, and `animatable`; skips if any are missing.
              2. Builds `trackKey = buildTrackKey(namespaceId, instanceId, trackId)`.
              3. Calls `computeTrackInterpolator` (see section) to build the canonical interpolator.
              4. Builds the derivative interpolator via `computeDerivativeInterpolator` using the animation duration.
              5. Calls `computeTrackViolations` with a duration adjusted by the instance timescale.
                - Note: the interpolator is evaluated in world time (instance timescale/offset applied), so velocity/rate violations can legitimately differ per instance.
              6. Stores canonical interpolator, derivative, violations, and metadata on `derivedTracks[trackKey]`.
            4. Row pass (each `instancedTrackSources` row).
              1. Calls `computeRowData` (see section) with canonical violations, animatables, drag/selection state, the preview cache, and `renderSampleCache`.
              2. Builds `trackKeys` for the row entries and stores `{ id, trackKeys, computed }` in `derivedRows`.
            5. Preview interpolator pass (only if `dragPreviewCache` exists).
              1. For each preview `trackKey`, uses the projected points to build a preview track.
              2. Calls `computeTrackInterpolator` and `computeTrackViolations` with the timescale-adjusted duration.
              3. Stores `derivedTracks[trackKey].preview` for downstream preview interpolation/violations.
            6. Builds the `dragContext` by merging preview cache outputs into `dragState`.
              1. `pendingDiffs` from `dragPreviewCache.pendingDiffsByTrackId` if present, else `dragState.pendingDiffs`.
              2. `pendingSelectionCleanups` from `dragPreviewCache.selectionCleanups` if present, else `dragState.pendingSelectionCleanups`.
              3. `projectedTracks` from `dragPreviewCache.trackViews` if present, else `dragState.projectedTracks`.
            7. Returns `DerivedSnapshot` with `version`, `dragContext`, `dragOverlay`, `tracks`, `rows`, and optional `renderSampleCache`.
          2. `projectRowVerticalAxes` projects per-view vertical ranges onto row data.
            1. Normalizes `sourceRowIds` into flat/spline row lists.
            2. Builds view contexts from `editorViews` (track render mode, vertical axis mode, row set, optional uniform range).
            3. For each row, computes a per-view `VerticalAxisRange` (uniform or row-local), with spline padding when applicable.
            4. Returns updated row data plus a `changed` flag (used to decide whether to replace rows).
          3. Builds `trackInterpolators` and `canonicalViolations` from `snapshot.tracks`, keyed by `trackKey` (`${namespaceId}/${instanceId}/${trackId}`).
          4. Replaces each row's `computed` data with the view-adjusted version from `projectRowVerticalAxes`.
          5. Calls `computeValueAndVelocityMaps` (see section) to compute current values/velocities from the adjusted snapshot.
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
Builds live `values` and `velocities` maps from the derived snapshot and player state.
  1. If `snapshot` is missing, returns empty maps.
  2. Reads player `stamp`, `running`, `speed`, and `_currentDirection` to compute a velocity multiplier.
  3. Iterates `snapshot.tracks` and for each track:
    1. Reads instance `timescale`/`offset` from track metadata.
    2. Uses the `trackKey` (`${namespaceId}/${instanceId}/${trackId}`) directly as the lookup key.
    3. Converts the player stamp from world → local with `computeLocalStamp` and evaluates the preview interpolator when the track is actively dragged (falls back to canonical otherwise).
    4. Evaluates the canonical derivative:
      1. Uses preview derivatives when dragging; otherwise uses the canonical derivative.
      2. Applies the instance timescale (world velocity) and then scales by speed/direction when running.
      2. When stopped, replaces with `matchingIdentityRawValue` (zero velocity shape).
    5. Stores the velocity (or `undefined`) in `velocities`.
  4. Returns `{ values, velocities }`.

# Drag entry points (marker vs value)
Both canvas and slider drags flow through the same preview/commit pipeline; only the input normalization differs.
  1. Marker drags (canvas):
    1. `startDrag` seeds the drag state from the selected marker and captures `valueScale` from row bounds.
    2. `useDragGestures` computes `normalizedValueDelta` from pixel movement and forwards it to `updateDrag`.
    3. `commitDrag` applies the projected diffs; `cancelDrag` drops the preview.
  2. Value-driven drags (slider):
    1. `startValueDrag` finds (or inserts) the keypoint at the current world stamp, seeds selection, and captures `valueScale` (row bounds or caller override).
    2. `updateValueDrag` computes `normalizedValueDelta = (currentValue - anchorValueOrigin) / valueRange` and forwards it to `updateDrag`.
    3. `commitValueDrag` calls `commitDrag`; `cancelValueDrag` removes any inserted keypoint and clears selection.
    4. Row bounds here refer to literal data bounds (`verticalBounds`), not view-specific padding/offset used by spline rendering.

# `computeRowData`
Computes per-row frames, segments, bounds, and preview overlays; called from `buildDerivedSnapshot` and tests.
  1. Builds row-level sets (`trackIds`, `instanceIds`, `namespaceIds`) and `trackKeysByTrackId` mapping.
  2. Filters canonical violations to the row's track ids and the row's instance/namespace scope.
  3. Computes `verticalBounds` via `computeVerticalBounds`, preferring animatable constraints and falling back to point values.
  4. Determines preview gating:
    1. `shouldPreview` is true only when `dragState` exists and `selectionState.instanceId === dragState.instanceId`.
    2. Resolves `draggedTrackIds` (from `dragPreviewCache` or `resolveDraggedTrackIds`) and `handleDiffs`.
  5. If preview is enabled, computes per-track drag projections:
    1. For each dragged track id, calls `computeDragDiffOps` (see section) with the base or snapshot points and constraint bounds.
    2. Overlays `handleDiffs` by replacing `transitions.in/out/pairing` on preview and marker points.
    3. Stores `{ projectedPoints, framePoints, diffs, selectionCleanup }` in `previewByTrackId`.
  6. Builds projected and marker tracks (per row entry):
    1. Computes `trackKey = buildTrackKey(namespaceId, instanceId, trackId)`.
    2. Chooses preview points only when the track is in `draggedTrackIds` (and the instance matches the drag context).
    3. Drops coincident points that collide with the anchor stamp to keep anchor ids stable.
    4. Writes `projectedTracks[trackKey]` and `markerTracks[trackKey]`, plus matching `projectedSourceRow`/`markerSourceRow` entries with `trackIdBase`.
    5. If `previewCache` exists, caches `trackViews`, `pendingDiffsByTrackId`, and `selectionCleanups` for use by `buildDerivedSnapshot`.
  7. Builds frames and segments:
    1. Calls `computeFrames` (see section) for projected tracks and marker tracks, using `transformKeypoint` and anchor frame info.
    2. Resolves per-point transition pairing and applies it to frames.
    3. Calls `computeTransitionSegments` to build explicit segments, then `computeFilledInterpGaps` to fill implicit gaps.
    4. Calls `attachSegmentGeometry` to compute raw/effective render params and handle locations.
  8. Computes preview violations when the row includes the dragged instance and context is available:
    1. For each dragged track, rebuilds preview points when applicable and recomputes violations.
    2. Uses the timescale-adjusted duration when computing preview violations.
    3. Replaces violations only for the dragged tracks; other instances keep canonical violations.
  9. Builds render outputs (`render.markers`, `render.segments`, `render.handles`) and `selection` frames.
 10. Builds `violationSet` and returns `ComputedRowData` (`virtualFrames`, `render`, `selection`, `verticalBounds`, `valueBounds`).
 11. Returns computed row data to the caller.

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
  7. Applies diffs to produce `projectedPoints` and `framePoints` (frame points keep the anchor id and drop coincident points).
  8. Returns `{ diffs, projectedPoints, framePoints, selectionCleanup }`.

# `computeTrackInterpolator`
Builds a local-stamp interpolator for a track and its instance settings.
  1. If the track has no points, returns a function that always yields `undefined`.
  2. If the track has one point, returns a function that always yields that value.
  3. Converts points to world times using instance `timescale` and `offset`, then sorts by time.
  4. Builds Bezier segments by computing world-space control points for each adjacent pair.
  5. Returns an interpolator that:
    1. Converts input local time to world time.
    2. Selects the correct segment (or clamps to endpoints).
    3. Solves the Bezier parameter and evaluates the value by type (number, vector2/3, euler, color).
  6. Returns the interpolator function.

# `computeTrackViolations`
Samples the interpolator and emits violation ranges based on animatable constraints.
  1. Computes a normalized sampling interval (~10ms steps) and clamps it to duration.
  2. Iterates time steps from 0 to 1, comparing consecutive values.
  3. Opens, extends, or closes violations for upper/lower bounds, velocity, and rate constraints.
  4. Closes any remaining open violations at the end of the animation.
  5. Returns a list of `Violation` records.

# `computeFrames`
Builds `InstancedFrameInfo` arrays from tracks and source rows; used by `computeRowData` and `computeTrackTrajectories`.
  1. Iterates each `sourceRow` entry and each point in its track.
    1. Applies `transformKeypoint` when provided (preview mapping).
    2. Merges into an existing frame when the stamp matches (and, unless `ignoreDraggingState` is true, the drag state matches).
    3. Otherwise creates a new frame with a stable id derived from keypoint + track + namespace + instance.
    4. Adds point metadata (`namespaceId`, `instanceId`, `trackId`, `value`, `type`) and ensures default transitions.
  2. Sorts frames by stamp.
  3. If `anchorFrameKey` and `anchorFrameId` are provided, overrides the matching frame id to keep React keys stable during drag.
  4. Returns the sorted frames.
