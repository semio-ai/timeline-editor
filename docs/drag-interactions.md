# Drag Interactions

This spec defines how drag gestures stage stamp/value updates before they are committed to animation data. It complements the consolidated selection flow in `selection.md`, replaces the legacy `DragState`/`DraggedKeypoint` wiring, and avoids duplicating the selected marker set inside the drag state.

## Goals
- Treat drag as an operation on the resolved selection, independent of the UI surface that initiated it.
- Track only the information that cannot be recomputed from `selectionState` (anchor marker, pointer deltas, and instance transform).
- Preview horizontal and vertical deltas through `computeRowData` while leaving track data untouched until commit.
- Respect animation-instance transforms (`AnimationInstanceSettings`) so global pointer movement produces the same local result regardless of per-instance `offset`/`timescale`.
- Produce visually uniform vertical displacement even when selected tracks have different numeric ranges or nested value paths.
- Abort cleanly if the selection becomes invalid or the gesture is cancelled.

## Implementation Plan (check off as work lands)
- [ ] **Foundations** – Replace legacy `DragState` definitions (`types/util/drag-state.ts`, `store-types.ts`) with the anchor-first shape, update `AnimationActions` signatures, and remove unused migration helpers.
- [ ] **Preview Plumbing** – Implement `applyDragDeltas` (or equivalent) so `computeRowData` reflects staged stamp/value deltas; ensure value scaling honors `ValueScale` and instance transforms.
- [ ] **Store Actions** – Implement `startDrag`, `updateDrag`, `commitDrag`, `cancelDrag` using the new selection-driven resolution, including modifier handling & delta persistence.
- [ ] **Canvas Integration** – Wire Canvas sheet markers to the new actions (pointer down/up/move), reuse `useDragGestures`, and honor snapping vs. freeform behavior.
- [ ] **Control Surfaces** – Update editor/control widgets to initiate vertical drags via the shared actions, including temporary keypoint insertion at the playhead when needed.
- [ ] **Commit Pipeline** – Refactor keypoint updates to use `KeypointCommitDelta`/`applyKeypointDelta`, apply clamping, and maintain chronological ordering on commit.
- [ ] **Validation & QA** – Add automated coverage where possible (unit tests for helpers, integration tests for selection → drag flow) and document manual QA (snapping, multi-axis, cancellation).

## Blackboard Usage
- Treat this section and the plan checkboxes as the running log for implementation. Update checkboxes as tasks complete.
- Record noteworthy deviations, simplifications, or pruned fields under **Blackboard Notes** below; include the rationale and follow-up owner.
- Mention open questions inline (e.g., TODO(semio-agent): ...) so future passes can resolve them before shipping.

### Blackboard Notes
- [ ] _Example_: Confirm whether `normalizedValueDelta` is needed once vertical drags ship; remove if unused.
- [ ] _Example_: Evaluate caching strategy for per-marker bounds; revisit if profiler shows lookup hotspots.

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
- [ ] **Option B** – snapshot a `targets` map at drag start. This guards against mid-drag selection churn at the cost of duplicating selection data. Because current UX cancels the drag when selection changes, we consider this duplication unnecessary unless we later allow selection mutations during a drag.

If we ever relax the “selection change cancels drag” rule, revisit whether Option B becomes necessary.

## Coordinate Systems
- The timeline UI emits pointer movement in normalized global space (`[0, 1]` across the visible timeline). Horizontal drags convert that delta into **local** animation time via the captured `DragStampTransform`:
  ```ts
  function toInstanceStamp(globalStamp: number, transform: DragStampTransform): number {
    return (globalStamp - transform.offset) / transform.timescale;
  }
  ```
  Because every selected marker belongs to the same instance, we compute this transform once and reuse it for all participants.
- Vertical drags operate in screen space. `startDrag` records a `ValueScale` for the anchor marker so vertical motion can be normalized (e.g., pixels or a −1..1 gesture range). During previews/commits we map that normalized delta onto each selected track using their own bounds (from `computeRowData` or animatable metadata):
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
- `AnimationData.dragState` (see `store-types.ts`) carries this structure. Because the store already holds `selectionState`, `computedRowData`, and track data, we can derive the full drag context without duplicating keypoint lists.
- Vertical bounds are available via `computedRowData[rowId].verticalBounds`. Fetching them introduces a cross-lookup each update; duplicating them in `dragState` costs more memory but avoids recomputing at the expense of potential staleness. Current plan:
  - [x] **Option A (recommended)** – read bounds from `computedRowData` on demand. This ensures previews reflect any concurrent row recomputation and keeps `dragState` minimal.
  - [ ] **Option B** – snapshot bounds (`ValueScale`) into `dragState`. Choose this only if repeated lookups prove too expensive and we can guarantee the snapshot stays valid for the drag duration.
- Other cached data should follow the same guideline: prefer derivation from store slices unless profiling shows the cross-lookup to be a bottleneck.
- Because the current codebase does not yet implement keypoint dragging, we can replace the legacy type wholesale instead of maintaining compatibility with fields like `draggedKeypoints` or `deltaStamp`.

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
- For vertical drags, sets `normalizedValueDelta` from pointer movement relative to `pointerOrigin`. The anchor’s `ValueScale` translates physical motion into a normalized delta; the same delta is reused for all markers.
- Mutates `DragState` only; track data remains untouched.

### `commitDrag`
- Resolves the current selection to obtain the participating keypoints. If the selection no longer matches the anchor (e.g., deselection), `cancelDrag` is invoked instead.
- Builds `KeypointCommitDelta` objects by combining the stored deltas with live keypoint data:
  ```ts
  interface KeypointCommitDelta {
    id: string;
    trackId: string;
    stamp?: number;
    value?: {
      path?: string[];
      next: (current: RawValue) => RawValue;
    };
  }
  ```
- Horizontal commits add `stampDelta.snapped ?? stampDelta.raw` (still in local time) to each keypoint’s current stamp.
- Vertical commits convert `normalizedValueDelta` into per-track additive deltas using each marker’s bounds. These bounds come from `computeRowData`’s `verticalBounds` snapshot or the animatable definition if bounds are unavailable. Clamp when required.
- Dispatch the deltas through `applyKeypointDelta` to keep writes predictable.

### `cancelDrag`
- Clears `DragState`; no writes occur.

## Feeding Previews into `computeRowData`
Expose a helper that applies staged deltas before markers/segments are derived:

```ts
export function applyDragDeltas(
  keypoint: Keypoint<RawValue>,
  drag: DragState | undefined,
): Keypoint<RawValue> {
  // Clones the keypoint and applies the staged stamp/value shifts based on the shared deltas.
}
```

Usage rules:
- `updateComputedRowData` invokes `applyDragDeltas` for every keypoint as it builds `InstancedFrameInfo`.
- Horizontal previews add the local `stampDelta` (prefer snapped when provided; fall back to raw) before interpolation calculations.
- Vertical previews clone and patch only the numeric component referenced by `attributePath`, leaving the rest of the value intact.
- The helper uses the anchor-derived `normalizedValueDelta` and per-marker bounds (from `selectionState` context or row metadata) to keep the motion visually uniform.

## Legacy References
- `functions/apply-drag-offsets.ts` demonstrates the previous normalization flow: offsets were applied in `[0, 1]` space, clamped, and followed by point resorting. The new proposal keeps the same guarantees but centralizes them in `applyDragDeltas`/`commitDrag` so we operate on local instance time rather than raw normalized space.
- `hooks/use-drag-gestures.ts` shows how canvas interactions already provide normalized timeline positions. Reuse or adapt that hook for drag initiation to avoid duplicating coordinate math and to ensure drags continue when the cursor leaves the element.

## UI Integration

- **Canvas markers**: call `startDrag` on pointer down (supplying the clicked marker), then drive `updateDrag` with the current pointer. Horizontal drags provide both `normalizedStamp.current` and `normalizedStamp.snapped`.
- **Animatable editor / Control widgets**: treat slider drags as vertical drags using the same anchor-first flow. When editing the playhead without an existing keypoint, insert a temporary keypoint before `startDrag` so the staged delta references a real ID.
- All surfaces pass modifier state through `DragUpdateInput`. Maintain consistent snapping semantics—default interactions snap to frames, while `alt` provides freeform drags just like `bounds-cart` and other timeline gestures.

## Cancellation & Error Handling
- If the selection changes or becomes empty during an active drag, automatically `cancelDrag`. This guarantees the anchor no longer conflicts with `selectionState`.
- If the resolved selection fails to provide bounds for a vertical drag, either fall back to unclamped scaling or cancel (implementation choice).
- Drag code never mutates `AnimationData` directly; only `commitDrag` performs writes.

## Future Work
- Multi-axis gestures can be enabled by allowing both `normalizedStamp` and `normalizedValueDelta` in `updateDrag`, but they should remain opt-in per UI surface.
- Once the new flow ships, remove `DragState.deltaStamp` and `DraggedKeypoint.currentOffset`.
- Re-evaluate the need for cached value bounds if vertical drags across many tracks reveal performance issues.
