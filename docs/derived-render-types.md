# Derived Render Types (Proposal)

This document defines the proposed derived/render types for the streamlined pipeline. Names are chosen to describe meaning rather than historical usage. Types are written as TypeScript for clarity.

## `ValueType`
```ts
type ValueType = "number" | "string" | "boolean";
```
Purpose: Canonical value type for scalar tracks.
Usage: Used by render markers to carry the minimal type info for UI decisions.
Note: Boolean values map to numeric 0/1 for rendering (false → 0, true → 1). String values are not rendered as line/marker values, and marker text is intentionally skipped for now.

## `LayerBand`
```ts
type LayerBand = "background" | "foreground-unselected" | "foreground-selected";
```
Purpose: Z-ordering and interaction grouping for points within a row.
Usage: Attached to render markers for layering and selection logic.

## `TrackInstanceKey`
```ts
type TrackInstanceKey = `${string}/${string}/${string}`;
```
Purpose: Identifies a concrete track instance by `namespaceId/instanceId/trackId`.
Usage: Key into `DerivedSnapshot.tracks` and row `trackKeys` without string parsing in components.
Note: Group nesting does not affect this key. Groups live in `animation.groups` and only influence UI hierarchy; track instance keys remain flat and stable.

## `ValueBounds`
```ts
interface ValueBounds {
  min: number;
  max: number;
}
```
Purpose: Canonical data bounds for a row (value domain).
Usage: Used for vertical scaling and clamping; computed from canonical data only.
Properties:
- `min` - lowest value across canonical points/constraints.
- `max` - highest value across canonical points/constraints.

## `PolylineSample`
```ts
interface PolylineSample {
  id: RenderSampleId;
  points: Float32Array;
  stride: 2 | 3;
  resolution: number;
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}
```
Purpose: A fixed-resolution polyline in packed numeric form.
Usage: Stored in a shared cache as a reusable full-track (or windowed) sample. Segment samples either embed points directly or reference a range of this sample.
Properties:
- `id` - stable cache key.
- `points` - packed coordinates (XY or XYZ).
- `stride` - number of components per point.
- `resolution` - points per segment (uniform).
- `bounds` - optional spatial bounds for culling or LOD.

## `RenderSampleId`
```ts
type RenderSampleId = string;
```
Purpose: Stable id for cached polyline samples.
Usage: Used by `RenderSampleCache` and shared `SegmentSample` entries to reference cached data.

## `RenderSampleCache`
```ts
interface RenderSampleCache {
  samples: Record<RenderSampleId, PolylineSample>;
  trackIndex?: Record<string, Partial<Record<TrackRender, RenderSampleId>>>;
}
```
Purpose: Optional shared cache for track-level samples.
Usage: Allows row segments to reference samples by id rather than duplicating arrays.
Properties:
- `samples` - map of sample id to `PolylineSample`.
- `trackIndex` - optional lookup from sample key (e.g. `trackId:value` vs `trackId:flat`) to per-render sample ids.

## `AffineTransform2D`
```ts
interface AffineTransform2D {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}
```
Purpose: Row-space transform applied to shared samples.
Usage: Used when a row binds to a shared track sample (instance/time offsets, vertical scale).
Properties:
- `scaleX` - horizontal scale (time domain).
- `scaleY` - vertical scale (value domain).
- `offsetX` - horizontal translation.
- `offsetY` - vertical translation.

## `SegmentSample`
```ts
type SegmentSample =
  | { kind: "direct"; points: Float32Array; stride: 2 | 3 }
  | {
      kind: "shared";
      sampleId: RenderSampleId;
      range: { startIndex: number; endIndex: number };
      transform: AffineTransform2D;
    };
```
Purpose: Line sample for a single segment.
Usage: `RenderSegment.samples` chooses either embedded points (direct) or a sub-range of a shared `PolylineSample` (shared).
Conceptual difference from `PolylineSample`:
- `PolylineSample` is a reusable, track-level sample for the full line (or a window of it).
- `SegmentSample` is the per-segment render payload, optionally pointing into the shared sample.
Properties:
- `kind` - storage strategy (`direct` or `shared`).
- `points` - direct packed points (for `kind: "direct"`).
- `sampleId` - reference into `RenderSampleCache` (for `kind: "shared"`).
- `range` - point index range into the shared sample (`startIndex` inclusive, `endIndex` exclusive).
- `transform` - affine transform for row/instance mapping. Instance X transforms should be applied here (materialization), not in the renderer.

## `RenderSegment`
```ts
interface RenderSegment {
  id: string;
  trackId: string;
  trackKey: TrackInstanceKey;
  startKeypointId: string;
  endKeypointId: string;
  buffer?: boolean;
  samples: Partial<Record<TrackRender, SegmentSample>>;
}
```
Purpose: Renderable line segment between two keypoints.
Usage: Consumed by line rendering and hit-testing.
Properties:
- `id` - stable segment id (e.g. `startId:endId`).
- `trackId` - canonical track id (shared across instances).
- `trackKey` - instance-specific track key.
- `startKeypointId`/`endKeypointId` - segment endpoints.
- `buffer` - marks empty/pseudo segments.
- `samples` - per-render-mode line samples; Preview reuses the Spline sample.

## `RenderMarker`
```ts
interface RenderMarker {
  id: string;
  trackId: string;
  trackKey: TrackInstanceKey;
  namespaceId?: string;
  instanceId?: string;
  animationId?: string;
  animatableId?: string;
  valueType?: ValueType;
  iconCode?: string;
  editable?: boolean;
  selectable?: boolean;
  layerBand?: LayerBand;
  stamp: number;
  value: number;
  x: number;
  y: number;
}
```
Purpose: Renderable marker (keypoint) position in row space.
Usage: Marker drawing, selection, and hover logic.
Properties:
- `id` - keypoint id.
- Note: `id` is not globally unique; use `trackId + id` when joining markers.
- `trackId` - canonical track id.
- `trackKey` - instance-specific track key.
- `namespaceId`/`instanceId` - optional instance identifiers for selection scoping.
- `animationId`/`animatableId`/`valueType`/`iconCode` - optional identity metadata for display/lookup.
- `editable`/`selectable`/`layerBand` - optional UI flags to avoid rejoining `SourceRowData` for selection and rendering.
- `stamp` - normalized time (0..1).
- `value` - raw numeric value (boolean maps to 0/1; string values are not rendered).
- `x` - canonical coordinate in stamp space (0..1).
- `y` - canonical value coordinate normalized to row bounds (-0.5..0.5). View scaling happens later.
Note: Grouping is derived from the row (multiple tracks or a group source), not from `valueType`.

## `RenderHandle`
```ts
interface RenderHandle {
  id: string;
  keypointId: string;
  trackId: string;
  trackKey: TrackInstanceKey;
  side: "in" | "out";
  neighborKeypointId?: string;
  kind: "explicit" | "easing";
  pairing?: "paired" | "free";
  world: { x: number; y: number };
  effective?: { x: number; y: number };
}
```
Purpose: Renderable handle position for spline editing.
Usage: Bezier handle UI in spline view; does not control line rendering.
Properties:
- `id` - stable handle id (`keypointId-side`).
- `keypointId` - owning keypoint.
- `trackId`/`trackKey` - track identifiers.
- `side` - handle side (`in` or `out`).
- `neighborKeypointId` - adjacent keypoint used for context.
- `kind` - explicit handle vs easing-derived.
- `pairing` - pairing state for mirrored handles.
- `world` - raw handle position (anchor-relative world deltas).
- `effective` - clamped handle position used for rendering/interpolation.

## `RowRenderData`
```ts
interface RowRenderData {
  markers: RenderMarker[];
  handles?: RenderHandle[];
  segments: RenderSegment[];
}
```
Purpose: Rendering payload for a row.
Usage: Canvas sheet consumes this to draw markers, handles, and line segments.
Properties:
- `markers` - marker positions in row space.
- `handles` - optional handle positions for spline editing.
- `segments` - line segments with samples for drawing and hit-testing.

## `SelectionFrame`
```ts
interface SelectionPointRef {
  markerId: string;
  trackId: string;
  trackKey: TrackInstanceKey;
  namespaceId?: string;
  instanceId?: string;
  selectable?: boolean;
}

interface SelectionFrame {
  id: string;
  stamp: number;
  points: SelectionPointRef[];
}
```
Purpose: Minimal grouping for selection/range logic without duplicating render marker positions.
Usage: `selection` on `RowDerivedData` is an array of `SelectionFrame` entries. Each `SelectionPointRef` points to a `RenderMarker` by id and carries only selection-relevant fields.
Note: `SelectionFrame.id` is the stable “marker id” used by selection and drag actions (matches the legacy frame id scheme); `SelectionPointRef.markerId` continues to reference `RenderMarker.id` (keypoint id).
Note: Selection logic currently depends on `InstancedFrameInfo`; migration should replace those reads with `SelectionFrame[]` + `RenderMarker` lookups while preserving anchor ids during drag.

## `RowDerivedData`
```ts
interface RowDerivedData {
  selection?: SelectionFrame[];
  valueBounds: ValueBounds;
  violationSet: ViolationSet;
  verticalAxisByView?: Record<string, VerticalAxisRange>;
  render: RowRenderData;
}
```
Purpose: Row-level derived outputs, decoupled from legacy geometry.
Usage: Stored in `DerivedSnapshot.rows[rowId].computed` and consumed by UI.
Properties:
- `selection` - selection/grouping payload that references render markers (no duplicated positions).
- `valueBounds` - canonical bounds for scaling.
- `violationSet` - row-scoped aggregation of `TrackDerivedState` violations (canonical plus preview overlay).
- `verticalAxisByView` - per-view axis overrides.
- `render` - render payload (markers/handles/segments).

## `TrackDerivedState`
```ts
interface TrackDerivedState {
  canonical: {
    interpolator: TrackInterpolator;
    derivative: TrackInterpolator;
    violations: Violation[];
  };
  preview?: {
    interpolator?: TrackInterpolator;
    violations?: Violation[];
  };
  metadata?: {
    trackId: string;
    namespaceId: string;
    instanceId: string;
    animatableId: string;
    duration: number;
    timescale: number;
  };
}
```
Purpose: Per-track derived caches for values/violations.
Usage: Feeds `values`/`velocities` and preview violations.
Properties:
- `canonical` - interpolator, derivative, and violations for canonical data.
- `preview` - optional preview interpolator/violations for drag overlays.
- `metadata` - identifiers to avoid parsing `TrackInstanceKey` in consumers.

## `DragOverlay`
```ts
interface DragOverlay {
  state: DragOverlayState;
  draggedTrackIds: Set<string>;
}
```
Purpose: Derived-only drag context for rendering.
Usage: Used by row builders and UI to apply preview to all instances of a track.
Properties:
- `state` - drag data used for preview projection (subset of canonical drag state).
- `draggedTrackIds` - set of affected track ids (no string parsing); used to scope preview overlays across instances without re-parsing track keys.

## `DragOverlayState`
```ts
interface DragOverlayState {
  instanceId: string;
  axis: "horizontal" | "vertical" | "both";
  anchor: {
    keypointId: string;
    trackId: string;
    rowId: string;
    namespaceId?: string;
    instanceId?: string;
  };
  trackSnapshots?: Record<string, { trackId: string; points: Keypoint<RawValue>[] }>;
  stampDelta?: { raw: number; snapped?: number };
  normalizedValueDelta?: number;
  handleDiffs?: Record<string, { in?: RawVector2; out?: RawVector2; pairing?: "paired" | "free" }>;
  pendingDiffs?: DiffOp[];
  pendingSelectionCleanups?: SelectionCleanup[];
}
```
Purpose: Minimal drag state required to compute preview overlays.
Usage: Derived snapshot uses this to build preview points and maintain commit parity.
Properties:
- `instanceId` - active instance for drag selection.
- `axis` - drag axis constraint.
- `anchor` - anchor keypoint metadata.
- `trackSnapshots` - frozen base points for preview.
- `stampDelta`/`normalizedValueDelta` - deltas used to project preview.
- `handleDiffs` - explicit handle deltas (preview-only until commit).
- `pendingDiffs`/`pendingSelectionCleanups` - commit parity payloads.

## `RowDerivedState`
```ts
interface RowDerivedState {
  id: string;
  trackKeys: TrackInstanceKey[];
  computed: RowDerivedData;
}
```
Purpose: Wrapper for row-level derived data in the snapshot.
Usage: Stored in `DerivedSnapshot.rows` and consumed by UI.
Properties:
- `id` - row id.
- `trackKeys` - track instance keys represented in the row.
- `computed` - row derived outputs.

## `DerivedSnapshot`
```ts
interface DerivedSnapshot {
  version?: number;
  dragOverlay?: DragOverlay;
  tracks: Record<TrackInstanceKey, TrackDerivedState>;
  rows: Record<string, RowDerivedState>;
  renderSampleCache?: RenderSampleCache;
}
```
Purpose: Single derived view consumed by UI and player calculations.
Usage: Produced by the derived orchestrator; consumed by canvas, controls, and player sync.
Properties:
- `version` - monotonically increasing version for snapshot consistency.
- `dragOverlay` - derived drag preview context.
- `tracks` - per-track caches for interpolators/violations.
- `rows` - per-row render data and bounds.
- `renderSampleCache` - optional shared samples for reuse.
