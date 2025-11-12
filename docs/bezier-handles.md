# Bezier Handles (Spline View)

## Design Decisions and Data Flow

- Centralize curve math in the derived snapshot
  - Compute canonical “raw” transitions (with defaults) and map them to world-space control points per segment during snapshot build.
  - Apply anti-knot clamping to produce “effective” control points (runtime-only) to guarantee monotonic X and prevent backtracks/knots.
  - Optionally pre-bake “Transition” mode parameters (normalized y) so components do not perform normalization logic.
  - Rationale: a single authoritative computation per segment keeps visuals (curves, handles), interpolators, and violations consistent and avoids duplicating math in components.

- Enrich `InstancePair` (segment-level) as the single source of truth
  - Add fields:
    - `transitionsRaw?: { startOut?: RawVector2; endIn?: RawVector2 }`
    - `transitionsEffective?: { startOut?: RawVector2; endIn?: RawVector2 }`
    - `controlPointsRaw?: { cp1?: {x,y}; cp2?: {x,y} }`
    - `controlPointsEffective?: { cp1?: {x,y}; cp2?: {x,y} }`
    - `flags?: { cp1Clamped?: boolean; cp2Clamped?: boolean; knotPrevented?: boolean }`
    - (Optional) `renderParams` for pre-baked “Transition” mode if we want zero math in components
  - Efficiency: compute once per segment in the derived pass (O(segments)); memory overhead is minimal (a few 2D points + flags).

- Always render handles; defaults become visible handles
  - When a keypoint lacks explicit transitions, visualize defaults (ease-in-out) as the raw handles.
  - Raw handles are interactive; effective handles are smaller/less-salient indicators along the connector toward the data-point, showing runtime clamp.
  - As markers move, world-space handles resize because world = f(normalized, endpoints). On first manipulation, write explicit normalized transitions.

- Default coupling (cross-segment coordination)
  - Interior keypoint K couples `K.in` and `K.out` by default (no modifiers): colinear (180° apart) and equal magnitude (locked angle and length).
  - Modifiers:
    - Alt: free (breaks coupling; dragged side moves independently).
    - Shift: locked angle only (colinear), lengths mirrored by default.
    - Shift+Alt: locked angle (colinear) with independent lengths.
  - Dragging one side updates the complementary side (spanning the two adjacent segments). Solve normalized transitions for both sides from world CPs and stage in preview.

- Preview patches in drag state
  - During handle drags, stage a small “handle preview patch map” keyed by keypoint ID (and side) with normalized transitions to apply.
  - The derived builder consumes preview patches to produce up-to-date raw/effective CPs for both adjacent segments (coupling-aware) before rendering.

- UI-only constraints during handle drags
  - Only enforce that a handle cannot cross its own keypoint X:
    - A.out: `cp1.x ≥ A.stamp`
    - B.in: `cp2.x ≤ B.stamp`
  - Allow overshoot in x (beyond neighbor; outside 0–1) and in y (below 0 or above 1). Any resulting backtrack is handled by the effective clamp at snapshot time; the raw handle remains interactive.

- Component responsibilities (thin, view-focused)
  - `TransitionSegment`: read precomputed segment geometry from `InstancePair` (effective CPs), apply view scaling (vertical axis) and draw. No curve math or normalization in the component.
  - `BezierHandles` (new): read `controlPointsRaw` (interactive) and `controlPointsEffective` (smaller, grayed indicator), apply view scaling, and render handles + connectors. No curve math.
  - `DataPoint`: focus on marker visuals/selection. Prefer segment-centric handle rendering; if marker-owned handles are needed later, the snapshot should expose an adjacency index to avoid O(n) scans.

- Zustand and immutability
  - Canonical writes happen via store actions; the derived orchestrator materializes a fresh snapshot (including segment geometry and flags) on changes.
  - Components subscribe to the snapshot and avoid recomputing curve math, improving coherence and performance.

- Migration plan
  1. Extend `InstancePair` with the new fields.
  2. Update the derived builder to:
     - Resolve canonical transitions with defaults and apply preview patches (including coupling results).
     - Compute world CPs (raw); run anti-knot clamp to get effective CPs and flags.
     - (Optional) pre-bake normalized “Transition” params.
  3. Update `TransitionSegment` to consume precomputed values; add `BezierHandles` to render raw/effective handles.
  4. Implement handle drag helpers for coupling and world→normalized solving; wire preview patches into drag actions.
  5. Add tests for coupling, anti-knot clamping, default-to-explicit transition promotion, and preview/commit equivalence.


Note: Helper APIs and type additions below are concrete proposals to support anti-knot clamping, marker-drag handle invariance, and raw/effective control-point visualization.

Helper APIs (signatures)
```/dev/null/anti-knot-helpers.ts#L1-200
// World-space control point
export interface WorldCP {
  x: number;
  y: number;
}

// Normalized transition around endpoints (canonical)
export interface EndpointTransitions {
  startOut?: RawVector2; // A.transitions.out
  endIn?: RawVector2;    // B.transitions.in
}

// Flags indicating clamping effects
export interface ClampFlags {
  cp1Clamped?: boolean;      // startOut effective CP shortened toward A
  cp2Clamped?: boolean;      // endIn effective CP shortened toward B
  knotPrevented?: boolean;   // any backtrack/overlap prevented
}

// Input for anti-knot clamping on a single segment (A → B)
export interface ClampInput {
  start: { stamp: number; value: number };  // A (local instance time, real value)
  end: { stamp: number; value: number };    // B
  rawTransitions: EndpointTransitions;      // canonical normalized transitions
  epsilon?: number;                         // small safety margin for monotonic X (default ~1e-6)
}

// Output contains raw and effective CPs in world space and effective normalized transitions
export interface ClampOutput {
  // World-space CPs computed from raw (canonical) transitions
  cp1Raw?: WorldCP; // from startOut
  cp2Raw?: WorldCP; // from endIn

  // World-space CPs after anti-knot clamping for rendering/interpolators
  cp1Effective?: WorldCP;
  cp2Effective?: WorldCP;

  // Effective normalized transitions that would reproduce the effective CPs
  transitionsEffective: EndpointTransitions;

  // Summary flags
  flags: ClampFlags;
}

/**
 * Compute effective (anti-knot) control points for a monotonic X cubic segment.
 * - Raw CPs are derived from canonical normalized transitions.
 * - Effective CPs are scaled toward their anchors to satisfy P0.x ≤ P1.x ≤ P2.x ≤ P3.x.
 * - Returns both raw/effective CPs and effective normalized transitions.
 */
export function clampMonotonicCubicSegment(input: ClampInput): ClampOutput;

/**
 * Solve a normalized transition from a world-space CP so a handle appears visually
 * fixed relative to its endpoint after the endpoint moves (marker-drag invariance).
 *
 * anchor:
 *  - "startOut": solve A.transitions.out from CP world, given A′ and B (possibly updated A′)
 *  - "endIn":    solve B.transitions.in from CP world, given A and B′ (possibly updated B′)
 *
 * Policy for degenerate spans:
 *  - If (B.stamp - A.stamp) === 0: x remains previous, or clamp to {0,1} by policy.
 *  - If (B.value - A.value) === 0: keep previous y (stable), or use default {0,1} by policy.
 */
export function solveNormalizedTransitionFromWorldCP(params: {
  anchor: "startOut" | "endIn";
  cpWorld: WorldCP;
  start: { stamp: number; value: number }; // current A (or A′ if moved)
  end: { stamp: number; value: number };   // current B (or B′ if moved)
  previous?: RawVector2;                   // previous normalized fallback for degenerate spans
}): RawVector2;

/**
 * Enforce the single UI constraint for handle drags:
 * - A.out CP cannot cross A.x in the negative direction (cp.x ≥ A.x)
 * - B.in  CP cannot cross B.x in the positive direction (cp.x ≤ B.x)
 * Returns the clamped world CP for the dragged handle.
 */
export function clampHandleAgainstOwnKeypointX(params: {
  anchor: "startOut" | "endIn";
  cpWorld: WorldCP;
  startX: number; // A.stamp
  endX: number;   // B.stamp
}): WorldCP;
```

Type additions/changes (proposals)
- InstancePair: carry raw/effective transitions and world control points per segment so renderers and interpolators share a consistent view.
```semio_studio/packages/animation/src/types/util/instance-pair.ts#L1-200
import { InstancedFrameInfo } from "./instanced-frame-info";
import type { RawVector2 } from "@semio/utils";

export interface InstancePair {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  buffer?: boolean;

  // Canonical (raw) normalized transitions used to generate raw CPs
  transitionsRaw?: {
    startOut?: RawVector2;
    endIn?: RawVector2;
  };

  // Effective normalized transitions after anti-knot clamp
  transitionsEffective?: {
    startOut?: RawVector2;
    endIn?: RawVector2;
  };

  // World CPs derived from raw (canonical) transitions
  controlPointsRaw?: {
    cp1?: { x: number; y: number }; // from startOut
    cp2?: { x: number; y: number }; // from endIn
  };

  // World CPs after anti-knot clamping (used for visuals/interpolators)
  controlPointsEffective?: {
    cp1?: { x: number; y: number };
    cp2?: { x: number; y: number };
  };

  // Summary flags for visualization/debugging
  flags?: {
    cp1Clamped?: boolean;
    cp2Clamped?: boolean;
    knotPrevented?: boolean;
  };
}
```

- No change is required to `InstancedFrameInfo` for raw/effective CPs since handles belong to the segment A → B, but if we later want per-frame visibility of “adjacent” handle positions for UI hover states, we can add optional read-only mirrors:
```semio_studio/packages/animation/src/types/util/instanced-frame-info.ts#L1-200
// Optional, UI-oriented mirrors (read-only; derived)
export interface InstancedFrameInfo {
  // ...
  // adjHandlesRaw?: { out?: { x:number; y:number }; in?: { x:number; y:number } };
  // adjHandlesEffective?: { out?: { x:number; y:number }; in?: { x:number; y:number } };
}
```

- ComputedRowData remains structurally the same; consumers read `interpolations: InstancePair[]` which now carries raw/effective geometry:
```semio_studio/packages/animation/src/types/util/computed-row-data.ts#L1-120
export interface ComputedRowData {
  virtualFrames: InstancedFrameInfo[];
  interpolations: InstancePair[];          // now enriched with raw/effective CPs and transitions
  verticalBounds: { min: number; max: number };
  violationSet: ViolationSet;
  verticalAxisByView?: Record<string, VerticalAxisRange>;
}
```

- Derived snapshot: no core shape change needed; `buildDerivedSnapshot` should:
  - Populate InstancePair.transitionsRaw/controlPointsRaw from canonical data.
  - Run `clampMonotonicCubicSegment` per segment to fill transitionsEffective/controlPointsEffective and flags.
  - Optionally reflect per-frame mirrors if we adopt the optional `InstancedFrameInfo` fields above.

Implementation notes
- Effective CP computation happens during snapshot build, so all downstream consumers (TransitionSegment, BezierHandles, interpolators, violations) use effective geometry in steady state and preview. The raw CPs are provided alongside for visualization of “extensions” and interactive handles.
- Marker drag invariance uses `solveNormalizedTransitionFromWorldCP` during preview and commit when a keypoint moves; only apply to endpoints that already have transitions defined.
- Handle drags use `clampHandleAgainstOwnKeypointX` at the UI-level to enforce the only movement constraint; overshoot in x/y is allowed and any knots are reflected in the effective CPs.

This document proposes the rendering and interaction model for Bezier “handles” in the Spline view. Handles appear on a transition segment when at least one of the two endpoint markers (data-points) on that curve is selected. Users can drag handles to modify the segment’s shape by updating the normalized transition parameters around each endpoint keypoint.

The plan aligns with the drag and preview flow described in `docs/drag-interactions.md`, reuses the transition semantics in `types/data/keypoint.ts`, and matches the geometry produced by `functions/compute-transition-params.ts`.

---

## Objectives

- Show control handles for a transition segment when at least one endpoint marker on that segment is selected.
- Render handle positions in “real” coordinate space so they visually align with the Spline curve (not normalized [0,1]).
- Support dragging a handle to update the corresponding keypoint’s normalized transition values:
  - Start point’s “out” handle: `start.transitions.out: { x, y }`
  - End point’s “in” handle: `end.transitions.in: { x, y }`
- Preview edits through the existing derived/preview pipeline; commit writes to canonical keypoint data.
- Keep consistent with `compute-transition-params.ts` so the visible handle matches the curve’s control points.

---

## Terminology and Semantics

- For adjacent keypoints A → B (both stamps in local instance time):
  - Segment span in time: `spanX = B.stamp - A.stamp`
  - Start and end real values in the selected attribute: `A.value`, `B.value` (scalar)
  - Value delta: `deltaY = B.value - A.value`
- Normalized transitions around keypoints:
  - A.out: `{ x, y }` where:
    - Control time: `cp1.x = A.stamp + spanX * x`
    - Control value: `cp1.y = A.value + deltaY * y`
  - B.in: `{ x, y }` where:
    - Control time: `cp2.x = A.stamp + spanX * x`
    - Control value: `cp2.y = A.value + deltaY * y`
- Defaults are cubic-ease-in-out when transitions are undefined:
  - `out: { x: 0.65, y: 0 }`, `in: { x: 0.35, y: 1 }`
- Spline rendering uses “real” values: y is the raw scalar value and is later mapped to pixels via the Spline view’s vertical axis transform.

These are the exact rules implemented by `compute-transition-params.ts`. Handles will compute their world positions using the same rules so they always align to the visible curve.

---

## When Do Handles Appear?

- TrackRender gating: only in `TrackRender.Spline`.
- Selection gating: for a given transition segment A → B within a source row:
  - If either A or B marker is selected for the same instance and track, show both handles for that segment.
  - If neither A nor B is selected, do not show handles.
- Missing transitions: if the keypoint has no transitions, show handles at default parameters and initialize transitions on first drag/commit.

This behavior ensures you can shape a transition by selecting either endpoint.

---

## Visuals

- Handle geometry:
  - A small circle (screen-size stabilized with invariant scale) at the control point.
  - A thin line from the keypoint’s hexagon to its handle (A → cp1 for out, B → cp2 for in).
- Colors:
  - Use the same base color as the segment or track.
  - Slightly brighten on hover; emphasize when the parent row is hovered.
- Layering:
  - Render above the curve line and key hexagons when the parent track is selected.
  - Use existing Z bands; reserve an additional epsilon to avoid z-fighting with the curve.

---

## Coordinate Systems

- X: world stamp in [0, 1] (global). Convert to local instance time when needed using the same transform used by drag state.
- Y: real scalar value (not normalized). The Spline view maps it to pixels using the same linear scale used for `TransitionSegment` and `DataPoint`:
  - domain: row vertical bounds or view’s vertical axis range
  - range: Spline viewport pixel bounds (centered span with optional visual offset/scale)

The handle renderer must use the same “domain → pixel” transform as `TransitionSegment` so handle positions line up with the curve.

---

## Rendering Architecture

- New component(s):
  - `BezierHandles` (or `TransitionHandles`): renders CP1 (A.out) and CP2 (B.in) for a single segment.
    - Inputs: `start`, `end`, `sourceRow`, `trackRender`, `verticalBounds`, `verticalAxisRange`, `layer`, `color`, `isRowHovered`.
    - Derived geometry:
      - Compute CP1/CP2 world positions using the same formulas as `compute-transition-params.ts`.
      - Map y to screen with the Spline vertical scale (same as `TransitionSegment`).
    - Interactivity:
      - Each handle is an interactive hotspot; on drag start, initiate handle drag; on move, preview; on end, commit.
      - A connecting line is non-interactive visual glue.
- Integration:
  - Render `BezierHandles` alongside each `TransitionSegment` that qualifies (Spline mode and selection gating).
  - Follow the same grouping and depth strategy as `TransitionSegment` to keep visual ordering consistent.

---

## Interaction Model

- Hover:
  - Cursor changes to “pointer” over the handle.
  - Emphasize the handle and (optionally) the connecting line.
- Drag:
  - Begin: capture which handle (A.out or B.in) is being dragged and snapshot the segment endpoints needed to compute normalized coordinates.
  - Move:
    - Compute normalized `x` from pointer stamp relative to [A.stamp, B.stamp]:
      - `x = clamp01((localStamp - A.stamp) / (B.stamp - A.stamp))`
    - Compute normalized `y` from pointer value relative to [A.value, B.value]:
      - If `deltaY !== 0`, `y = clamp01((worldValue - A.value) / deltaY)`
      - If `deltaY === 0`, keep existing `y` (no-op) or treat y as 0/1 by policy; visually, vertical changes don’t affect a flat segment.
    - Update the corresponding transition in preview:
      - A.out when dragging CP1; B.in when dragging CP2.
  - End:
  -   - Commit the new normalized `{ x, y }` into the keypoint’s `transitions` object, creating it if needed.
  -   - Reset: provide a hotkey (TBD) to reset the selected keypoint’s handles to “flat”:
  -     - For a segment A → B: set `A.transitions.out` to `{ x: 0.65, y: 0 }` and `B.transitions.in` to `{ x: 0.35, y: 1 }` (defaults used by `compute-transition-params.ts`).
- Modifiers and constraints:
-  - Clamp `x` and `y` to [0,1].
-  - Alt: independent rotation and scale of the dragged handle relative to its complement (the opposite handle on the same keypoint).
-  - Shift: constrain the dragged handle to remain colinear with its complement (same angle/tangent). Lengths mirror by default in this mode.
-  - Shift+Alt: keep the handles colinear (same angle) while allowing independent scaling (handle lengths may differ).
-  - Handle drags do not use horizontal frame snapping; Alt no longer means “bypass snap” for handles. Marker drags retain their existing Alt/Shift semantics per `drag-interactions.md`.

---

## Store and Preview Integration

We reuse the drag/preview architecture in `docs/drag-interactions.md`, but specialize for handles.

- Anchor reference:
  - Extend the drag anchor union to support handles:
    - `anchor.kind: "marker" | "handle-in" | "handle-out"`
    - `anchor.keypointId`, `anchor.trackId`, `anchor.rowId`, plus for handles, the remote endpoint keypoint id to compute normalization against (A for out uses next B, B for in uses previous A).
- Transform inputs:
  - `instanceTransform` is still required to convert between global stamp and local instance time.
  - Vertical mapping uses the same view axis transform (`verticalBounds` or `verticalAxisRange`) as Spline.
- Preview strategy:
  - During a handle drag, we must reflect temporary transition updates in all segment computations.
  - Two options:
    - A) Patch transitions during derivation (recommended):
      - Add a light-weight “handle previews” patch map to drag state, keyed by `keypointId`, with partial `{ in?: RawVector2; out?: RawVector2 }`.
      - The derived orchestrator (or `computeRowData`) applies these patches to keypoints when building `InstancedFrameInfo`. Then `compute-transition-params.ts` sees the previewed transitions automatically.
    - B) Clone-and-override segments inside `TransitionSegment`:
      - Pass override cp1/cp2 directly to visual components without changing data inputs. Simpler to render but diverges from central preview derivation.
  - Choose A to stay consistent with the global preview pipeline and keep all visuals in sync.
- Commit:
  - On `commitDrag`, call `updateKeypoint` (or a new helper) to write the patched `transitions.{in|out}` back to the canonical keypoint.
  - Ensure the keypoint has a `transitions` object after commit.
  - Clear the handle-preview map in drag state.

---

## Data Required at Drag Time

- For CP1 (A.out):
  - A: `stampA`, `valueA`
  - B: `stampB`, `valueB`
  - Conversions:
    - `x = clamp01((localPointerStamp - stampA) / (stampB - stampA))`
    - `y = deltaY !== 0 ? clamp01((worldPointerValue - valueA) / (valueB - valueA)) : keep existing y`
- For CP2 (B.in):
  - Same formulas, but normalization still uses A’s origin; see `compute-transition-params.ts` (both cp1 and cp2 times are computed off A.stamp; both y’s are computed with A.value/deltaY).
- Pointer-to-world conversions:
  - X: normalized global stamp → local instance time using `instanceTransform`.
  - Y: invert the Spline view’s value scale:
    - `worldValue = inverseLinearScale(pointerY, [pixelMin, pixelMax], [domainMin, domainMax])`
  - The renderer already has the Spline axis range and domain; reuse them to avoid drift.

---

## Edge Cases

- Zero span in time (`A.stamp === B.stamp`): do not allow x changes; keep x at current value.
- Zero delta in value (`A.value === B.value`): y changes have no visual effect; keep y stable or clamp to {0,1}.
- Missing transitions:
  - On first drag, create `transitions` with the existing (or default) `{in|out}` and apply edits.
- Non-numeric or multi-source rows:
  - Handles are only shown for single-source numeric rows in Spline view (consistent with current Spline assumptions). If/when multi-attribute support expands, we will document attribute selection rules.

---

## Implementation Plan (Phased)

Phase 1 — Read-only visuals and selection gating
- Add `BezierHandles` component.
- Compute CP positions using the same formulas as `compute-transition-params.ts`.
- Show handles for segments where A or B marker is selected.
- Render circle + connecting line to the respective keypoint hexagon.

Phase 2 — Drag previews
- Extend drag state with a handle anchor kind and a handle preview patch map keyed by `keypointId`.
- Add actions: `startHandleDrag`, `updateHandleDrag`, `commitHandleDrag`, `cancelHandleDrag` (wrappers over generic drag actions are fine if we use an anchor kind).
- In derivation, apply handle previews before building `InstancedFrameInfo` so `compute-transition-params.ts` sees updated transitions.
- While dragging, bypass springs for affected visuals (curves and points) as already done for marker drags.

Phase 3 — Commit path and tests
- On commit, write normalized `{ x, y }` back to the target keypoint’s `transitions.{in|out}` via `updateKeypoint`.
- Add unit tests for:
  - Normalization math (x/y) given pointers and endpoints.
  - Preview vs. commit equivalence (curve shape).
  - Clamp behavior and degenerate segments.

Phase 4 — Nice-to-haves
- Precision mode (Shift).
- Optional handle snapping for `x` to common fractions (0.25, 0.5, 0.75).
- Additional snapping modes (e.g., common fractions for `x`) and tangent-length linking shortcuts beyond Shift/Alt.

---

## Example Anchor Payloads

- Out handle drag:
  - `anchor: { kind: "handle-out", keypointId: A.id, trackId, rowId, instanceId }`
  - Also store `neighborKeypointId: B.id` to resolve normalization span.
- In handle drag:
  - `anchor: { kind: "handle-in", keypointId: B.id, trackId, rowId, instanceId }`
  - Also store `neighborKeypointId: A.id`.

At update time, compute normalized x/y with A and B pulled from the derived snapshot (to reflect live preview and selection).

---

## Anti-knot constraints and effective handles

Context and goals
- We must prevent knots/backtracks in transition curves. In practice, that means the cubic’s X dimension must remain monotonic across each segment A → B. A practical sufficient condition is to enforce P0.x ≤ P1.x ≤ P2.x ≤ P3.x where P0 = A, P3 = B, and P1/P2 are the control points.
- The Spline view shows handles in world space, but transitions are stored in normalized parametric space. Some operations therefore require translating between the two spaces and optionally applying an “effective” clamp that preserves validity without mutating the canonical transitions.

1) Marker drag should preserve the apparent handle relative to the marker
- When dragging a keypoint (marker), the handle(s) “attached” to that marker should appear visually stationary relative to the marker, even though transitions are normalized to neighbors. To achieve this:
  - Before drag update, compute the world-space CP(s) for that marker using the current normalized transitions and A/B values/stamps:
    - For A.out:
      - cpWorld.x = A.stamp + spanX * (A.transitions?.out?.x ?? 0.65)
      - cpWorld.y = A.value + deltaY * (A.transitions?.out?.y ?? 0)
    - For B.in (mirrored semantics with cp time computed off A.stamp as per compute-transition-params.ts):
      - cpWorld.x = A.stamp + spanX * (B.transitions?.in?.x ?? 0.35)
      - cpWorld.y = A.value + deltaY * (B.transitions?.in?.y ?? 1)
  - After the marker’s new position/value A′ (or B′) is determined by the drag delta, re-solve normalized transitions from the stored cpWorld to keep the visual relationship intact:
    - For A.out after A moves (B constant):
      - x′ = clamp01((cpWorld.x - A′.stamp) / (B.stamp - A′.stamp))
      - y′ = deltaY′ !== 0 ? clamp01((cpWorld.y - A′.value) / (B.value - A′.value)) : keep previous y (or 0 by policy)
    - For B.in after B moves (A constant):
      - x′ = clamp01((cpWorld.x - A.stamp) / (B′.stamp - A.stamp))
      - y′ = deltaY′ !== 0 ? clamp01((cpWorld.y - A.value) / (B′.value - A.value)) : keep previous y (or 1 by policy)
  - Only apply this re-solve to handles that exist (i.e., when a keypoint hasn’t specified a transition, do not fabricate or update one).
  - Apply this in both preview (during drag) and commit paths so the visual invariance matches the final state.
  - Note: When the dragged keypoint sits between two segments, apply the rule to both adjacent handles (its out for left segment; its in for right segment) independently.

2) Anti-knot “effective length” when markers approach each other
- When A and B move close enough that the raw handles would produce a backtrack (non-monotonic X) or a knot, shorten only the effective handle lengths used by rendering/interpolation until the curve is valid. Do not write these shortened handles back to canonical transitions.
- Policy:
  - Maintain the sufficient monotonic condition in X: P0.x ≤ P1.x ≤ P2.x ≤ P3.x. If violated, scale CPs toward their anchors along the line from keypoint to control so they satisfy the ordering with small epsilon margins.
  - Do not alter the canonical `transitions` stored on keypoints when reducing effective length; treat this as a runtime clamp.
  - The effective result is restored to the canonical shape automatically when markers are moved apart far enough to be valid again.
- Where to compute effective handles:
  - Implement the “effective transitions” during snapshot derivation (the subscription/orchestrator path), so downstream consumers—visuals, interpolators, and violation computation—use the same clamped control points consistently.
  - Concretely, extend `buildDerivedSnapshot` (invoked from the derived orchestrator) to compute, per segment:
    - raw control points from canonical transitions
    - effective control points after anti-knot clamping
  - Feed the effective control points to `compute-transition-params` consumers or provide them alongside raw values so visuals can render both (see visualization below).
- Visualization of raw vs effective (extensions):
  - When a marker on the segment is selected and an effective clamp is in effect (effective ≠ raw):
    - Render the raw (canonical) handle as the interactive handle at the raw control point.
    - Also render the effective handle as a smaller, less salient circle placed along the line between the raw control point and the data-point hexagon; the segment of the connector between the effective and raw positions visually indicates the clamped portion.
  - This requires exposing both raw and effective world-space control point positions to the Spline renderer during preview and steady state.

3) Handle drag constraints (while dragging the handle itself)
- We do not introduce an effective/raw split for handle drags. Instead, we constrain the actual handle position during drag so it cannot enter an invalid configuration:
  - Prevent crossing the keypoint’s X:
    - For A.out (left keypoint), constrain cp1.x ≥ A.stamp.
    - For B.in (right keypoint), constrain cp2.x ≤ B.stamp.
  - Do not enforce monotonic X during direct handle drag:
    - The handle may overshoot beyond the adjacent marker (e.g., x can move outside the 0–1 span such as 1.4). Any resulting backtracking/knot will be visualized and evaluated via the effective clamp in the snapshot; the raw handle remains interactive.
  - Y is not constrained; it can go below 0 or above 1 (overshooting the neighboring value). Any invalidities are handled by the effective clamp during derivation.
  - Store the constrained normalized `{x, y}` in preview; commit writes the constrained values to canonical transitions.

4) Modifiers recap for handle drags (with constraints)
- Alt: independent rotation and scale of the dragged handle relative to its complement (the opposite handle on the same keypoint). Only the keypoint-X crossing constraint applies; overshoot in x (past the neighbor, beyond 0–1) and y is allowed. Any backtrack is handled via the effective clamp.
- Shift: constrain the dragged handle to remain colinear with its complement (same angle/tangent). By default, mirror lengths. Only the keypoint-X crossing constraint applies; overshoot in x and y is allowed; any backtrack is handled via the effective clamp.
- Shift+Alt: keep handles colinear (same angle) while allowing length to differ (independent scale). Only the keypoint-X crossing constraint applies; overshoot in x and y is allowed; any backtrack is handled via the effective clamp.
- Reset hotkey (TBD): reset handles to the flat defaults (`out: {x: 0.65, y: 0}`, `in: {x: 0.35, y: 1}`) for the selected segment’s endpoints.

Types and derived data proposals
- Drag anchor kinds (as previously proposed):
  - `anchor.kind: "marker" | "handle-in" | "handle-out"`
  - For handles, carry `neighborKeypointId` to resolve normalization span.
- Snapshot extensions (per segment and frame):
  - Expose both raw and effective transitions and world control points:
    - `transitionsRaw: { in?: RawVector2; out?: RawVector2 }`
    - `transitionsEffective: { in?: RawVector2; out?: RawVector2 }`
    - `controlPointsRaw: { cp1: {x,y}, cp2: {x,y} }`
    - `controlPointsEffective: { cp1: {x,y}, cp2: {x,y} }`
    - `flags: { cpClamped?: boolean; knotPrevented?: boolean }`
  - These can live on the segment-level structure emitted when building `InstancedFrameInfo` pairs, or in a sibling “segment computed” map referenced by `TransitionSegment` and `BezierHandles`.
- Where to implement:
  - Add an anti-knot helper used by `buildDerivedSnapshot`:
    - Input: A, B, raw cp1/cp2
    - Output: effective cp1/cp2 meeting P0.x ≤ P1.x ≤ P2.x ≤ P3.x, with minimal scaling toward anchors
  - Ensure `init-derived-orchestrator.ts`’s flow uses the snapshot with effective control points when computing curve visuals and interpolators.
- Open items/notes:
  - Degenerate spans (A.stamp === B.stamp): skip X adjustments; clamp all CP.x to that stamp; handle Y gracefully.
  - Zero delta values (A.value === B.value): y-weight normalization becomes undefined; adopt a stable policy (keep previous y; out.y=0/in.y=1).
  - Complex values: Spline currently renders number attributes; when expanding to complex types, mirror the same normalization rules per attribute.

## QA Checklist

- Visibility
  - Handles appear only in Spline view and only when A or B is selected for the segment.
  - Handles vanish on deselect and after canceling a drag.
- Geometry parity
  - Handle positions exactly match `cp1/cp2` computed by `compute-transition-params.ts`.
  - Connecting lines reach the correct keypoint hexagon in world coordinates.
- Drag behavior
  - Moving CP1 modifies `A.transitions.out` only; moving CP2 modifies `B.transitions.in` only.
  - Previews match committed results.
  - x and y clamp to [0,1]; no glitches at degenerate spans.
  - Springs are bypassed during drag for affected visuals (curve and data-point).
- Multi-selection
  - If either A or B is selected, both handles are shown for the segment.
  - Works across multiple segments/rows when multiple selections are active.

---

## Open Questions

- Do we want to show handles on hover (read-only) even without selection? Staying conservative (selection-gated) for now.
- Should vertical handle y be adjusted in normalized domain even for non-spline (Transition) view? Not in this phase.
- For multi-attribute sources (e.g., vector components), which attribute drives the handle y? Today it follows the attribute rendered by the row (as `compute-transition-params.ts` does).

---

## References

- `docs/drag-interactions.md` — Drag pipeline, preview strategy, and state shape.
- `src/functions/compute-transition-params.ts` — Authoritative mapping from normalized transitions to world control points for all modes.
- `src/components/canvas-sheet/transition-segment.tsx` — Spline curve rendering and y-scaling logic.
- `src/components/canvas-sheet/data-point.tsx` — Marker visuals and drag affordances, including immediate feedback during drag.
