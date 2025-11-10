# Drag Interactions

This spec defines how drag gestures stage stamp/value updates before they are committed to animation data. It complements the consolidated selection flow in `selection.md`, replaces the legacy `DragState`/`DraggedKeypoint` wiring, and avoids duplicating the selected marker set inside the drag state.

## Goals
- Treat drag as an operation on the resolved selection, independent of the UI surface that initiated it.
- Track only the information that cannot be recomputed from `selectionState` (anchor marker, pointer deltas, and instance transform).
- Preview horizontal and vertical deltas through `computeRowData` while leaving track data untouched until commit.
- Respect animation-instance transforms (`AnimationInstanceSettings`) so global pointer movement produces the same local result regardless of per-instance `offset`/`timescale`.
- Produce visually uniform vertical displacement even when selected tracks have different numeric ranges or nested value paths.
- Abort cleanly if the selection becomes invalid or the gesture is cancelled.

## Implementation Workflow
1. Re-read this document and the selection spec before making changes; treat them as the authoritative contract.
2. Use the checkboxes in the plan below as the single source of truth for progress. Update them in-place as work lands, including links or notes to related PRs when available.
3. Capture deviations, simplifications, or follow-ups under **Blackboard Notes** with a brief rationale and owner. If an item is resolved or intentionally abandoned, mark its checkbox and describe the resolution.
4. Surface open questions inline (`TODO(semio-agent):` or `OPEN:`) so they are easy to find for the next contributor. Flag questions for the manager or leader as `INPUT_NEEDED` if they block progress. If such a case is encountered, notify the manager/user directly and pause work, making note of the current status in the document.
5. Keep this document current—when implementation details shift (e.g., types change, helper signatures evolve), update both the spec text and the workflow notes so future work stays aligned.

## Implementation Plan (check off as work lands)
- [x] **Foundations** – Replace legacy `DragState` definitions (`types/util/drag-state.ts`, `store-types.ts`) with the anchor-first shape, update `AnimationActions` signatures, and remove unused migration helpers.
- [x] **Preview Plumbing** – Implement `applyDragDeltas` (or equivalent) so `computeRowData` reflects staged stamp/value deltas; ensure value scaling honors `ValueScale` and instance transforms.
- [x] **Store Actions** – Implement `startDrag`, `updateDrag`, `commitDrag`, `cancelDrag` using the new selection-driven resolution, including modifier handling & delta persistence.
- [x] **Canvas Integration** – Wire Canvas sheet markers to the new actions (pointer down/up/move), reuse `useDragGestures`, and honor snapping vs. freeform behavior.
- [ ] **Control Surfaces** – Update editor/control widgets to initiate vertical drags via the shared actions, including temporary keypoint insertion at the playhead when needed.
- [x] **Commit Pipeline** – `commitDrag` applies `applyDragDeltas` to canonical keypoints (using per-marker bounds/attributePath), clamps via anchor `ValueScale`/row bounds, and sorts points by `stamp` when horizontal deltas are present.
- [ ] **Validation & QA** – Add automated coverage where possible (unit tests for helpers, integration tests for selection → drag flow) and document manual QA (snapping, multi-axis, cancellation).

## Blackboard Usage
- Treat this section and the plan checkboxes as the running log for implementation. Update checkboxes as tasks complete.
- Record noteworthy deviations, simplifications, or pruned fields under **Blackboard Notes** below; include the rationale and follow-up owner.
- Mention open questions inline (e.g., TODO(semio-agent): ...) so future passes can resolve them before shipping.

### Blackboard Notes
- [x] _Example_: `normalizedValueDelta` is in active use for vertical drags; keep and document precision/clamp semantics.
- [ ] _Example_: Evaluate caching strategy for per-marker bounds; revisit if profiler shows lookup hotspots.
- [x] Preview violations: `computeRowData` now recomputes violation sets with staged drag deltas (via orchestrator/derived snapshot).
- [ ] Row padding: incorporate per-row vertical padding into backend-derived `verticalAxisByView` so drag normalization matches the on-screen vertical range exactly (prevents screen-space vs. value-space drift).
- [ ] Immediate feedback: disable x- and y-position animation on `data-point.tsx` and `transition-segment.tsx` while a drag is active for any selected `trackId`, so drag previews update instantly (no spring smoothing) and match `applyDragDeltas` precisely.

## Selection & Instance Preconditions
- `selectionState` must collapse to a single `instanceId`; mixed instances, namespaces, or non-editable rows block drag start.
- Transition segments can be selected but never initiate a drag; pointer drags on segment bodies are ignored.
- `startDrag` snapshots the active instance transform so stamp calculations stay stable even if the underlying instance settings change mid-gesture (those updates should be coordinated separately):
  ```ts
  interface DragStampTransform {
    offset: number;
    timescale: number;
  }
  ```
- The marker that initiated the drag is treated as the *anchor*. Its data is stored directly in the drag state; all other participating markers are derived live from `selectionState`.

## Keypoint Resolution (feedback requested)
- [x] **Option A (recommended)** – rely on `selectionState` (plus its tracked marker metadata) to resolve the active keypoints on demand, using the anchor only to define pointer deltas and normalization. This keeps drag state minimal and guarantees the drag reflects the latest selection. It matches the requirement that drags only start when all markers in the selection are eligible, so the selection remains the single source of truth.
- [ ] **Option B** – snapshot a `targets` map at drag start. This guards against mid-drag selection churn at the cost of duplicating selection data. Current implementation validates selection at commit (no automatic mid-drag cancellation). Surfaces may choose to cancel on selection change, but duplication remains unnecessary unless we allow selection mutations during a drag.

If we ever support mid-drag selection mutations, revisit whether Option B becomes necessary.

## Coordinate Systems
- The timeline UI emits pointer movement in normalized global space (`[0, 1]` across the visible timeline). Horizontal drags convert that delta into **local** animation time via the captured `DragStampTransform`:
  ```ts
  function toInstanceStamp(globalStamp: number, transform: DragStampTransform): number {
    return (globalStamp - transform.offset) / transform.timescale;
  }
  ```
  Because every selected marker belongs to the same instance, we compute this transform once and reuse it for all participants.
- Vertical drags operate in screen space. `startDrag` records a `ValueScale` for the anchor so vertical motion can be normalized consistently across tracks. UI surfaces must supply `normalizedValueDelta` computed as:
  - `normalizedValueDelta = -(pointerY - pointerOriginY) / pixelRange`
    - Use a negative sign so dragging up increases values (screen Y grows downward).
    - `pixelRange` must be the visible vertical height of the row’s value viewport. Include any vertical padding/margins that affect the plotted value space; ideally the backend exposes a view-aligned range (e.g., `verticalAxisByView`) that already accounts for row padding so screen-space drag maps exactly to value-space displacement.
  - The same `normalizedValueDelta` is reused for all selected markers; per-marker scaling to real units happens in previews/commits using each row’s `verticalBounds` from `computeRowData` or the anchor’s `ValueScale.domain`.
  ```ts
  interface ValueScale {
    domain: [number, number];
    clamp: boolean;
    precision?: number;
  }
  ```
- Existing utility hooks such as `useDragGestures` already convert Three.js pointer events into normalized `[0, 1]` positions. Continue to leverage those helpers (or equivalent logic) when feeding global stamp data into `updateDrag`.
- The legacy `applyDragOffsets` logic clamped previewed stamps and resorted track points after applying offsets. The new preview flow keeps that spirit by constraining horizontal deltas during `applyDragDeltas` and relying on downstream consumers to maintain chronological ordering when generating virtual frames.

## Drag State Shape
The drag state only exists while the gesture is active; clearing it returns to idle.

```ts
export type DragAxis = "horizontal" | "vertical" | "both";

export interface DragAnchorRef {
  keypointId: string;
  trackId: string;
  rowId: string;
  markerId: string;
  attributePath?: string[];      // e.g. ["value", "y"]
  valueScale?: ValueScale;       // anchor scale (vertical drags only)
}

export interface DragState {
  axis: DragAxis;                           // active axis preference (UI-level hint)
  instanceId: string;                       // this should be the same as state.selectionState.instanceId, and therefore may not be needed in the drag state as well.
  instanceTransform: DragStampTransform;
  anchor: DragAnchorRef;
  pointerOrigin: { x: number; y: number };  // screen coordinates at pointer down
  stampOrigin?: number;                     // anchor stamp in local time
  stampDelta?: {
    raw: number;
    snapped?: number;
  };
  anchorValueOrigin?: number;               // scalar extracted via attributePath
  normalizedValueDelta?: number;            // shared normalized delta
  modifiers: {
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
}
```

Notes:
- No target map is stored; all other marker metadata is read directly from `selectionState` when needed.
- `axis: "both"` allows callers to stage simultaneous stamp/value deltas. Individual render surfaces or keybinds can still decide to supply only one delta at a time.
- `anchorValueOrigin` is optional because horizontal drags do not require it.
- `normalizedValueDelta` is shared so every selected marker moves the same visible distance; individual value updates scale this delta into real units using per-track bounds.

## Data Locality & Store Integration
- `AnimationData.dragState` (see `store-types.ts`) carries this structure. Because the store already holds `selectionState`, `derivedSnapshot`, and track data, we can derive the full drag context without duplicating keypoint lists. The derived orchestrator rebuilds `derivedSnapshot` during drag updates; selectors can key off `derivedSnapshot.version` for coherent previews.
- Vertical bounds are available via `derivedSnapshot.rows[rowId].computed.verticalBounds`. Fetching them introduces a cross-lookup each update; duplicating them in `dragState` costs more memory but avoids recomputing at the expense of potential staleness. Current plan:
  - [x] **Option A (recommended)** – read bounds from `derivedSnapshot.rows[rowId].computed` on demand. When the spline view toggles between **Normalized** and **Uniform** axes, the orchestrator derives `verticalAxisByView` for each row. That range mirrors `verticalBounds` for non-spline renderers and becomes a view-scoped min/max when uniform scaling is active. Use it to translate the shared `normalizedValueDelta` into actual values so vertical drags stay aligned with what the user sees.
  - [ ] **Option B** – snapshot bounds (`ValueScale`) into `dragState`. Choose this only if repeated lookups prove too expensive and we can guarantee the snapshot stays valid for the drag duration.
- Other cached data should follow the same guideline: prefer derivation from `derivedSnapshot` or canonical slices unless profiling shows the cross-lookup to be a bottleneck.
- Keypoint dragging is implemented; legacy fields such as `draggedKeypoints`/`deltaStamp` were removed.

## Drag Actions
```ts
export interface DragActions {
  startDrag(input: DragStartInput): void;
  updateDrag(delta: DragUpdateInput): void;
  commitDrag(): void;
  cancelDrag(): void;
}

export interface DragStartInput {
  origin: { x: number; y: number };
  axis: DragAxis;
  markerId: string;                       // the clicked marker (anchor)
  rowId: string;                          // source row containing the anchor marker
  /**
   * Optional view-specific value scale to use for vertical drags.
   * When provided, this takes precedence over row-derived vertical bounds.
   */
  valueScale?: ValueScale;
}

export interface DragUpdateInput {
  pointer: { x: number; y: number };
  normalizedStamp?: {
    current: number;
    snapped?: number;
  };
  normalizedValueDelta?: number;
  modifiers: DragState["modifiers"];
}
```

### `startDrag`
- Validates selection + editability and confirms that the anchor marker belongs to the current selection.
- Saves the `AnimationInstanceSettings` for the shared instance as `instanceTransform`.
- Records the anchor’s keypoint metadata (`DragAnchorRef`) and extracts `stampOrigin`/`anchorValueOrigin`.
- Derives the anchor’s `ValueScale` from the row’s `verticalBounds` (preferred) or the underlying animatable definition.
- Sets up the initial pointer origin; if invariants fail, leaves `DragState` undefined.

### `updateDrag`
- Converts the pointer’s `normalizedStamp.current` into local time with `instanceTransform` and updates `stampDelta.raw`.
- Applies snapping rules using `normalizedStamp.snapped`. Mirror existing gesture behavior (`bounds-cart.tsx` + `useDragGestures`):
  - Default behavior snaps to `closestFrame`, so supply `normalizedStamp.snapped` and store it in `stampDelta.snapped`.
  - Holding `alt` bypasses snapping; leave `stampDelta.snapped` undefined so previews/commits use the raw delta.
  - Reserve `shift` for future precision overrides; ensure any implementation stays consistent with other timeline interactions.
- Vertical normalization input contract:
  - UI surfaces compute `normalizedValueDelta = -(pointer.y - pointerOrigin.y) / pixelRange`, where `pixelRange` is the visual height of the control’s value viewport for the active row. Upward drag increases values (negative screen Y).
  - The same `normalizedValueDelta` is reused for all selected markers; scaling to real units is performed in previews/commits using each marker’s bounds (`derivedSnapshot.rows[rowId].computed.verticalBounds`) or the anchor’s `ValueScale.domain`.
  - Keep `Alt` reserved for horizontal snap bypass. If a fine-adjust affordance is desired for vertical drags, use `Shift` to scale the delta (e.g., divide by 4) for consistency across surfaces.
- Mutates `DragState` only; track data remains untouched.

### `commitDrag`
- Validates selection and anchor membership; if they no longer match (e.g., deselection), clears `dragState` and returns without writes.
- Applies `applyDragDeltas` to each selected keypoint using per-marker bounds (from the snapshot) and `attributePath` resolved from the marker/row. When horizontal deltas are present, re-sorts points by `stamp`.
- Horizontal commits use `stampDelta.snapped ?? stampDelta.raw` (in local instance time).
- Vertical commits convert `normalizedValueDelta` using row `verticalBounds` or the anchor `ValueScale.domain`, applying clamp/precision per `ValueScale`.

### `cancelDrag`
- Clears `DragState`; no writes occur.

## Feeding Previews into `computeRowData`
Expose a helper that applies staged deltas before markers/segments are derived:

```ts
export function applyDragDeltas(
  keypoint: Keypoint<RawValue>,
  context: {
    dragState: DragState | undefined;
    selection: SelectionState;
    trackId: string;
    bounds?: { min: number; max: number };
    attributePath?: string[];
  },
): Keypoint<RawValue> {
  // Clones the keypoint and applies the staged stamp/value shifts based on the shared deltas.
}
```

Usage rules:
- `computeRowData` invokes `applyDragDeltas` for every keypoint as it builds `InstancedFrameInfo`, passing the active selection for context.
- Horizontal previews add the local `stampDelta` (prefer snapped when provided; fall back to raw) before interpolation calculations.
- Vertical previews clone and patch only the numeric component; resolve per-marker `attributePath` first (from the row/point), falling back to the anchor `attributePath`. Apply clamp (`ValueScale.clamp`) and precision (`ValueScale.precision`) during preview so visuals match commit.
- The helper reuses the same anchor-derived `normalizedValueDelta` for all selected markers, scaling by each row’s `verticalBounds` range when available, or by the anchor `ValueScale.domain` as a fallback, to keep the motion visually uniform.

## Legacy References
- Prior implementations (see `functions/apply-drag-offsets.ts` in commit history) applied offsets in `[0, 1]` space and resorted keypoints post-hoc. The current flow supersedes that approach by using `applyDragDeltas`/`commitDrag` directly in local instance time; the legacy helper is no longer called by runtime code.
- `hooks/use-drag-gestures.ts` remains the canonical way to receive normalized timeline positions. Consumers can pass `dragOptions` (thresholds, tap filtering, pointer config) to standardize behaviour across surfaces.

## UI Integration

- Control widgets and editor integration (alignment and fixes):
  - Use instance-scoped transforms for time mapping. When keying from controls, convert world/playhead stamp to local instance time using `localGlobalTransformLookup.toLocal[instanceId](stamp)`. Do not index by `namespaceId`. This fixes the runtime error seen when toggling keys in `control-widget.tsx`.
  - Route control-surface drags through the shared drag pipeline for consistency with canvas markers:
    - Start: ensure an anchor keypoint exists at the playhead. If none exists, insert a keypoint using the de Casteljau split (see “Key Insertion (de Casteljau) & Transition Normalization”), then focus/anchor selection to that marker and call `startDrag({ axis: "vertical", origin, markerId, rowId, valueScale })`. Derive `valueScale` from `derivedSnapshot.rows[rowId].computed.verticalBounds` or animatable constraints as a fallback.
    - Move: compute `normalizedValueDelta` from the control’s visible height: `-(pointerY - originY) / pixelRange`; call `updateDrag({ normalizedValueDelta, modifiers, pointer })`.
    - End/cancel: call `commitDrag()` or `cancelDrag()`.
  - When toggling a key (hex button):
    - If a key exists for all targets at the playhead: remove them.
    - Otherwise: insert via de Casteljau at the playhead (world stamp), then anchor selection to the inserted marker(s) so subsequent drags use the shared pipeline.
  - Marker resolution from controls: to obtain the `markerId` for `startDrag`, resolve it via `derivedSnapshot.rows[rowId].computed.virtualFrames` using `(trackId, keypointId)`; prefer a small utility to avoid duplicating this lookup logic in components.

- **Canvas markers**: call `startDrag` on pointer down (supplying the clicked marker), then drive `updateDrag` with the current pointer. Horizontal drags provide both `normalizedStamp.current` and `normalizedStamp.snapped`. Marker surfaces should pass `dragOptions` (e.g., `threshold`, `filterTaps`, `preventScroll`, `pointer: { touch: false }`) to `useDragGestures` so simple clicks do not enter drag mode prematurely. Current implementation snaps to frames by default (`closestFrame`) and allows freeform motion when `alt` is held, mirroring the playhead cart.
- **Animatable editor / Control widgets (vertical drags)**:
  - Start: ensure the anchor exists (insert a temporary keypoint at the playhead if none), then `startDrag({ axis: "vertical", origin, markerId, rowId })`.
  - Move: compute `normalizedValueDelta = -(pointer.y - pointerOrigin.y) / pixelRange`, where `pixelRange` is the visible height of the control’s value viewport for the active row. Pass it via `updateDrag({ normalizedValueDelta, modifiers, pointer })`. Use the same normalization on every move so screen-space motion maps to consistent value deltas across tracks with different ranges.
  - End: call `commitDrag()` (or `cancelDrag()` if the gesture didn’t move or invariants failed).
  - Use backend-provided `verticalAxisByView`/`verticalBounds` to keep the control’s visible vertical range in sync with preview/commit math; avoid hardcoding padding in the surface if the backend exposes it.
- **Immediate feedback during drag**: while a drag is active and the selection contains a track, disable x- and y-position spring animation for any visuals associated with that `trackId` so previews track pointer motion exactly. Concretely:
  - `data-point.tsx`: bypass the position springs and set x/y directly when the point’s `trackId` is in the current selection during an active drag.
  - `transition-segment.tsx`: bypass the springs for control point x/y values under the same condition.
- All surfaces pass modifier state through `DragUpdateInput`. Maintain consistent snapping semantics—default interactions snap to frames, while `alt` provides freeform drags just like `bounds-cart` and other timeline gestures. If fine vertical control is desired, use `Shift` to scale `normalizedValueDelta` (e.g., divide by 4).
- **Vertical support (canvas)**: marker-body drags currently emit only horizontal deltas; add dedicated vertical handles or modes for `TrackRender.Spline` later. When added, compute `normalizedValueDelta` from the row canvas viewport height (aligned with `verticalAxisByView`) to keep previews/commits visually uniform.

- **Canvas markers**: call `startDrag` on pointer down (supplying the clicked marker), then drive `updateDrag` with the current pointer. Horizontal drags provide both `normalizedStamp.current` and `normalizedStamp.snapped`. Marker surfaces should pass `dragOptions` (e.g., `threshold`, `filterTaps`, `preventScroll`, `pointer: { touch: false }`) to `useDragGestures` so simple clicks do not enter drag mode prematurely. Current implementation snaps to frames by default (`closestFrame`) and allows freeform motion when `alt` is held, mirroring the playhead cart.
- **Animatable editor / Control widgets (vertical drags)**:
  - Start: ensure the anchor exists (insert a temporary keypoint at the playhead if none), then `startDrag({ axis: "vertical", origin, markerId, rowId })`.
  - Move: compute `normalizedValueDelta = -(pointer.y - pointerOrigin.y) / pixelRange`, where `pixelRange` is the visible height of the control’s value viewport for the active row. Pass it via `updateDrag({ normalizedValueDelta, modifiers, pointer })`. Use the same normalization on every move so screen-space motion maps to consistent value deltas across tracks with different ranges.
  - End: call `commitDrag()` (or `cancelDrag()` if the gesture didn’t move or invariants failed).
  - Use backend-provided `verticalAxisByView`/`verticalBounds` to keep the control’s visible vertical range in sync with preview/commit math; avoid hardcoding padding in the surface if the backend exposes it.
- **Immediate feedback during drag**: while a drag is active and the selection contains a track, disable x- and y-position spring animation for any visuals associated with that `trackId` so previews track pointer motion exactly. Concretely:
  - `data-point.tsx`: bypass the position springs and set x/y directly when the point’s `trackId` is in the current selection during an active drag.
  - `transition-segment.tsx`: bypass the springs for control point x/y values under the same condition.
- All surfaces pass modifier state through `DragUpdateInput`. Maintain consistent snapping semantics—default interactions snap to frames, while `alt` provides freeform drags just like `bounds-cart` and other timeline gestures. If fine vertical control is desired, use `Shift` to scale `normalizedValueDelta` (e.g., divide by 4).
- **Vertical support (canvas)**: marker-body drags currently emit only horizontal deltas; add dedicated vertical handles or modes for `TrackRender.Spline` later. When added, compute `normalizedValueDelta` from the row canvas viewport height (aligned with `verticalAxisByView`) to keep previews/commits visually uniform.

## Key Insertion (de Casteljau) & Transition Normalization

When adding a key at the playhead in the middle of a segment, insert using de Casteljau splitting so the curve shape is preserved exactly before and after insertion.

- Motivation
  - `compute-track-interpolator` evaluates cubic segments using normalized keypoint transitions: each segment’s endpoints are keypoint values, and control points are derived from normalized `{ x, y }` transitions around the “from” keypoint (`out`) and “to” keypoint (`in`).
  - Inserting a key mid-segment should split the existing cubic at parameter u and convert the resulting control geometry back into normalized transitions around A (left), K (new), and B (right) so interpolation remains identical.

- Segment setup (matching `compute-track-interpolator`)
  - For adjacent points A → B in local instance time:
    - P0 = (A.time, A.value)
    - P3 = (B.time, B.value)
    - Control times:
      - cp1Time = A.time + (B.time - A.time) × clampX(A.transitions?.out?.x ?? 0.65)
      - cp2Time = A.time + (B.time - A.time) × clampX(B.transitions?.in?.x ?? 0.35)
    - Control values (per component/type):
      - cp1Value = lerp(A.value, B.value, A.transitions?.out?.y ?? 0)
      - cp2Value = lerp(A.value, B.value, B.transitions?.in?.y ?? 1)
    - This yields cubic [P0, P1, P2, P3] with P1 = (cp1Time, cp1Value), P2 = (cp2Time, cp2Value).

- Split with de Casteljau at u
  - Let `u = (K.time - A.time) / (B.time - A.time)` where `K.time` is the local (instance) time for the new keypoint.
  - Perform the construction:
    - Q0 = lerp(P0, P1, u), Q1 = lerp(P1, P2, u), Q2 = lerp(P2, P3, u)
    - R0 = lerp(Q0, Q1, u), R1 = lerp(Q1, Q2, u)
    - S = lerp(R0, R1, u)  // the split point, becomes K
  - Left cubic: [P0, Q0, R0, S]; Right cubic: [S, R1, Q2, P3].

- Normalize controls back into keypoint transitions
  - Convert absolute control times back to normalized x in [0, 1]:
    - For a subsegment [X, Y], any `cpTime` becomes `x = (cpTime - X.time) / (Y.time - X.time)`.
  - Convert control values back to normalized y weights:
    - For numeric values: `y = (cpValue - X.value) / (Y.value - X.value)` with stable 0-div handling (fallback to 0 for out.y and 1 for in.y).
    - For vectors/eulers/colors: compute y per component and pick a dominant component (largest |Y - X|) to infer a robust weight; fallback to 0.5 for degenerate spans.
  - Assign transitions:
    - A.transitions.out = parameters derived from [P0, Q0, R0, S] relative to [A, K].
    - K.transitions.in/out = parameters derived from left/right subsegments around K.
    - B.transitions.in = parameters derived from [S, R1, Q2, P3] relative to [K, B].
  - Defaults: when original transitions are absent, use the `compute-track-interpolator` defaults (out: { x: 0.65, y: 0 }, in: { x: 0.35, y: 1 }).

- Helper APIs to add
  - Insert helper: `insert-keypoint-with-decasteljau(track, worldStamp, instance)` → inserts K at the appropriate local stamp, updates A/K/B transitions using the rules above, and returns the inserted point and index.
  - Store action: `insertKeypointAtWorldStamp(trackId, worldStamp, instanceId)` → resolves the instance and calls the helper; used by controls and other surfaces.
  - Marker resolution utility: map `(rowId, trackId, keypointId)` → `markerId` via `derivedSnapshot.rows[rowId].computed.virtualFrames` to anchor selection/drag from control surfaces.

- Edge cases
  - Zero-length segment (A.time == B.time): fall back to inserting at end of segment with default transitions, or refuse insertion.
  - Identical values: choose y-weights that leave values unchanged (e.g., out.y = 0, in.y = 1).
  - Type handling: support number, vector2, vector3, euler, rgb, hsl. For strings/booleans, use step semantics (pre-split vs. post-split) consistent with `compute-track-interpolator`.

- Parameterization and tests alignment
  - Ensure the parameterized shape is consistent with keypoint transition semantics in `types/data/keypoint.ts` and track semantics in `types/data/track.ts`.
  - Validate against expectations in `src/tests/compute-transition-params.test.ts` (e.g., control points computed in real value space from normalized transitions).

## Validation & QA
- Unit: verify `applyDragDeltas` vertical scaling with per-row `verticalBounds` and anchor `ValueScale.domain` fallback; apply clamp and precision; no-op for non-numeric leaves; prefer per-marker `attributePath` over the anchor path when present.
- Integration: selection → `startDrag({ axis: "vertical" })` → `updateDrag({ normalizedValueDelta })` previews a uniform visible vertical displacement across tracks with different numeric ranges; `commitDrag()` writes match preview; points are sorted when horizontal deltas are present.
- Padding alignment: confirm pixelRange normalization matches backend `verticalAxisByView`, including any per-row padding; no drift between screen-space motion and value change across control surfaces and canvas.
- Immediate feedback: while a drag is active and a `trackId` is selected, visuals in `data-point.tsx` and `transition-segment.tsx` update x and y positions without spring smoothing; no lag relative to pointer movement.
- Modifiers: Alt bypasses only horizontal snapping; if fine vertical control is implemented, Shift scales `normalizedValueDelta` (e.g., divide by 4); ensure no unintended vertical snapping.
- Fallbacks: when per-row bounds are unavailable, fall back to the anchor domain; if neither is available, treat `appliedRange` as 1 or cancel the gesture per spec; assert behavior in tests.

## Cancellation & Error Handling
- If the selection changes or becomes empty during an active drag, we do not auto-cancel. Instead, `commitDrag` validates selection/anchor coherence and clears `dragState` without writes if invariants fail. Surfaces may choose to proactively cancel on selection change.
- If the resolved selection fails to provide bounds for a vertical drag, either fall back to unclamped scaling or cancel (implementation choice).
- Drag code never mutates `AnimationData` directly; only `commitDrag` performs writes.

## Future Work
- Multi-axis gestures can be enabled by allowing both `normalizedStamp` and `normalizedValueDelta` in `updateDrag`, but they should remain opt-in per UI surface.
- Legacy fields `DragState.deltaStamp` and `DraggedKeypoint.currentOffset` have already been removed.
- Re-evaluate the need for cached value bounds if vertical drags across many tracks reveal performance issues.
