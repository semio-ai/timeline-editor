# Bezier Handles (Spline View)

## Design Decisions and Data Flow

- Centralize curve math in the derived snapshot
  - Compute canonical “raw” transitions (with defaults) and map them to world-space control points per segment during snapshot build.
  - Apply anti-knot clamping to produce “effective” control points (runtime-only) to guarantee monotonic X and prevent backtracks/knots.
  - Pre-bake render params for each view mode (Transition, Preview, Spline) so shared components simply look up geometry instead of recomputing formulas per render surface.
  - Rationale: a single authoritative computation per segment keeps visuals (curves, handles), interpolators, and violations consistent and avoids duplicating math in components.

- Enrich `InstancePair` (segment-level) as the single source of truth
  - Add a `geometry?: SegmentGeometry` payload that packages raw/effective transitions, control points, render params per view, and clamp flags under predictable keys.
  - Efficiency: compute once per segment in the derived pass (O(segments)); memory overhead is minimal (a handful of 2D points + metadata).

- Handle gating and defaults
  - Handles render only for segments whose parent row is in `TrackRender.Spline` **and** where at least one endpoint marker on that segment is selected (across all simultaneously selected rows).
  - Within those visible segments, handles appear even when a keypoint has no explicit transition data; the defaults from `compute-transition-params.ts` become the raw, interactive handles so selection always exposes something tangible.
  - Only the “inside” portion of a keypoint (toward the neighboring sample inside the editable range) shows a handle; the extrapolated flat span outside the row never renders a handle.
  - Multiple selected rows can display multiple handle sets at once, but the drag system still allows manipulating one handle at a time.
- Raw vs effective representations
  - Raw handles always reflect the canonical normalized transitions (defaults or explicitly stored values) converted to world space; they track whatever data is persisted, including overshoot.
  - Effective handles are derived during snapshot build via anti-knot clamping and feed interpolators, violations, and final curve rendering; when they differ from raw, we render the effective indicators as smaller markers along the connector so editors can see the runtime constraint.

- Default coupling (cross-segment coordination)
  - Interior keypoint K couples `K.in` and `K.out` by default (no modifiers): colinear (180° apart) and equal magnitude (locked angle and length).
  - Modifiers:
    - Alt: free (breaks coupling; dragged side moves independently).
    - Shift: locked angle only (colinear), lengths mirrored by default.
    - Shift+Alt: locked angle (colinear) with independent lengths.
  - Dragging one side updates the complementary side (spanning the two adjacent segments). Solve normalized transitions for both sides from world CPs and stage in preview.

- Preview diffs in drag state
  - Handle drags write normalized transition overrides into a diff map stored on `dragState`; entries are keyed by keypoint ID with `{ in?, out? }` patches so coupling can update both sides atomically.
  - The derived builder consumes these diffs (alongside stamp/value deltas) to produce up-to-date raw/effective geometry for both adjacent segments before rendering.

- UI-only constraints during handle drags
  - Only enforce that a handle cannot cross its own keypoint X:
    - A.out: `cp1.x ≥ A.stamp`
    - B.in: `cp2.x ≤ B.stamp`
  - Allow overshoot in x (beyond neighbor; outside 0–1) and in y (below 0 or above 1). Any resulting backtrack is handled by the effective clamp at snapshot time; the raw handle remains interactive.

- Component responsibilities (thin, view-focused)
  - The derived snapshot publishes fully-populated segment geometry (raw & effective transitions, CP world positions, render-friendly params) so view components stay stateless and cross-view consistent.
  - `TransitionSegment`: read precomputed effective geometry from `InstancePair`, apply view scaling (vertical axis) and draw. No curve math or normalization remains inside the component.
  - `BezierHandles` (new): consume `controlPointsRaw` (interactive) and `controlPointsEffective` (smaller, grayed indicator) from the snapshot, apply the same view scaling used by `TransitionSegment`, and render handles + connectors.
  - `DataPoint`: focus on marker visuals/selection. Prefer segment-centric handle rendering; if marker-owned handles are needed later, expose adjacency indices from the snapshot to avoid O(n) scans.

- Zustand and immutability
  - Canonical writes happen via store actions; the derived orchestrator materializes a fresh snapshot (including segment geometry and flags) on changes.
  - Components subscribe to the snapshot and avoid recomputing curve math, improving coherence and performance.

- Migration plan (high level)
  1. Introduce `SegmentGeometry`, update `InstancePair`/`ComputedRowData` references, and add optional adjacency mirrors on `InstancedFrameInfo`.
  2. Update the derived builder to:
     - Resolve canonical transitions with defaults, apply handle diffs, and populate `geometry.raw`.
     - Run `clampMonotonicCubicSegment` to fill `geometry.effective` + flags.
     - Pre-bake render params for Transition/Preview/Spline modes where helpful.
  3. Update `TransitionSegment`, upcoming `BezierHandles`, and interpolator consumers to read from `geometry` instead of recomputing control points.
  4. Extend drag state (`DragAnchorRef`, `DragState`, `handleDiffs`) plus coupling helpers and commit pipeline to support handle drags.
  5. Add tests for coupling, anti-knot clamping, default-to-explicit promotion, preview/commit equivalence, and snapshot serialization of the new geometry payload.


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
- Segment geometry container
  - Replace dozens of optional fields on `InstancePair` with a dedicated `SegmentGeometry` payload so consumers can destructure predictable shapes:
  ```ts
  export interface SegmentGeometry {
    raw: {
      transitions?: { startOut?: RawVector2; endIn?: RawVector2 };
      controlPoints?: { cp1?: WorldCP; cp2?: WorldCP };
      renderParams?: TransitionParams; // optional pre-baked view params
    };
    effective: {
      transitions?: { startOut?: RawVector2; endIn?: RawVector2 };
      controlPoints?: { cp1?: WorldCP; cp2?: WorldCP };
      renderParams?: TransitionParams;
    };
    flags?: ClampFlags;
  }

  export interface InstancePair {
    start: InstancedFrameInfo;
    end: InstancedFrameInfo;
    buffer?: boolean;
    geometry?: SegmentGeometry;
  }
  ```
  - `buildDerivedSnapshot` is responsible for hydrating `geometry.raw` (canonical defaults + overrides), running `clampMonotonicCubicSegment`, and storing the results under `geometry.effective`.
  - `TransitionSegment`, `BezierHandles`, interpolators, and QA overlays all read from the same `geometry` reference, eliminating redundant math and ensuring parity across views.

- Drag state and diff map
  - Extend `DragAnchorRef` with `kind: "marker" | "handle-in" | "handle-out"` and `neighborKeypointId` so the drag system understands which endpoint span to use.
  - Augment `DragState` with:
    ```ts
    interface DragState {
      // existing fields...
      activeHandleId?: string; // `${keypointId}:${kind}`
      handleDiffs?: Record<string, { in?: RawVector2; out?: RawVector2 }>;
    }
    ```
  - `handleDiffs` captures preview patches for handles and can be consumed by `applyDragDeltas` (or a sibling helper) before frames/segments are derived.
  - Coupling logic writes to multiple entries in the diff map atomically; `commitDrag` persists only the touched keypoints and clears the diff map afterwards.

- Instanced frame mirrors
  - Optionally expose read-only “adjacent handle” mirrors so marker-centric components can highlight handles without re-scanning segments:
  ```ts
  export interface InstancedFrameInfo {
    // existing fields...
    adjHandlesRaw?: { out?: WorldCP; in?: WorldCP };
    adjHandlesEffective?: { out?: WorldCP; in?: WorldCP };
  }
  ```
  - These mirrors are derived from the same `SegmentGeometry` data structure; they exist purely for UI affordances and never get written back to canonical data.

- ComputedRowData still carries `interpolations: InstancePair[]`, but each entry now contains a populated `geometry` blob. Downstream consumers do not need to compute curve math once `buildDerivedSnapshot` fills these fields.

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
- Multiple selections: if multiple rows/tracks meet the gating rules, render handles for all qualifying segments simultaneously; gesture handling still restricts drag operations to one handle at a time.

This behavior ensures you can shape a transition by selecting either endpoint.

---

## Visuals

- Raw indicator:
  - Raw CP position is represented by a filled circle (pixel-stabilized via `useInvariantScale`) rendered in the track/segment color.
  - The solid circle is the only marker the editor interacts with; its position is always the canonical/raw CP.
  - Default/fallback handles (i.e., when `transitions.{in|out}` is undefined) render with an “unfilled” interior by layering a smaller, partially transparent disk in the row’s background color in front of the solid circle. Offset the overlay toward camera by ~`ROW_DEPTH_EPSILON * 0.02` to avoid z-fighting.
- Connector + effective gap:
  - Draw a single connector from the keypoint hexagon to the effective CP (or raw when no clamp) with medium opacity so it blends into the spline.
  - When `effective ≠ raw`, render the segment between `effective` and `raw` with a lighter/transparent stroke to show the trimmed portion while keeping the raw circle highlighted.
  - No extra circle is needed for the effective point; all emphasis comes from the translucent connector gap.
- Colors & emphasis:
  - Use the base track color for connector + circle; dark mode background overlay uses theme background (near black) to hollow default handles.
  - On hover or when the parent row is emphasized, raise connector opacity and brighten the circle slightly.
- Layering:
  - Handles live above the spline line/fill and marker hexagons for the same row.
  - Use the existing layer band → Z mapping plus sub-epsilon offsets: connector (`z - ε·0.05`), raw circle (`z - ε·0.1`), fallback overlay (`z - ε·0.08`), so decorations never z-fight with the curve or each other.
- Dev-only visibility:
  - In development builds we may render handles even without selection to debug geometry; production builds adhere to the gating rules above.

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
    - Inputs: `segmentGeometry` (enriched `InstancePair` with raw/effective CPs), `sourceRow`, `trackRender`, `verticalBounds`, `verticalAxisRange`, `layer`, `color`, `isRowHovered`.
    - Geometry arrives precomputed from the derived snapshot; the component only maps world y to pixels with the same scale used by `TransitionSegment`.
    - Interactivity:
      - Each handle is an interactive hotspot; on drag start, initiate handle drag; on move, preview; on end, commit.
      - A connecting line is non-interactive visual glue.
- Integration:
  - Render `BezierHandles` alongside each `TransitionSegment` that qualifies (Spline mode and selection gating); both read from the same `InstancePair` payload to ensure parity.
  - Follow the same grouping and depth strategy as `TransitionSegment` to keep visual ordering consistent.

---

## Interaction Model

- Hover:
  - Cursor changes to “pointer” over the handle.
  - Emphasize the handle and (optionally) the connecting line.
- Drag:
  - Only one handle drag is active at a time; starting a new handle drag cancels or commits the previous gesture first.
  - Begin: capture which handle (A.out or B.in) is being dragged and snapshot the segment endpoints needed to compute normalized coordinates.
  - Move:
    - Compute normalized `x` from pointer stamp relative to [A.stamp, B.stamp]:
      - `x = (localStamp - A.stamp) / (B.stamp - A.stamp)` (allow <0 or >1 for overshoot).
    - Compute normalized `y` from pointer value relative to [A.value, B.value]:
      - If `deltaY !== 0`, `y = (worldValue - A.value) / deltaY` (allow <0 or >1).
      - If `deltaY === 0`, keep existing `y` (no-op) or follow the degenerate span policy (defaults).
    - Before staging the preview value, apply `clampHandleAgainstOwnKeypointX` so the world CP cannot cross its anchor keypoint’s X; otherwise leave the normalized numbers unconstrained.
    - Update the corresponding transition in preview (A.out for CP1, B.in for CP2) via the handle-delta diff map.
  - End:
    - Commit the new normalized `{ x, y }` into the keypoint’s `transitions` object, creating it if needed.
    - Reset: provide a hotkey (TBD) to reset the selected segment’s handles to defaults `{ out: {x: 0.65, y: 0}, in: {x: 0.35, y: 1} }`.
- Modifiers and constraints:
  - Only the “no cross anchor X” constraint applies; `x`/`y` are otherwise free-form and may overshoot neighbors.
  - Alt: independent rotation and scale of the dragged handle relative to its complement (the opposite handle on the same keypoint).
  - Shift: constrain the dragged handle to remain colinear with its complement (same angle/tangent). Lengths mirror by default in this mode.
  - Shift+Alt: keep the handles colinear (same angle) while allowing independent scaling (handle lengths may differ).
  - Handle drags do not use horizontal frame snapping; Alt no longer means “bypass snap” for handles. Marker drags retain their existing Alt/Shift semantics per `drag-interactions.md`.

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
- Preview diffs (generalized approach):
  - Extend `dragState` with a diff map that can express handle overrides alongside the existing stamp/value deltas. Proposed shape:
    - `handleDiffs?: Record<keypointId, { in?: RawVector2; out?: RawVector2 }>`
    - Coupling logic writes to both the dragged handle and its complement before the diff is consumed.
  - `applyDragDeltas` (or a sibling helper) merges `handleDiffs` into the virtual frames before `computeRowData` emits `InstancedFrameInfo`, so any downstream consumer automatically sees the preview geometry.
  - This diff structure keeps the door open for future preview surfaces (e.g., curve warping) by treating drag previews as typed patches rather than bespoke booleans.
- Derived snapshot consumption:
  - `buildDerivedSnapshot` applies the diffs first, then runs the canonical-to-world conversion and anti-knot clamp so both raw and effective CPs are coherent during drag.
  - Because the diff map lives in the store, any selection change or cancellation immediately clears it and forces the derived snapshot back to canonical data.
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
    - `x = (localPointerStamp - stampA) / (stampB - stampA)` (allow overshoot; enforce only the “no cross anchor X” constraint in world space).
    - `y = deltaY !== 0 ? (worldPointerValue - valueA) / (valueB - valueA) : keep existing y`
- For CP2 (B.in):
  - Same formulas, but normalization still uses A’s origin; see `compute-transition-params.ts` (both cp1 and cp2 times share A.stamp/A.value as the origin even when `x`/`y` fall outside [0,1]).
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
    - For B.in (mirrored semantics with cp time computed off **B**):
      - cpWorld.x = B.stamp - spanX * (1 - (B.transitions?.in?.x ?? 0.35))
      - cpWorld.y = B.value - deltaY * (1 - (B.transitions?.in?.y ?? 1))
      - Bug note: the current implementation measures both control points from `A`, which flips `cp1.x`/`cp2.x` and forces needless anti-knot clamping. Phase tasks below track fixing the conversion + tests.
  - After the marker’s new position/value A′ (or B′) is determined by the drag delta, re-solve normalized transitions from the stored cpWorld to keep the visual relationship intact:
    - For A.out after A moves (B constant):
      - x′ = (cpWorld.x - A′.stamp) / (B.stamp - A′.stamp)
      - y′ = deltaY′ !== 0 ? (cpWorld.y - A′.value) / (B.value - A′.value) : keep previous y (or 0 by policy)
    - For B.in after B moves (A constant):
      - x′ = 1 - (B′.stamp - cpWorld.x) / (B′.stamp - A.stamp)
      - y′ = 1 - (B′.value - cpWorld.y) / (B′.value - A.value)
  - Only apply this re-solve to handles that exist (i.e., when a keypoint hasn’t specified a transition, do not fabricate or update one).
  - Apply this in both preview (during drag) and commit paths so the visual invariance matches the final state.
  - Note: When the dragged keypoint sits between two segments, apply the rule to both adjacent handles (its out for left segment; its in for right segment) independently.
  - Intentional default behavior: handles that still rely on the implicit ease-in-out defaults will move when the marker moves; invariance only applies after the user creates explicit transitions (typically on first handle edit).

-2) Anti-knot “effective length” when markers approach each other
- When A and B move close enough that the raw handles would produce a backtrack (non-monotonic X) or a knot, shorten only the effective handle lengths used by rendering/interpolation until the curve is valid. Do not write these shortened handles back to canonical transitions.
- Policy:
  - Maintain the sufficient monotonic condition in X: P0.x ≤ P1.x ≤ P2.x ≤ P3.x. If violated, scale CPs toward their anchors along the line from keypoint to control so they satisfy the ordering with small epsilon margins.
  - **Do not** clamp handles to the entire span `[A.x, B.x]`. The only pre-check before anti-knot split is the single-handle rule: `A.out` cannot cross `A.x` (parametric ≤ 0) and `B.in` cannot cross `B.x` (parametric ≥ 1). Overshoot toward the neighbor is allowed until it would invert `P1.x ≤ P2.x`.
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
- Drag anchor kinds (as previously proposed) gain `neighborKeypointId` and live on the expanded `DragAnchorRef` structure described earlier.
- Snapshot extensions collapse into the `SegmentGeometry` container:
  - `geometry.raw` holds canonical transitions/control points/render params.
  - `geometry.effective` stores clamped equivalents plus render params for the active view.
  - `geometry.flags` mirrors `ClampFlags` for visualization/debugging.
  - Optional adjacency mirrors on `InstancedFrameInfo` reference these world-space CPs for marker-centric components.
- Implementation notes:
  - `clampMonotonicCubicSegment` remains the authoritative helper for anti-knot adjustments; call it during snapshot build after applying handle diffs.
  - `init-derived-orchestrator.ts` and any interpolator builders must read effective geometry from the snapshot instead of recomputing control points locally.
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
  - x and y may overshoot neighbors but handles never cross their own anchor stamp; degenerate spans follow the defined fallback policy.
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

---

## Phased Implementation Plan

### Phase 1 — Type & Snapshot Plumbing [ Complete ]
- Introduce `SegmentGeometry`, extend `InstancePair`, `ComputedRowData`, and (optionally) `InstancedFrameInfo` per the Type proposals. Verify TypeScript compiles and downstream imports update cleanly.
- Update `buildDerivedSnapshot` to populate `geometry.raw` by combining canonical transitions + defaults + handle diffs, then call `clampMonotonicCubicSegment` to fill `geometry.effective` and flags.
- Pre-bake render params needed by Transition/Preview/Spline (reuse helpers from `compute-transition-params.ts`) and store them under the geometry payload.
- Checks:
  - Unit tests or snapshots confirm derived data now includes both raw and effective CPs.
  - Existing consumers continue to function (temporary adapters can bridge until Phase 2 completes).

### Phase 2 — Component Consumption & Visuals [ Complete ]
- Update `TransitionSegment` to read world control points and render params directly from `segment.geometry`, removing duplicated math.
- Implement `BezierHandles` using the enriched geometry (raw vs effective indicators), hook into selection gating, and ensure the visual scale matches `TransitionSegment`.
- Add effective-handle markers and connectors plus hover/selection styling as described in the Visuals section.
- Checks:
  - Visual comparison shows curve + handle positions stay in sync across views.
  - Handles appear only for Spline rows with at least one selected endpoint; defaults display when transitions are undefined.

### Phase 3 — Drag System & Preview Diffs [ In Progress ]
- Extend `DragAnchorRef` (`kind`, `neighborKeypointId`) and `DragState` (`handleDiffs`, `activeHandleId`) plus helper actions for starting/updating/canceling handle drags.
- Update `applyDragDeltas` (or a sibling helper) so `handleDiffs` get merged before virtual frames are built; ensure coupling writes to both adjacent handles.
- Fix the world/param conversion bug for `end.in` handles (ensure `compute-transition-params`/`clampMonotonicCubicSegment` measure the inbound CP off B, not A) and add regression tests so default cubic-bezier data no longer triggers false anti-knot clamps.
- Rework `clampMonotonicCubicSegment` to enforce only the anchor-cross constraint (`A.out.x ≥ A.x`, `B.in.x ≤ B.x`) before detecting `cp1.x > cp2.x`; remove the broader `[A.x, B.x]` clamp so intentional overshoot survives.
- Implement UI constraints via `clampHandleAgainstOwnKeypointX`, add reset hotkey, and enforce “single handle drag at a time.”
- Tests/validations:
  - Unit tests for `solveNormalizedTransitionFromWorldCP`, coupling, handle diffs, and commit path.
  - Manual QA covering overshoot, multi-selection, preview parity, and cancellation edge cases.

### Phase 4 — QA, Telemetry, and Docs [ Incomplete ]
- Expand automated coverage for anti-knot clamping, preview vs commit equivalence, and default-to-explicit promotion.
- Run manual QA checklist (visibility gating, geometry parity, drag behavior, multi-selection) on representative animations.
- Update README/agent docs with any new shortcuts (reset hotkey) or flows discovered during implementation, and ensure telemetry/logging captures handle drag actions if required.
