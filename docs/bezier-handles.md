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
  - Geometry here is the derived `SegmentGeometry` blob produced in `compute-row-data.ts#attachSegmentGeometry`, not any Three.js mesh data; it is the container that downstream renderers read.

- Handle gating and defaults
  - Handles render only for segments whose parent row is in `TrackRender.Spline` **and** where at least one endpoint marker on that segment is selected (across all simultaneously selected rows).
  - Within those visible segments, handles appear even when a keypoint has no explicit transition data; the defaults from `compute-transition-params.ts` become the raw, interactive handles so selection always exposes something tangible.
  - Only the “inside” portion of a keypoint (toward the neighboring sample inside the editable range) shows a handle; the extrapolated flat span outside the row never renders a handle.
  - Multiple selected rows can display multiple handle sets at once, but the drag system still allows manipulating one handle at a time.
- Raw vs effective representations
  - Raw handles always reflect the canonical transition deltas (defaults or explicitly stored `TransitionInfo` values) converted to world space; they track whatever anchor-relative data is persisted, including overshoot.
  - Effective handles are derived during snapshot build via anti-knot clamping and feed interpolators, violations, and final curve rendering; when they differ from raw, we render the effective indicators as smaller markers along the connector so editors can see the runtime constraint.

- Default coupling (cross-segment coordination)
  - When `TransitionInfo.pairing` resolves to `Paired` (either explicitly or inferred via angle check) the interior keypoint K keeps `K.in` and `K.out` colinear (180° apart). The dragged handle’s length changes freely while the paired handle preserves its own length but reorients to stay on the shared line.
  - If the pairing state is `Free`, the handles move independently—no angle constraint is applied until the user snaps them back into the paired tolerance.
  - Modifiers:
    - Alt: free (breaks coupling; dragged side moves independently).
    - Shift: locked angle only (colinear), lengths mirrored by default.
    - Shift+Alt: locked angle (colinear) with independent lengths.
  - Dragging one side updates the complementary side (spanning the two adjacent segments). Resolve anchor-relative deltas for both sides from world CPs and stage in preview.

- Preview diffs in drag state
  - Handle drags write anchor-relative deltas (the same shape stored in `TransitionInfo`) into a diff map stored on `dragState`; entries are keyed by keypoint ID with `{ in?, out?, pairing? }` patches so coupling can update both sides atomically.
  - The derived builder consumes these diffs (alongside stamp/value deltas) to produce up-to-date raw/effective geometry for both adjacent segments before rendering. `compute-row-data.ts` calls `attachSegmentGeometry`, which overlays `dragState.handleDiffs` onto the canonical transitions before deriving control points and render params.

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
  startOut?: RawVector2; // Δ relative to A (A.transitions.out)
  endIn?: RawVector2;    // Δ relative to B (B.transitions.in)
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
  rawTransitions: EndpointTransitions;      // canonical anchor-relative deltas
  epsilon?: number;                         // small safety margin for monotonic X (default ~1e-6)
}

// Output contains raw and effective CPs in world space plus effective transition deltas
export interface ClampOutput {
  // World-space CPs computed from raw (canonical) transitions
  cp1Raw?: WorldCP; // from startOut
  cp2Raw?: WorldCP; // from endIn

  // World-space CPs after anti-knot clamping for rendering/interpolators
  cp1Effective?: WorldCP;
  cp2Effective?: WorldCP;

  // Effective transition deltas that would reproduce the effective CPs
  transitionsEffective: EndpointTransitions;

  // Summary flags
  flags: ClampFlags;
}

/**
 * Compute effective (anti-knot) control points for a monotonic X cubic segment.
 * - Raw CPs are derived from canonical anchor-relative deltas.
 * - Effective CPs are scaled toward their anchors to satisfy P0.x ≤ P1.x ≤ P2.x ≤ P3.x.
 * - Returns both raw/effective CPs and effective transition deltas.
 */
export function clampMonotonicCubicSegment(input: ClampInput): ClampOutput;

/**
 * Solve a transition delta from a world-space CP so a handle appears visually
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
  previous?: RawVector2;                   // previous fallback delta for degenerate spans
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

This document proposes the rendering and interaction model for Bezier “handles” in the Spline view. Handles appear on a transition segment when at least one of the two endpoint markers (data-points) on that curve is selected. Users can drag handles to modify the segment’s shape by updating the anchor-relative transition deltas around each endpoint keypoint.

The plan aligns with the drag and preview flow described in `docs/drag-interactions.md`, reuses the transition semantics in `types/data/keypoint.ts`, and matches the geometry produced by `functions/compute-transition-params.ts`.

---

## Objectives

- Show control handles for a transition segment when at least one endpoint marker on that segment is selected.
- Render handle positions in “real” coordinate space so they visually align with the Spline curve (not normalized [0,1]).
- Support dragging a handle to update the corresponding keypoint’s transition deltas:
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
- Transition deltas around keypoints:
  - `TransitionInfo.out` stores `{ x, y }` offsets relative to the start keypoint. World control points are computed as `cp1.x = A.stamp + x`, `cp1.y = A.value + y`.
  - `TransitionInfo.in` stores `{ x, y }` offsets relative to the end keypoint. World control points are computed as `cp2.x = B.stamp + x`, `cp2.y = B.value + y`.
  - These offsets live entirely in animation/value space (no instance scaling applied). “World” conversions (pixel mapping, instance transforms) happen downstream.
- Defaults fall back to `StandardTransitionType.Cubic` when transitions are undefined. Conceptually this matches the normalized cubic-bezier parameters `{out: (0.65, 0), in: (0.35, 1)}`, but the actual stored deltas are derived per segment span/value when the enum is resolved.
- We treat those enum defaults as “paired” on first touch—drag start converts them to explicit vectors and seeds `TransitionInfo.pairing = Paired` unless Alt immediately breaks the link.
- Canonical transitions use `TransitionInfo` from `types/data/keypoint.ts`:
  - `TransitionInfo` packs `{ in?: RawVector2 | StandardTransitionType; out?: RawVector2 | StandardTransitionType; pairing?: TransitionPairing }`.
  - `pairing` encodes whether the opposing handles on a keypoint should stay “flat”/colinear (`TransitionPairing.Paired`) or be treated independently (`TransitionPairing.Free`).
  - Explicit `RawVector2` entries always represent anchor-relative deltas as described above; enum entries are lazily converted to those deltas via `resolveTransitionDelta`/`getWorldControlPoints`.
  - Once a drag mutates either handle or toggles the pairing flag we store both sides as explicit vectors so future edits share a single representation, and also update the pairing setting as needed.
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
- View transitions:
  - When switching a row into Spline mode, wait briefly (≈200 ms, matching the curve animation) before revealing handles. They animate from the data marker toward their control point while fading in, so the curve settles before targets appear.
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
  - Begin: capture which handle (A.out or B.in) is being dragged and snapshot the segment endpoints needed to compute anchor-relative deltas (their stamps, values, and any enum presets that must be converted up front).
  - Move:
    - Convert the pointer to animation-space stamp/value using the same transforms as `TransitionSegment` (`instanceTransform` for x, inverse vertical scale for y).
    - Assemble a candidate control point in animation/value space: `{ x: pointerStamp, y: pointerValue }`.
    - Clamp with `clampHandleAgainstOwnKeypointX` so the world CP cannot cross its anchor keypoint’s X; otherwise leave the numbers unconstrained (overshoot is allowed).
    - Derive anchor-relative deltas by subtracting the keypoint anchor (`deltaX = cpWorld.x - anchorStamp`, `deltaY = cpWorld.y - anchorValue`). These deltas become the new `TransitionInfo.{in|out}` vectors.
    - Update the relevant `TransitionInfo` in preview via the handle-delta diff map:
      - When the keypoint’s current or inferred pairing is `Paired`, write both sides in a single step so the handles stay colinear (flat) through the anchor, keeping the in–point–out trio on a straight line. Lengths remain independent by default.
      - When the pairing is `Free` (or temporarily forced free via Alt), isolate the dragged handle only.
      - If either side relied on a `StandardTransitionType`, convert it to an explicit `RawVector2` before writing so both handles share the same representation as soon as coupling occurs.
  - End:
    - Commit the new anchor-relative `{ x, y }` offsets into the keypoint’s `TransitionInfo`, creating it if needed and preserving any pairing flag staged during the drag.
    - Reset: provide a hotkey (TBD) to reset the selected segment’s handles to defaults `{ out: {x: 0.65, y: 0}, in: {x: 0.35, y: 1} }`.
- Modifiers and constraints:
  - Only the “no cross anchor X” constraint applies; `x`/`y` are otherwise free-form and may overshoot neighbors.
  - Alt: when the current or inferred pairing is flat, Alt temporarily decouples the handles (treat as `TransitionPairing.Free`) so the dragged side can move independently; committing while Alt is held writes the updated vectors plus `pairing: Free`. Alt also suppresses the snap-to-flat logic described below so users can explore “almost flat” poses without immediately reparing.
  - Shift: constrain the dragged handle to remain colinear with its complement (same angle/tangent). Lengths mirror by default in this mode.
  - Shift+Alt: keep the handles colinear (same angle) while allowing independent scaling (handle lengths may differ).
  - Handle drags do not use horizontal frame snapping; Alt no longer means “bypass snap” for handles. Marker drags retain their existing Alt/Shift semantics per `drag-interactions.md`.

### Pairing behavior

- Pair intent lives on each keypoint’s `TransitionInfo.pairing`. We resolve it at drag start using three sources, in priority order:
  1. An explicit `pairing` value already stored on the keypoint.
  2. If missing, a runtime angle comparison of the existing handles (raw vectors or enum presets converted to vectors). If both handles exist and are colinear within a narrow tolerance (≈2–3°), we treat them as `Paired`.
  3. If only one handle exists, we leave the pairing unresolved and fall back to the persisted value (if any). As soon as both handles are defined (including defaults converted from enums) we rerun the angle test and persist the outcome.
- The angle comparison treats enums and explicit vectors uniformly: mixing `StandardTransitionType` presets (e.g., sine vs cubic) or combining an enum with a `RawVector2` can still count as paired if the resolved world handles lie on the same line through the keypoint.
- Explicit pairing values remain authoritative even if the handles diverge during pointer previews; we only re-run the angle-based inference when the stored flag is `undefined`.
- The first time we infer pairing from angles we immediately persist it by staging a `TransitionInfo.pairing` diff. This keeps future drags deterministic and lets QA reason about the stored state.
- Whenever a keypoint is updated for any reason (handle drag, marker move that touches transitions, scripted edit) we take the opportunity to migrate its `TransitionInfo` to explicit `{in,out, pairing}` entries so downstream logic never has to guess. Defaults always come from the resolved state at the moment of the change (e.g., current enum + inferred pairing).
- When a handle is dragged while `pairing === Paired` (explicit or inferred):
  - Both handles stay on the same line through the anchor so the control polygon is visually flat. We do not force equal lengths—the dragged side grows/shrinks independently, but the complement mirrors direction.
  - If either side still referenced a `StandardTransitionType`, we bake both to explicit `RawVector2` entries (world deltas) before applying the coupled delta so future edits never have to juggle enum lookups.
- When `pairing === Free`, only the dragged handle updates. However, dragging it into the small “flat tolerance” cone (same threshold used for detection) automatically snaps the keypoint back to `Paired` as long as Alt is not held. Holding Alt during the move bypasses this snap even if the handle is perfectly aligned. That snap writes both explicit vectors plus `pairing: Paired` on commit.
- Holding Alt while paired temporarily suppresses coupling and the snap detector. If the user releases Alt before committing, the preview reverts to the stored paired pose; if they commit while Alt is still active, the keypoint records `pairing: Free` alongside the explicit handle vectors.
- Snapping is asymmetric by design: paired handles stay paired until Alt deliberately breaks them, while free handles only transition back to paired when the drag lands inside the tolerance without Alt.

---

## Store and Preview Integration

We reuse the drag/preview architecture in `docs/drag-interactions.md`, but specialize for handles.

- Anchor reference:
  - Extend the drag anchor union to support handles:
    - `anchor.kind: "marker" | "handle-in" | "handle-out"`
    - `anchor.keypointId`, `anchor.trackId`, `anchor.rowId`, plus for handles, the remote endpoint keypoint id to pull neighbor context (A for out uses next B, B for in uses previous A) when resolving enums or anti-knot constraints.
- Transform inputs:
  - `instanceTransform` is still required to convert between global stamp and local instance time.
  - Vertical mapping uses the same view axis transform (`verticalBounds` or `verticalAxisRange`) as Spline.
- Preview diffs (generalized approach):
  - Extend `dragState` with a diff map that can express handle overrides alongside the existing stamp/value deltas. Shape:
    - `handleDiffs?: Record<keypointId, TransitionInfo>`
    - Coupling logic writes to both the dragged handle and its complement (plus `pairing`) before the diff is consumed.
  - `applyDragDeltas` (or a sibling helper) merges `handleDiffs` into the virtual frames before `computeRowData` emits `InstancedFrameInfo`, so any downstream consumer automatically sees the preview geometry.
  - This diff structure keeps the door open for future preview surfaces (e.g., curve warping) by treating drag previews as typed patches rather than bespoke booleans.
- Pairing resolution pipeline:
  - Drag start snapshots normalize the working `TransitionInfo` by converting any `StandardTransitionType` presets on the affected keypoint to explicit `RawVector2` values (one conversion per handle). This ensures the preview diff always manipulates vectors.
  - After normalization we evaluate the pairing state using the rules in [Pairing behavior](#pairing-behavior) and immediately stash the resolved value inside the diff entry so preview/commit share the same semantics.
  - The snap-to-flat detector (free → paired) and Alt override (paired → free) both operate by mutating the same diff entry’s `pairing` field, so derived snapshots and commits see identical intent.
- Derived snapshot consumption:
  - `buildDerivedSnapshot` applies the diffs first, then runs the canonical-to-world conversion and anti-knot clamp so both raw and effective CPs are coherent during drag.
  - Because the diff map lives in the store, any selection change or cancellation immediately clears it and forces the derived snapshot back to canonical data.
- Commit:
  - On `commitDrag`, call `updateKeypoint` (or a new helper) to write the patched `TransitionInfo` (vectors plus `pairing`) back to the canonical keypoint.
  - Ensure the keypoint has a `transitions` object after commit; when `pairing` was inferred or snapped we persist it immediately so follow-up drags see the explicit flag.
  - Clear the handle-preview map in drag state.

---

## Data Required at Drag Time

- For CP1 (A.out):
  - Anchor: `stampA`, `valueA`
  - Neighbor (for preview visuals, anti-knot, and modifier context): `stampB`, `valueB`
  - Pointer conversions:
    - `pointerStamp = instanceTransform.globalToLocal(pointerX)` (allow overshoot; only clamp against the anchor stamp).
    - `pointerValue = inverseLinearScale(pointerY, [pixelMin, pixelMax], [domainMin, domainMax])`
  - Anchor-relative delta: `{ x: pointerStampClamped - stampA, y: pointerValue - valueA }`
- For CP2 (B.in):
  - Anchor: `stampB`, `valueB`
  - Neighbor: `stampA`, `valueA`
  - Pointer conversions identical to CP1; clamp so `pointerStamp ≤ stampB` before subtracting `stampB`. Delta is `{ x: pointerStampClamped - stampB, y: pointerValue - valueB }`.
- These deltas are the values written to `TransitionInfo.{out|in}`. The renderer already has the Spline axis range and domain; reuse them so handle previews share the same scaling as curves.

---

## Edge Cases

- Zero span in time (`A.stamp === B.stamp`): do not allow x changes; keep x at current value.
- Zero delta in value (`A.value === B.value`): y changes have no visual effect; keep y stable or clamp to {0,1}.
- Missing transitions:
  - On first drag, create a `TransitionInfo` that contains explicit `{in|out}` vectors derived from the fallback `StandardTransitionType.Cubic` (or any existing enums) and immediately resolve `pairing`. Cubic defaults therefore start life as `Paired` even before the user moves a handle.
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

At update time, compute anchor-relative deltas (subtract the relevant keypoint stamp/value) with A and B pulled from the derived snapshot (to reflect live preview and selection).

---

## Anti-knot constraints and effective handles

Context and goals
- We must prevent knots/backtracks in transition curves. In practice, that means the cubic’s X dimension must remain monotonic across each segment A → B. A practical sufficient condition is to enforce P0.x ≤ P1.x ≤ P2.x ≤ P3.x where P0 = A, P3 = B, and P1/P2 are the control points.
- The Spline view shows handles in world space, while transitions persist anchor-relative deltas (animation/value space offsets). Some operations therefore require translating between the two spaces and optionally applying an “effective” clamp that preserves validity without mutating the canonical transitions.

1) Marker drag should preserve the apparent handle relative to the marker
- When dragging a keypoint (marker), the handle(s) “attached” to that marker should appear visually stationary relative to the marker, even though transitions are stored as deltas relative to anchors. To achieve this:
  - Before drag update, compute the world-space CP(s) for that marker using the current transition deltas (or easing enums resolved via `resolveTransitionDelta`) and A/B values/stamps.
  - After the marker’s new position/value A′ (or B′) is determined by the drag delta, re-solve anchor-relative deltas from the stored cpWorld to keep the visual relationship intact:
    - For A.out after A moves (B constant):
      - `deltaX′ = cpWorld.x - A′.stamp`
      - `deltaY′ = cpWorld.y - A′.value`
    - For B.in after B moves (A constant):
      - `deltaX′ = cpWorld.x - B′.stamp`
      - `deltaY′ = cpWorld.y - B′.value`
  - Only apply this re-solve to handles that exist (i.e., when a keypoint hasn’t specified a transition, do not fabricate or update one).
  - Apply this in both preview (during drag) and commit paths so the visual invariance matches the final state.
- Note: When the dragged keypoint sits between two segments, apply the rule to both adjacent handles (its out for left segment; its in for right segment) independently.
- Intentional default behavior: handles that still rely on the implicit ease-in-out defaults will move when the marker moves; invariance only applies after the user creates explicit transitions (typically on first handle edit).

### Handle preservation pipeline (crossing-aware)

- Drag start now captures each affected handle in world space and stores it per keypoint *and* attribute path (`keypointId::attribute`). The stored payload carries the absolute control point delta (`cpWorld - anchor`) so every subsequent resolver works in world coordinates rather than relying on normalized spans.
- During preview we always pass the canonical, pre-drag track snapshot (`originalTrackPoints`) to `applyDragDeltas`. That snapshot gives the resolver a stable reference for each keypoint’s “before drag” stamp/value, which prevents cumulative re-normalization when the same function executes multiple times in a single frame.
- `applyMarkerHandleOffsets` no longer trusts the neighbor id captured at drag start. Instead it asks “who is currently the closest keypoint to the left/right of the dragged marker” after applying the latest preview deltas. If the original neighbor is now on the wrong side (because the marker crossed it), the resolver automatically swaps to the newly adjacent keypoint and keeps the handle world position intact.
- Commit replays the exact same logic: before mutating the track we deep-clone its pre-drag keypoints, then we call `applyDragDeltas` with both the live draft and the immutable clone. After the drag commits we sort the track if any horizontal delta occurred, so future drags see the updated ordering without reusing stale offsets.
- This pipeline ensures that:
  - Handles attached to the dragged marker stay visually locked even after the marker crosses other keypoints in the same row.
  - Neighboring handles do not “steal” deltas from one another when the segment ordering changes; each handle always re-solves against the closest neighbor in its current direction.
  - A second drag (after release) recomputes its offsets from the committed transitions, so invariance holds across multi-step edits.

The accompanying regression tests simulate dragging a keypoint past its neighbor and assert that both the middle-in and middle-out handles remain stationary relative to the marker throughout preview and commit.

#### Structural risks still on the radar

- **Segment-level bookkeeping** — handle invariants depend on *pairs* of keypoints, yet we still store offsets on a single keypoint. When segment membership changes (crossing, insertion, deletion) we need to recompute both sides in lockstep. Tracking handles under a `{segmentId, direction}` key would make this explicit and simplify reparenting logic.
- **Single-source snapshots** — different pieces of the pipeline (gesture preview, derived snapshot, commit) can observe different Immer drafts today. Persisting a frozen “pre-drag snapshot” per track/attribute and threading it through every resolver guarantees we always normalize against the same data.
- **Derived-store caching** — we recompute world-space control points from stored deltas every render, which is both slow and prone to subtle math differences. Derived rows should cache `{rawCP, effectiveCP}` so UI/tests can assert invariants without re-running the math.
- **Broader coverage** — existing regression tests focus on single-point drags and one crossing scenario. We still need multi-selection + vector-component coverage, plus negative-direction crossings (dragging backwards). Those cases should assert world-space deltas from the cached CP data mentioned above.

### Proposed pipeline overhaul: anchor-relative world handles

> **Historical note:** The remainder of this section preserves the earlier migration plan when transitions were still normalized-relative to segment spans. The canonical implementation now stores anchor-relative deltas per `TransitionInfo`; keep the table below for context when auditing older code paths.

| Layer | Current state | Proposed change | Notes |
| --- | --- | --- | --- |
| Storage (`Keypoint.transitions`) | Normalized `{x,y}` stored per keypoint; span-dependent | Keep normalized values for interchange, but add `transitionsWorld = { in/out: { ΔstampNorm, Δvalue } }` relative to the marker. Later, switch `Δstamp` to milliseconds without changing the pipeline. | Eliminates re-normalization when spans change; transitions stay “fixed” in marker space. |
| Drag snapshot | Each caller passes whatever draft array they have | Capture a frozen snapshot per track/attribute at `startDrag` (sorted keypoints + `transitionsWorld` + resolved world CPs) and persist it on `dragState`. | Ensures preview/commit share the same baseline; snapshot is easily serializable for a future wasm module. |
| Preview math (`applyDragDeltas`) | Re-derives neighbors from mutable arrays, converts world→parametric repeatedly | Use the frozen snapshot for neighbor lookup; world handles remain constant and we convert to normalized `{x,y}` only when we need to update canonical storage. | World deltas remain invariant even after crossings. |
| Derived snapshot | Recomputes world CPs on the fly | Cache `{rawWorldCP, effectiveWorldCP}` per segment inside derived rows. | Rendering, QA tooling, and wasm consumers read one authoritative geometry cache. |
| Commit | Replays preview logic against the current track array | Same as preview: convert `transitionsWorld` → normalized once per segment, update keypoints, then sort if stamps changed. | Guarantees preview == commit, independent of track mutation order. |

#### Implementation phases

1. **Add `transitionsWorld`.** Extend the `Keypoint` type + migrations to include anchor-relative deltas. When missing, derive them from the current normalized `{x,y}`. Drag start snapshots should capture these world deltas rather than normalized ones.
2. **Frozen drag snapshot & neighbor lookup.** Define a `DragSnapshot` (per track/attribute) and thread it through preview + commit. Refactor `applyMarkerHandleOffsets` to rely exclusively on this snapshot, swapping to the nearest neighbor when the original ID crosses the marker.
3. **Derived geometry cache.** Update `computeRowData` to cache raw/effective world CPs per segment. Renderer/tests should assert against this cache, which can also serve as the hand-off format for a wasm module.
4. **Future-facing adjustments.** When the animation timeline switches from normalized stamps to milliseconds, only the `Δstamp` unit changes. Handle dragging (when implemented) will simply mutate `transitionsWorld` directly, keeping the same data flow.

> **Implementation note:** Migrating to `transitionsWorld` means every fixture that seeds track data—including `packages/animation/src/test-fixtures/animation-store-factory.ts`—must be updated to populate the new world-space deltas (and, when absent, derive normalized `{x,y}` from them). Treat that file as part of the migration checklist so tests exercise the same structures used in production.

### Detour: phasing out complex track values

Our `RawValue`/`AnimatableValue` model still allows tracks whose `value` is an object (`{x,y,z}`, `{r,p,y}`, etc.) plus an optional `attribute` flag that selects a single component for spline editing. The long-term plan (documented elsewhere) is to replace this with explicit track groups composed of simple numeric tracks. Until we finish that migration, the anchor-relative handle work cannot reliably store world deltas, because a single keypoint may represent multiple attributes with different scales. For example, `position.x` and `position.y` share the same `Keypoint` object today; anchoring a world delta to that object would immediately become incorrect when editing a different attribute.

#### Interim plan

1. **Audit `RawValue` usage** — Inventory every track produced by `animation-store-factory.ts` and the runtime store to determine where composite values remain. Cross-reference the `attribute` flag (used in `SourceRowData`) to understand which UI rows still rely on the legacy representation.
2. **Introduce simple-track groups** — For each composite animatable (vector3, euler, color, etc.), define explicit tracks for each component (e.g., `position.x`, `position.y`, `position.z`) and ensure the editor reads/writes those tracks directly. This matches the `TrackGroup` design already described in the docs.
3. **Loader + factory updates** — Update the store bootstrapping code and `animation-store-factory.ts` to emit only simple numeric values per track. For backward compatibility, add a loader that expands legacy tracks (with attribute flags) into grouped numeric tracks during import.
4. **Deprecate `attribute` usage** — Once the groups exist, stop threading `attributePath` through drag/preview logic. Each keypoint now represents a single numeric value, so world deltas can be stored without ambiguity.
5. **Deterministic IDs for flattened tracks** — When splitting composite tracks into per-component versions, derive their ids predictably (e.g., `position.x` becomes `${trackId}.x` and keypoint ids follow `${pointId}.x`). This minimizes downstream churn and keeps selection/clipboard logic intact.

> **Current audit (March 2025):** Composite values remain in the store factory (`animation-store-factory.ts`), `SourceRowData.attribute`, `DragState.attributePath`, `compute-row-data` bounds, `compute-frames`, `animatable-editor`, and handle helpers. The next coding step is to flatten those tracks (with deterministic ids) before we land the anchor-relative handle work.

> **Progress (Mar 2025 update):** Track data is now scalar-only (`flattenCompositeTracks` + `normalizeTrackData`), but the TrackList still falls back to `useNames(trackIds)` for group labels. Because scalar children within a group share the same `name`, the UI usually returns the animatable label, yet it still renders “Multiple” the moment the grouped ids diverge. We want to store a single display name per grouped row (derived from the animatable) at import time and keep it immutable afterward—computation during every expand/collapse is what caused the earlier slowdown.

**Next validations once label plumbing lands:**  
1. Load the Animation Sheet (or Storybook) and confirm vector animatables render group rows named after the animatable (e.g., “Position”), plus exactly three component rows.  
2. Toggle groups repeatedly to verify collapse/expand remains responsive (labels set once; `update-instanced-track-sources` no longer rebuilds heavy structures).  
3. Import the legacy fixtures (`createTestAnimationStore`) and ensure they hydrate with the same labels, confirming the canonical animation/animatable data carry the display names.

Only after this detour (simple tracks everywhere) does it make sense to finish the anchor-relative handle implementation. Without it, we risk encoding world deltas against an arbitrary attribute, which would reintroduce the very resizing bugs we are trying to eliminate.

> **TODO note:** Instanced track sources still assume numeric track types during grouping. When string/boolean tracks are added, update the grouping + UI adapters to carry through the correct type.

> **Note on metadata updates (Mar 2025):** Track metadata changes (e.g., group labels) now bump a `tracksRevision` counter so subscriptions recompute instanced sources without mutating snapshots directly. If you see UI state “bounce” after editing labels, ensure the update path increments the revision instead of mutating tracks in place. This will remain important when the snapshot pipeline moves to WASM.

> **TS build gotcha (Mar 2025):** World-handle cloning must guard optional handles. `TransitionWorldHandle` requires numeric `deltaStamp`/`deltaValue`; when spreading partial `transitionsWorld`, use a clone helper that only copies handles when both numbers are present to avoid DTS failures.

> **Handle preservation note (Mar 2025):** During drag we now capture world-space handle deltas for every keypoint on the track (not just the anchor and its immediate neighbors) so reordering cannot retarget downstream handles and cause “resizing.” If a handle still moves in world space after a marker crosses another, check that `markerHandleOffsets` contains entries for those downstream points.

### Patch-first drag diffs

The current flow mutates Immer drafts directly and only emits `KeypointCommitDelta` (stamp/value) during commit. That representation cannot express handle-only updates, reorderings, or track-level ops, which forces us to re-run neighbor heuristics in multiple layers. As part of the refactor we should introduce an explicit diff structure that can be produced once (from the frozen snapshot) and applied both to previews and to the canonical store.

**Diff shape (per track):**

```ts
type TrackDiff =
  | { type: "updateKeypoint";
      trackId: string;
      keypointId: string;
      changes: {
        stamp?: number;
        value?: RawValue | ((curr: RawValue) => RawValue);
        transitionsWorld?: { in?: Delta; out?: Delta };
        custom?: Record<string, unknown>; // e.g., cached world CPs, flags
      };
    }
  | { type: "reorderKeypoints"; trackId: string; order: string[] }
  | { type: "insertKeypoint"; trackId: string; keypoint: Keypoint<RawValue> }
  | { type: "removeKeypoint"; trackId: string; keypointId: string };
```

**How it flows:**

1. Preview functions build diffs by comparing the frozen snapshot against the pointer delta. “Move px2 to the right” becomes `{ type: "updateKeypoint", changes: { stamp: … } }`; “keep handle fixed” becomes `{ changes: { transitionsWorld: { out: … } } }`; crossing triggers `{ type: "reorderKeypoints", order: [...] }`.
2. To render a preview we apply the diffs to the snapshot (or a clone) and feed the result into the derived snapshot cache. No direct mutation of `track.points` is needed; tests can inspect the diff output directly.
3. Commit reuses the same diffs (maybe after consolidating) and applies them to the canonical tracks. Because diffs mention `transitionsWorld` explicitly, crossings/handle drags never rely on implicit neighbor detection.
4. Any future wasm module can accept `(snapshot, pointerDelta)` and return a list of `TrackDiff`s; the JS side then applies them the same way.

**Ordering with other work:**

- Introduce `transitionsWorld` first so diffs can reference world deltas directly.
- In the same refactor, replace the ad-hoc preview mutations with the diff pipeline (it naturally consumes the frozen snapshot). Doing these two steps together avoids touching the drag plumbing twice.
- Add the derived geometry cache after diffs are in place; the cache can be populated either from the transformed snapshot or by replaying the diffs into a new structure.

By emitting explicit diffs we gain determinism (preview == commit), simplify testing/QA, and create a clean interface for future wasm acceleration.

> **Current status (March 2025):** The diff-based plumbing described above has landed, so preview/commit now consume the same serialized changes. `TransitionInfo` already stores anchor-relative deltas, which prevents cross-segment resizing; the remaining coupling work focuses on enforcing the new `pairing` semantics.

> **Rendering note:** When a marker crosses a neighbor the handles briefly disappear before reappearing. This looks like a visual delay (either in the renderer or in the diff application order) and should be investigated during the anchor-relative handle refactor. Keep an eye out for any obvious causes while reworking the snapshot/segment logic.

### Anchor-relative world migration plan (no normalized storage)

> **Status:** The anchor-relative form described here is now the default behavior (see `get-world-control-points.ts`). Keep the bullets below as legacy documentation for how we reached the current state; new work should treat anchor-relative deltas as canonical.

We redefine the meaning of `transitions` (still a `RawVector2`): `x` is Δstamp relative to the keypoint’s stamp (timeline 0–1), and `y` is Δvalue relative to the keypoint’s value. No separate `transitionsWorld` exists; the normalized neighbor-span meaning is snapshot-only and derived on demand.

1. **Canonical form:** Persist only anchor-relative world deltas in `transitions`. Drop the neighbor-span semantics from canonical data.
2. **Writers (drag/commit):** Read/write those world deltas directly; preserve them across reorder. Do not store normalized `{x,y}`.
3. **Snapshot/interpolator:** Derive normalized `{x,y}` from the world deltas and current neighbor stamps/values solely for computation/rendering; never write that back.
4. **Preview math:** `apply-drag-deltas`, `compute-row-data`, segment solvers operate on world deltas; derive normalized locally and discard.
5. **Tests/fixtures:** Keep vector2 shape but seed world deltas; add coverage (e.g., opacity `o1→o2`) proving downstream handles stay fixed after crossing.
6. **Types/cleanup:** Update docs/comments to reflect the new semantics; remove any remaining code that assumes neighbor-span-normalized storage.

Simplifications:
- Crossing/reorder stops retargeting handles because the deltas are anchored to the marker, not the neighbor span.
- Less cloning/dual-field juggling (`transitionsWorld` not needed).
- Interpolator math can convert once per segment from world→normalized using the current span.

New cases to handle:
- Anti-knot/effective handle logic still needs to clamp in world space before deriving normalized values.
- Any UI/editor that displayed normalized `x/y` must switch to showing world deltas or a derived view without persisting it.
- **Consistency note:** Enum-based transitions (easing presets) are typically defined in parametric space; they need a one-time translation into world deltas per segment to flow through the same pipeline as explicit handles. Fully migrating all codepaths (renderers, interpolators, diff builders) to the world form keeps behavior consistent; any parametric/ease lookup should be converted to world deltas at use time, not persisted as normalized.
- **Keypoint shape update:** `Keypoint.transitions` now allows either a `RawVector2` (interpreted as world deltas: `x = Δstamp` in timeline units relative to the marker, `y = Δvalue` relative to the marker) or a `StandardTransitionType` enum. There is no `transitionsWorld` field. When enums are present, convert them to world deltas at use time before feeding the shared pipeline.

**Implementation corrections (Mar 2025):**
- Explicit `transitions.{in|out}` are interpreted as anchor-relative world deltas; do **not** renormalize them by the neighbor span. Converting them back to parametric space is a derived concern (see `get-world-control-points.ts` for the correct mapping).
- The inbound handle is anchored to the end keypoint in both axes: `end.in.y` offsets the end value, not the start value.
- Marker drags only update the marker’s stamp/value; canonical `transitions` stay untouched (including enum presets), so dragging a marker no longer “rescales” handles. The snapshot path derives normalized values from the frozen world deltas when needed for rendering/interpolation.

### Transition model considerations

During the anchor-relative migration we will also reevaluate `Keypoint.transitions`. The goal is to allow every handle to be described either by:

1. **Anchor-relative world deltas** (`Δstamp`, `Δvalue` stored in `transitions` as `x/y`, relative to the marker stamp/value)—used whenever a handle has been explicitly edited. These keep handles fixed relative to their marker, regardless of neighbor span.
2. **An easing enum** for common cubic-bezier variants (`ease-in/out/linear` across `sine`, `cubic`, `quint`, `circ`, `quad`, `quart`, `expo`, `back`, etc.). Each enum value represents one side of the segment (e.g., `ease-out-cubic` = `{x: 0.35, y: 1}`), so transitions can remain lightweight until a user drags a handle.

On load we default the existing data to the appropriate `ease-*` enum. Once the user drags a handle we “bake” the result into the anchor-relative world delta so it stays fixed thereafter. This lets us keep the simple easing vocabulary while still supporting fully explicit handles, and the enum can be serialized alongside the world delta so downstream consumers know whether a handle is editable or derived. Any normalized view for rendering/interpolation is derived from these world deltas per span and discarded afterward.

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
  - Store the constrained anchor-relative `{x, y}` deltas in preview; commit writes the constrained values to canonical transitions.

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

**Progress (current):**
- Core math, clamps, and interpolator now consume anchor-relative world deltas (`get-world-control-points`, `compute-transition-params`, `compute-track-interpolator`, `clamp-monotonic-cubic-segment`).
- Drag start/preview paths capture world-handle offsets for all points and keep canonical transitions untouched when markers move; defaults convert enums to world deltas at use time.
- Tests updated toward anchor-relative semantics; remaining work is to finish handle drag diffs/coupling UI flow and rerun/expand TS + unit coverage.

**Handle-drag implementation path (next steps)**
- Components (view-only): `src/components/canvas-sheet/bezier-handles.tsx`
  - Add pointer/drag scaffolding mirroring `data-point.tsx`: pointer over/move/out, pointer down/cancel, `useCursor` on `gl.domElement`, and stopPropagation so markers/segments retain their hover/drag behavior.
  - Provide only visual feedback (hover scale/color, cursor, optional ghost connector while dragging); do not compute handle positions here—geometry comes from the derived snapshot.
- Store/actions: `src/actions/drag/start-drag.ts`, `src/actions/drag/commit-drag.ts`, `src/functions/apply-drag-deltas.ts` (or sibling helper), and `src/store.ts` types
  - Extend `DragAnchorRef` with `kind: "handle-in" | "handle-out"`, `neighborKeypointId`, and carry `attributePath`, `valueScale`, and `instanceId`.
  - On handle pointer down, call a new `startHandleDrag` action that seeds `dragState.handleDiffs` (keyed by keypointId with `{ in?, out? }`, storing anchor-relative world deltas) and `activeHandleId`.
  - `updateDrag` computes preview world CP deltas from the pointer, converts to anchor-relative deltas via a helper (e.g., `solveTransitionFromWorldCP`), and writes those to `handleDiffs` (respect coupling rules; enum/default remain enum until commit).
  - `commitDrag` promotes the affected handle(s) to explicit transitions in canonical data and clears `handleDiffs`; `cancelDrag` drops the preview.
- Derived/snapshot path: `src/functions/compute-row-data.ts`, `attachSegmentGeometry`
  - Merge `handleDiffs` (anchor-relative deltas + pairing) into canonical transitions before building `geometry.raw`, then run `clampMonotonicCubicSegment` to update `geometry.effective` so preview/commit visuals stay in sync.
  - No rendering code changes beyond consuming the existing `geometry`; all math stays in the derived pipeline.
- Tests/QA: add unit coverage for `solveNormalizedTransitionFromWorldCP`, handle coupling, default → explicit promotion on commit, and preview ≈ commit parity; add a Storybook/QA note for hovering/dragging handles.

### Phase 4 — QA, Telemetry, and Docs [ Incomplete ]
- Expand automated coverage for anti-knot clamping, preview vs commit equivalence, and default-to-explicit promotion.
- Run manual QA checklist (visibility gating, geometry parity, drag behavior, multi-selection) on representative animations.
- Update README/agent docs with any new shortcuts (reset hotkey) or flows discovered during implementation, and ensure telemetry/logging captures handle drag actions if required.

## Handle drag progress (current)

- `dragState.handleDiffs` stores anchor-relative world deltas (`RawVector2`) keyed by keypoint with `{ in?, out? }`. `start-handle-drag.ts` seeds the anchor/context, `update-handle-drag.ts` solves deltas from world CPs, and `commit-drag.ts` writes them back to keypoints.
- `compute-row-data.ts#attachSegmentGeometry` overlays any `handleDiffs` onto canonical transitions before deriving raw/effective control points and render params, so previews reflect handle drags without duplicating curve math in components.
- `bezier-handles.tsx` remains a thin view: it scales the derived geometry, dispatches handle drag actions with row/track/neighbor/value-scale context, and leaves position solving to the store/snapshot pipeline.
- Upcoming: couple in/out diffs during drag, route gesture-derived modifiers, and extend the preview diff plumbing so handle drags and marker drags compose without redundant clamp passes.
