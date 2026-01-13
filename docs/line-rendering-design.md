# Line Rendering Design: Unified Polyline Sampling

## Context
Today the spline/transition visuals are rendered by sampling cubic Bezier curves inside components:
- `MotionCubicBezierLine` and `MotionCubicBezierFill` read MotionValues, build a `THREE.CubicBezierCurve3`, sample N points, and pass those points to drei `Line` / a custom fill mesh.
- The sampling happens in the render path and is re-run on every MotionValue change.

Future track types (strict data, step/linear values, audio time series) do not have cubic control points. The common requirement is a line/graph over time. This doc explores replacing curve-specific rendering with a unified polyline pipeline that can render any track by sampling its data.

## Goals
- Use one line rendering pipeline for spline, strict data, and audio tracks.
- Preserve visual quality and responsiveness during drag/preview.
- Minimize CPU/GPU cost and avoid excessive allocations.
- Support affine-only per-instance transforms without changing line thickness.

## Non-goals
- This doc does not change selection/drag semantics or commit behavior.
- This doc does not redesign how transition handles are edited; it focuses on rendering output.

## Decisions (current direction)
- **Line implementation:** use `Line2` / `LineGeometry` for screen-space width and minimal invasiveness.
- **Sampling:** use fixed, uniform sampling for now (backend-friendly, predictable updates).
- **Storage:** support direct row segments and optional shared samples (cache + affine bindings) so we can choose per use case.

## Render Outputs (derived)
These are the rendering-centric outputs that should be computed explicitly, with optional preview overlays:
1. **Handle locations** per marker (raw + effective, in/out).
2. **Marker locations** (x/y) in row render space.
3. **Vertical bounds** (canonical-only; used to derive per-view scaling).
4. **Violations** (canonical + preview overlay when dragging).
5. **Line segments** (polyline samples representing data over time).

Interpolator functions remain derived outputs for `values`/`velocities`, but are not required for rendering once samples are computed.
Note: For rendering, boolean values map to numeric 0/1; string values are not rendered as lines/markers, and the renderer should include an explicit guard/comment where text rendering is skipped.

## Proposed Architecture

### 1) Polyline sampling layer (derived computation)
Introduce a sampler that outputs a `Polyline` (ordered points) for each renderable track/segment:

```
interface PolylineSample {
  id: string; // cache key
  points: Float32Array; // [x0, y0, z0, x1, y1, z1, ...]
  stride: 2 | 3;
  resolution: number; // points per segment
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}

interface TrackSampler {
  sample(trackKey: string, params: SampleParams): PolylineSample;
}
```

Sampler variants:
- `sampleInterpolator`: evaluates `computeTrackInterpolator` at a fixed or adaptive resolution.
- `sampleKeypoints`: returns straight segments (linear or step) from raw points.
- `sampleAudio`: returns decimated points (min/max envelope per bucket) to control density.

These samples should be computed in `computeRowData` or a new helper called by it. Two storage approaches can coexist:
- **Direct row segments:** store sampled points per segment directly in row render space.
- **Shared samples:** store a track-level sample in a cache and reference sub-ranges with affine transforms per row/instance.

Rendering components consume the precomputed samples and avoid per-frame sampling.

### 2) Rendering layer (polyline)
Replace `MotionCubicBezierLine`/`Fill` with a `MotionPolylineLine`/`MotionPolylineFill` that take a `Float32Array` (or `Vector3[]`) and update geometry efficiently:
- Use `Line2`/`LineGeometry` so line width can remain screen-space and independent of transform.
- Update geometry via `geometry.setPositions(points)` or buffer attribute updates to avoid allocations.

### 3) Affine transforms for instances
Given that instance differences are only affine transforms (shift/scale), precompute a base polyline per track in canonical space and transform per instance using one of the strategies below.

**Transform sources (clarification)**
- **Instance X transform (timescale/offset):** derived from `AnimationInstanceSettings`. This affects `scaleX`/`offsetX` and should be applied for all render modes when samples are in canonical space. Use the existing helpers in `packages/animation/src/functions/compute-instance-time.ts` to standardize the "do/undo" steps:
  - `computeWorldStamp(localStamp, timescale, offset)` for render-space/world mapping.
  - `computeLocalStamp(worldStamp, timescale, offset)` when converting pointer input back to local space.
- **View Y transform (spline-only):** user-facing offsets/scales to avoid overlapping lines. These affect `scaleY`/`offsetY` and should only apply to spline rendering (line + markers + handles + violations). They must **not** alter canonical data or preview/transition normalization, and should be applied after sampling so cache keys remain stable.

Implications:
- Instance X transforms should be applied at sample materialization time via `SegmentSample.transform` (shared or direct samples), not in the renderer. Renderers should only apply view scaling (`renderScaleY`) and avoid reapplying `xTransform` so the transform boundary is explicit and cache-friendly.
- Cache keys should include canonical sampling inputs and instance X transform inputs (if samples are canonical), but must exclude spline-only Y transforms.
- Interaction code should invert the view Y transform when translating pointer movement into value changes so edits remain canonical.

**Responsibility boundary (time-domain)**
- Canonical keypoints store **local** instance stamps; world/playhead time is converted at the edges (see `computeLocalStamp`/`computeWorldStamp` and the `useLocalGlobalTransform` hook).
- Drag input uses a `DragStampTransform` to map pointer stamps into local deltas; standardize this mapping on the same helpers so the "do/undo" direction matches the instance settings.
- Rendering should not mutate canonical stamps; apply instance X transforms at render/materialization time when sampling in canonical space.
 - Derived interpolators/violations should apply the instance X transform (world time) before computing velocity or timing-based constraints; timescale/offset can legitimately change violation outcomes per instance.

### 4) Multi-instance preview alignment
Preview is computed per `trackId` and applied to every instance that renders that track. For direct segments, the previewed points are reused across instances; for shared samples, the preview sample replaces the canonical sample for that track id. This keeps all instances visually in sync with the shared track model and removes the need for string-based track key parsing in components.

## Performance Strategies

### A) Cache and reuse samples
Key by `(trackId, previewVersion, renderMode, sampleResolution, viewScale)`.
- Preview updates only recompute for tracks that change.
- Store typed arrays in a cache to avoid GC churn.

### B) Uniform sampling (fixed resolution)
Uniform sampling is the default because it does not require renderer coupling. The sampler emits a fixed number of points per segment; any future adaptive scheme would be an optional renderer-side enhancement.

### C) Instancing / transform reuse
If multiple instances share the same base polyline:
- **CPU transform (simple):** map base points to world positions via an affine transform (x = x * timescale + offset; y = y * scale + bias). Keep object scale at 1 so line width is unaffected.
- **GPU transform (best reuse):** render a single base geometry with per-instance transform attributes (offset, scale). A custom shader applies transform to vertex positions but keeps line width in screen space. This avoids duplicating point arrays per instance.

Tradeoff: GPU transform requires custom materials and may be harder to integrate with `Line2`, but it gives the best reuse for many instances.

### D) Batch and merge draw calls
Combine multiple polylines into a single geometry per row or per layer band to reduce draw calls. This works best when styles match (color, width).

### E) Downsample large data tracks
For audio/time-series data:
- Bucket sampling (min/max per pixel column).
- Multi-resolution caches (mip-style) so zoomed-out views use fewer points.

## Line Thickness and Transforms
To keep line thickness stable while applying transforms:
- Avoid scaling the line object; instead, apply transform to vertex positions.
- Prefer screen-space thickness (e.g., `Line2` with a pixel-based `linewidth`).
- If a custom shader is used, compute positions in world space but keep linewidth in screen pixels so transforms do not scale thickness.

## Comparison: Current MotionValue + CubicBezierCurve3 Pipeline

### Current
- Uses MotionValues for control points.
- On each change, rebuilds curve points with `CubicBezierCurve3.getPoints(segments)` and re-renders.
- Curve points are recomputed per segment and per render.
- Good for spline visuals; not reusable for strict data or audio.

### Proposed
- Precompute polylines in derived state using samplers (interpolator, raw points, audio envelope).
- Rendering layer only consumes points and updates geometry.
- Supports strict data and audio without adding new renderers.

### Tradeoffs
- **CPU cost:** sampling interpolators per frame can be heavy if uncached. Needs caching/adaptive sampling.
- **Memory:** storing samples per track (and per instance) can be large; reuse and GPU transforms help.
- **Complexity:** sampler + cache layer adds complexity, but it centralizes data handling and removes per-component sampling logic.

## Options

### Option 1 (recommended): Unified polyline pipeline
- Single sampler + renderer path for all track types.
- Central caching and adaptive sampling.
- Affine transform reuse or instancing for multi-instance rendering.

### Option 2: Hybrid (keep cubic renderer for spline)
- Keep `MotionCubicBezierLine` for spline; add polyline renderer for data/audio.
- Lower risk but two render paths to maintain.

### Option 3: GPU-evaluated cubic lines
- Render cubic curves directly in a shader, avoiding CPU sampling.
- Complex to integrate with data/audio tracks; not a unified path.

**Recommendation:** Option 1, phased in starting with a polyline renderer and sampler, while keeping existing cubic rendering behind a feature flag until parity is verified.

## Implementation Sketch
1. Add `PolylineSample` types and sampler utilities under `src/functions/`.
2. Add a `renderSampleCache` on the derived snapshot and let row segments reference it by id (cache entries can be keyed by view + render mode internally).  
   Status: track-level caching with per-segment ranges is wired; cache keys include curve mode (`value` vs `flat`) to prevent cross-row reuse; transforms are identity pending per-instance reuse.
3. Add `MotionPolylineLine`/`MotionPolylineFill` with typed-array updates and screen-space linewidth.
4. Swap `TransitionSegment` to consume samples instead of control points.
5. Add per-instance transform support (CPU or GPU) and document line-width invariance.
6. Add benchmarks for large track counts and drag preview scenarios.

## Open Questions
- What fixed sampling density should we default to for each render mode?
- Should fill mesh triangulation reuse the line sample buffer directly, or build a separate packed buffer?

## Proposed Next Experiments
- Prototype a polyline renderer that uses a typed array and updates geometry in place.
- Measure performance vs current MotionValue + cubic sampling for N=1000 segments.
- Validate that line width remains stable under affine transforms.
