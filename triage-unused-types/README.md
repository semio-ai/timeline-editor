# Animation Package: Unused Types & Properties Triage

This document lists types/interfaces/classes and properties in `packages/animation` that do not appear to be referenced by name inside the package.
It is intended for cleanup decisions; verify external usage before removal.

Methodology: TypeScript compiler scan over `packages/animation/src` with symbol-based reference checks for
- type/interface/class identifiers (non-declaration usages), and
- property symbols referenced via property access and destructuring.
Structural-only usage (e.g. object literals shaped by interfaces) may not register as a property read.

## Unused Type/Interface/Class Declarations (internal to animation package)
- StoredTrack (interface, exported: true) — `packages/animation/src/types/data/track.ts` (no external usage found)

## Properties With No In-Package References (grouped by definition file)

Note: a property may be used structurally (object literal matching) without being accessed by name; those will still appear here.


### `packages/animation/src/components/animation-sheet.tsx`
- interface `AnimationSheetCoreProps`: fonts, height, onToggleExpand

### `packages/animation/src/components/canvas-sheet/bezier-handles.tsx`
- interface `RenderHandleView`: anchorId, hasEffectiveGap, isFallback, neighborId, pairedDelta, rawWorld, side

### `packages/animation/src/components/canvas-sheet/overlays/playhead-cart.tsx`
- interface `PlayheadCartProps`: width

### `packages/animation/src/components/canvas-sheet/shared/rounded-rectangle-geometry.tsx`
- interface `MorphableRoundedRectProps`: color, heightInfluence, maxHeight, maxWidth, position, radius, segments, widthInfluence

### `packages/animation/src/components/canvas-sheet/utils/render-scale.ts`
- interface `RenderScaleResult`: buffer, isSpline

### `packages/animation/src/components/controls/pan-zoom-controls.tsx`
- interface `PanZoomControlsRef`: bounds, contentHeightPx, enablePan, enableZoom, enabled, getFrustum, maxZoom, minZoom, panSpeed, scrollValue, trackRegion, update, zoomSpeed

### `packages/animation/src/functions/build-segment-render-params.ts`
- interface `BuildSegmentRenderParamsInput`: verticalBounds

### `packages/animation/src/functions/get-world-control-points.ts`
- interface `ComplexPosition`: y

### `packages/animation/src/functions/resolve-segment-control-points.ts`
- interface `SegmentControlPointResult`: rawTransitions

### `packages/animation/src/functions/selection-state-manager.ts`
- interface `LegacyMarkerPoint`: selectable

### `packages/animation/src/hooks/use-playback-gestures.ts`
- interface `UsePlaybackGesturesReturn`: onDoubleClick, onPointerEnter, onPointerLeave, onPointerMove

### `packages/animation/src/hooks/use-track-context.ts`
- interface `TrackContextData`: animationDuration, animationId, bounds, color, frameCount, instanceSettings, trackIds, trackRender, trackType, xScale, yScale, zoomScale

### `packages/animation/src/store-types.ts`
- interface `AnimationActions`: addAnimation, createKeypoint, createKeypoints, createNewDefaultAnimation, createTrack, getAnimationsToSave, removeAnimation, removeKeypoint, removeTrack, setAnimatables, setAnimations, setExpanded, setNamespaces, setPreferences, setTimeDisplay, setTracks, setValue, updateAnimationDuration, updateFramerate, updateKeypoint, updatePreview, updateValues, updateVelocities
- interface `AnimationData`: expanded

### `packages/animation/src/subscriptions/update-view-vertical-axes.ts`
- interface `ViewAxisContext`: rowIds

### `packages/animation/src/types/data/animation.ts`
- interface `AnimationDriver`: animationInstances, type
- interface `AnimationInstanceSettings`: active

### `packages/animation/src/types/data/keypoint.ts`
- interface `Keypoint`: value

### `packages/animation/src/types/data/track.ts`
- interface `StoredTrack`: animatableId, groupName, id, name, points, settings
- interface `Track`: points, settings

### `packages/animation/src/types/data/trajectory.ts`
- interface `PositionAndEffortTrajectoryPoint`: positions, timeFromStart
- interface `PositionAndVelocityTrajectoryPoint`: timeFromStart
- interface `PositionVelocityAndAccelerationTrajectoryPoint`: positions, timeFromStart, velocities

### `packages/animation/src/types/util/derived-snapshot.ts`
- interface `DerivedRowSnapshot`: id
 
### `packages/animation/src/types/util/diff.ts`
- interface `DeleteKeypointDiff`: trackId, type
- interface `HandleDiff`: changes, keypointId, trackId, type
- interface `InsertKeypointDiff`: trackId, type
- interface `ProjectedTrackView`: appliedDiffs, framePoints, selectionCleanup, trackKey
- interface `ReorderKeypointsDiff`: trackId
- interface `UpdateKeypointDiff`: trackId, type

### `packages/animation/src/types/util/drag-state.ts`
- (no unused properties detected after cleanup)

### `packages/animation/src/types/util/render-types.ts`
- interface `SelectionPointRef`: namespaceId

### `packages/animation/src/types/util/source.ts`
- interface `SourceGroup`: layout, type
- interface `SourceTrack`: channel, muted

### `packages/animation/src/types/util/view.ts`
- interface `View`: id

### `packages/animation/src/viewport-utils.ts`
- interface `Frustum`: bottom, left, right, top

## Util Type Usage Review (manual)

- **`ComputedRowData` (`packages/animation/src/types/util/computed-row-data.ts`)** Removed `valueBounds` (was set in `compute-row-data` but never read); consumers already use `verticalBounds` or `verticalAxisByView`.
- **`DerivedSnapshot` / `DerivedRowSnapshot` (`packages/animation/src/types/util/derived-snapshot.ts`)** `dragOverlay` was removed (no consumers); `DerivedRowSnapshot.id` is redundant with the `rows` map key. `DerivedTrackSnapshot.metadata` only uses `duration/timescale/offset` in `init-derived-orchestrator`; `trackId/namespaceId/instanceId/animatableId` are never read. Suggest trimming metadata.
- **`Diff` types (`packages/animation/src/types/util/diff.ts`)** `InsertKeypointDiff` and `HandleDiff` are not produced/consumed; `ProjectedTrackView.appliedDiffs` is stored but never read. Note: keypoint insertion currently happens via direct mutations (immediate edits and drag-start insertion), so the lack of `InsertKeypointDiff` usage may indicate a design-vs-implementation mismatch rather than dead code. Suggest either removing these types until the diff pipeline emits them, or wiring handle/insert paths into the diff pipeline so the extra shapes are justified.
- **`DragState` (`packages/animation/src/types/util/drag-state.ts`)** Removed unused fields (`projectedTracks`, handleAnchor `controlPoint`/`canonicalLengths`/`neighborKeypointId`/`prevNeighbor`/`nextNeighbor`). Remaining drag-state fields are referenced in actions or derived preview logic.
- **`Preview` (`packages/animation/src/types/util/preview.ts`)** Removed `label` (unused); previews now only carry `semanticTime` + `stamp`, and UI callers no longer attach labels.
- **`Render` types (`packages/animation/src/types/util/render-types.ts`)** Removed `RenderMarker.x/y`, `PolylineSample.resolution`, and `RenderSegment.trackKey` (unused). `SelectionPointRef.namespaceId` is unused but intentionally retained for direct access without parsing `trackKey`.
- **`SegmentGeometry` (`packages/animation/src/types/util/segment-geometry.ts`)** handles and render params are used by `compute-row-data` and handle rendering. No unused fields today; keep as-is. If you want an updated unused-property list, re-run the scan (the previous list likely captured removed fields).
- **`Source` types (`packages/animation/src/types/util/source.ts`)** `SourceGroup.layout` and `SourceTrack.channel/muted` are defined but not used. Layout/channel are documented as future; `muted` is set but never gates rendering or playback. Suggest removing unused fields or implementing mute/layout behavior.
- **`View` (`packages/animation/src/types/util/view.ts`)** `id` is redundant with the `editorViews` map key and not read. Suggest removing `id` or explicitly using it when views are passed around.
- **`ViolationSet` (`packages/animation/src/types/util/violation-set.ts`)** `ViolationSegment.id/violations` are used in violation rendering and tooltips; no extra fields. Keep as-is and refresh any stale scan results.
