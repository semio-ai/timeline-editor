# Store & Rendering Architecture Proposal

Author: semio-agent
Status: Draft
Last updated: 2025-11-03

## Goals

- Unify the math used by backend data (value domains), rendering (world mapping), and interaction/gestures (scale inversion) so cursor tracking and visuals are exact and repeatable.
- Simplify and de-duplicate derived state; reduce the number of subscriptions and make recompute boundaries explicit and testable.
- Keep feature parity (layers, colors, selection, snapping/gestures) while making the system easier to reason about and faster to compute.
- Design for performance: predictable recomputation, O(1) lookups on hot paths, cache by stable keys, and isolate expensive work.

---

## Summary

We propose:

1) A single source of truth for per-row, per-view value domains (already present via `verticalAxisByView`), plus a paired world-range mapping (`verticalWorldRangeByView`) that describes the plotted world-space Y span for each row in each view. The world mapping is camera-independent and derived from view geometry (e.g., available height, per-row slot height) that the UI publishes to the store.

2) A unified rendering scale:
   - Rendering components build `S: value → worldY` from `(valueDomain, worldRange)` and apply it uniformly for markers and curves.
   - A tiny shared helper can provide `S` and `S^-1` so components and hooks don’t reinvent mapping math.

3) Interaction math by inverting the same scale:
   - Gestures compute `normalizedValueDelta` from absolute world-space pointer Y via `S^-1`:
     - `Δvalue = S^-1(currentWorldY) - S^-1(originWorldY)`
     - `normalizedValueDelta = Δvalue / (valueDomain.max - valueDomain.min)`
   - This decouples gestures from pixel deltas and avoids camera-dependent drift.

4) A consolidated “derived state” pass:
   - Replace multiple overlapping subscriptions with a single orchestrator that recomputes per-row derived state from a minimal set of inputs and publishes a normalized snapshot:
     - writes to `derivedSnapshot.rows[rowId].computed`: frames, interpolations, violations, verticalAxisByView, verticalWorldRangeByView.
   - Use fine-grained equality checks and stable keys to prevent unnecessary work.

5) Minimal, parsimonious store types:
   - Keep canonical data compact (tracks, animations, instances, animatables).
   - Separated minimal selection state, drag state (anchor-first), and editor view descriptors.
   - Derived-only types live under `derivedSnapshot.rows[*].computed`, are cacheable, and contain no redundant copies of canonical data.

---

## Current State: Pain Points

- Multiple subscriptions (`update-computed-row-data`, `update-view-vertical-axes`, others) each recompute pieces of derived state with different semantics/timing, leading to:
  - Redundant work.
  - Inconsistent slices (e.g., bounds vs axis vs visual mapping).
- Inconsistent vertical mapping:
  - Backend provides padded `verticalAxisByView` for Spline (value space).
  - UI sometimes adds additional cosmetic buffers and/or uses different spans for gesture normalization vs rendering.
- Interaction math and rendering math not tied to the same scale:
  - Gestures may use pixel-based or world-height normalization; rendering uses a different mapping.
  - Leads to cursor under/over-tracking and marker vs curve divergence.

---

## Proposed Data Model

### Canonical (unchanged or clarified)

- `Tracks`, `Keypoints`, `Animations`, `Namespaces`, `Animatables`
- `EditorViews` (per-view config: render mode, vertical axis mode, etc.)
- `SelectionState`
  - `Map<TrackId, Set<KeypointId>>` scoped to active `instanceId`.
  - `reference?: { rowId: SourceRowId; markerId: string }` (render-surface oriented).
- `DragState` (anchor-first, minimal)
  - `axis: 'horizontal' | 'vertical' | 'both'`
  - `instanceId`, `instanceTransform`
  - `anchor: { keypointId, trackId, rowId, markerId, attributePath?, valueScale? }`
  - `pointerOrigin`, `stampOrigin?`, `stampDelta?`, `anchorValueOrigin?`, `normalizedValueDelta?`, `modifiers`

### New: View Geometry (UI publishes once per change)

- `ViewGeometry` (per view)
  - `availableHeightWorld: number` — plotted world height for the row area (orthographic space).
  - `marginWorld?: number` — cosmetic top/bottom margin for specific views (optional; Spline typically small).
- `ViewGeometryById = Record<ViewId, ViewGeometry>`

Rationale: we define the world-space container height independently from camera zoom. In the current orthographic setup, “1 world unit == 1 pixel” per motion-canvas, so translating from pixels to world units is trivial and camera-independent.

### Derived: Per-row, per-view axis + world mapping

- Extend `ComputedRowData`:
  - `verticalAxisByView?: Record<ViewId, { min: number; max: number; visualOffset?: number }>`
  - `verticalWorldRangeByView?: Record<ViewId, { valueDomain: [number, number]; worldRange: [number, number] }>`
    - `valueDomain` duplicates `{min,max}` above for cohesion and easy consumption.
    - `worldRange` = `[-(availableHeightWorld/2 - marginWorld), +(availableHeightWorld/2 - marginWorld)]` for Spline.
    - For non-Spline views: `worldRange` equals the per-row slot height (optionally with margin); vertical drag is disabled there, so interaction math doesn’t rely on it.

### Minimal Derived (per row)

- `derivedSnapshot.rows[rowId].computed`
  - `virtualFrames: InstancedFrameInfo[]`
  - `interpolations: TransitionSegments[]`
  - `violationSet: ViolationSet`
  - `verticalAxisByView?: Record<ViewId, AxisRange>`
  - `verticalWorldRangeByView?: Record<ViewId, { valueDomain, worldRange }>`
  - (Optionally) `layerBandsSummary` (fast classification for layers/colors)
  - (Optionally) `attributePathsByTrack: Map<TrackId, string[] | undefined>`

No duplication of canonical data. All derived state is either references into canonical data or compact precomputed features.

---

## Subscriptions: From Many to One Orchestrator

Replace the current piecemeal update subscriptions with a consolidated derivation pipeline:

1) Inputs (trigger keys)
   - `tracks`, `animations`, `namespaces`, `animatables` (canonical)
   - `instancedTrackSources` (row definitions)
   - `editorViews` (per view render/axis modes)
   - `viewGeometry` (new; published by UI for each view)
   - `selectionState`, `dragState` (for previews)
   - `violations` (per-track raw violation info)
   - any additional constants/configs

2) Orchestrator: `recomputeDerivedRows` (single subscription)
  - For each `rowId`:
    - Compute `verticalAxisByView[viewId]` (existing logic: Spline → padded domain per view, Preview/Transition → normalized or row bounds).
    - Compute `verticalWorldRangeByView[viewId]` from `viewGeometry`:
       - Spline:
         - `worldRange = [-H/2 + margin, +H/2 - margin]`, where `H = availableHeightWorld`
       - Preview/Transition:
         - `worldRange = [-slot/2 + margin, +slot/2 - margin]` (if needed; cosmetic only)
     - Compute frames, interpolations, and violations:
       - Pass a `transformKeypoint` callback using store `dragState` + `selectionState` → `applyDragDeltas` for previews.
       - Recompute violation previews if drag deltas change (as today).
     - Write to `derivedSnapshot.rows[rowId].computed` with all fields above.

3) Equality/short-circuit:
   - `shallow` equality over the root inputs and per-row data.
   - Per-row caches (memo) keyed by `(rowId, viewId, version)` to avoid recomputing `verticalWorldRangeByView` unless `viewGeometry` or `axisByView` changes.

Benefits:
- Derived state is recomputed in one consistent place, ensuring alignment across frames, axis, and world mapping.
- Per-row caching avoids N×M recomputations across repeated reads.

---

## Rendering & Interaction

### Rendering

- DataRenderer chooses the active mapping:
  - `axis = derivedSnapshot.rows[rowId].computed.verticalAxisByView?.[viewId] || {min, max}`
  - `world = derivedSnapshot.rows[rowId].computed.verticalWorldRangeByView?.[viewId]?.worldRange || defaultSlotRange`
- Build `S: value → worldY` via `createLinearScale([axis.min, axis.max], [world.min, world.max])`.
- Components apply `S(value)` for:
  - `DataPoint` (marker)
  - `TransitionSegment` (curves)
- Layers, colors, selection remain unchanged; renderer keeps using `layerBand` summaries and color helpers.

### Interaction/Gestures

- Hook options:
  - `normalization: { valueDomain: [vmin, vmax], worldRange: [Ymin, Ymax] }`
- On drag start:
  - `originWorldY = event.point.y` (preferred; else reconstruct via clientY/camera only as fallback)
  - `valueOrigin = S^-1(originWorldY)`
- On move:
  - `currentWorldY = event.point.y`
  - `valueCurrent = S^-1(currentWorldY)`
  - `Δvalue = valueCurrent - valueOrigin`
  - `normalizedValueDelta = Δvalue / (vmax - vmin)`
  - Call `updateDrag({ normalizedValueDelta })`
- On end:
  - `commitDrag()` (store converts `normalizedValueDelta` to absolute delta using anchor.valueScale.domain; clamp/precision apply as today)

This guarantees marker/curve alignment and exact cursor tracking because interaction inverts the exact same scale the renderer uses.

---

## Performance Considerations

- Cache derived mappings:
  - `verticalWorldRangeByView` depends only on `verticalAxisByView[viewId]`, `viewGeometry[viewId]`, and row membership. Cache in `computedRowData`.
- Precompute frequently accessed per-row info:
  - `attributePathsByTrack` (small, map per row).
  - `layerBandsSummary` (quick layer determination for color/layer logic).
- Push pure functions into a shared helper module:
  - `makeScale(valueDomain, worldRange)` returns `{ toWorld(value), toValue(world) }` closures.
  - Keep these closures tiny and reusable; memoize per `(rowId, viewId)`.

---

## Testing Strategy

- Unit tests
  - Scale mapping: `makeScale` and `invertScale`.
  - `applyDragDeltas`: anchor domain vs fallback bounds; clamp/precision; attribute path selection.
  - `commitDrag`: consistency with preview; ordering after horizontal deltas.
- Integration tests
  - Derived rows recompute when inputs change; caching/equality verified to avoid redundant recompute.
  - Rendering vs interaction alignment: markers and curves remain in lockstep during drag; cursor tracking exactness (simulate absolute world Y series).
- Property tests
  - For randomized value domains and world ranges, ensure `S^-1(S(value)) ≈ value` and drag inversion round-trips within a tolerance.

---

## Migration Plan

- Phase 1: Introduce `ViewGeometry` and `verticalWorldRangeByView`
  - Add store action to publish `viewGeometry` for each view (TracksRenderer already knows available area).
  - Add orchestrator subscription to populate `verticalWorldRangeByView`.
  - Update DataRenderer to read `verticalWorldRangeByView` and build `S` for both DataPoint and TransitionSegment.
- Phase 2: Update gesture hook + DataPoint usage
  - Add `normalization` to gesture options and compute `normalizedValueDelta` by inversion.
  - Pass `{ valueDomain, worldRange }` from `computedRowData[...]` to the hook.
- Phase 3: Clean-ups
  - Remove old pixelRangeY/worldRangeY uses.
  - Ensure no UI-added padding affects Spline drag; keep cosmetic margins only in views without vertical drag.
  - Consolidate subscriptions and remove now-dead ones; keep the single orchestrator.

---

## Risks & Mitigations

- Risk: World mapping mismatch due to incorrect geometry publishing.
  - Mitigation: Keep `viewGeometry` simple (world height & margin only), unit test the conversion logic in the orchestrator.
- Risk: Interaction regressions due to changed gesture math.
  - Mitigation: Keep existing horizontal math untouched; add targeted tests for vertical inversion.
- Risk: Derived recompute becoming too large.
  - Mitigation: Fine-grained equality checks, per-row caching, and small closure helpers.

---

## Open Questions

- Do we want to precompute `worldY` for every keypoint in `computeFrames` to further reduce runtime math in components?
  - Pros: Components become dumb (just place at `worldY`).
  - Cons: Slightly larger derived payload; recompute cost might increase when dragging.
- Should we store `S` coefficients (slope/intercept) alongside `verticalWorldRangeByView` for zero-allocation mapping in hot loops?
  - Probably yes for micro-optimizations; not necessary for correctness.

---

## Appendix: Proposed Types (Consolidated)

```ts
// geometry
export interface ViewGeometry {
  availableHeightWorld: number;
  marginWorld?: number;
}
export type ViewGeometryById = Record<string, ViewGeometry>;

// axis + world
export interface VerticalAxisRange { min: number; max: number; visualOffset?: number; }
export interface VerticalAxisRangeWorld {
  valueDomain: [number, number];
  worldRange: [number, number];
}

// computed row data
export interface ComputedRowData {
  virtualFrames: InstancedFrameInfo[];
  interpolations: TransitionSegments[];
  violationSet: ViolationSet;
  verticalAxisByView?: Record<string, VerticalAxisRange>;
  verticalWorldRangeByView?: Record<string, VerticalAxisRangeWorld>;
  // optional accelerators:
  // attributePathsByTrack?: Map<string, string[] | undefined>;
  // layerBandsSummary?: LayerBandSummary;
}

// gestures (UI-only)
export interface DragNormalization {
  valueDomain: [number, number];
  worldRange: [number, number];
}
export interface DragGestureOptions {
  disabled?: boolean;
  dragOptions?: DragConfig;
  normalization?: DragNormalization;
  onDragStart?: (xNorm: number) => void;
  onDrag?: (xNorm: number, altKey: boolean) => void;
  onDragEnd?: (xNorm: number) => void;
  onDrag2D?: (args: {
    x: number;
    normalizedValueDelta: number;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  }) => void;
}

// store action for UI to publish geometry
updateViewGeometry(viewId: string, geometry: ViewGeometry): void;

// drag start (store)
export interface DragStartInput {
  axis: DragAxis;
  markerId: string;
  rowId: string;
  valueScale?: ValueScale; // allows passing {domain:[min,max], clamp, precision}
}
```

---

## Conclusion

This proposal unifies value-domain → world-range mapping across backend-derived state, rendering, and interaction math. By consolidating derived state computation into a single orchestrator and standardizing on a simple, invertible linear scale (with a shared helper), we eliminate drift and glitches, reduce duplicated logic, and make the system easier to test and maintain—without sacrificing rendering richness (layers, colors, selection, snapping).

If this direction looks good, I can proceed to implement:
- The `viewGeometry` store action and `verticalWorldRangeByView` derivation.
- A shared `makeScale` and `invertScale`.
- Hook normalization via the scale inversion, and component updates to consume the new mapping.