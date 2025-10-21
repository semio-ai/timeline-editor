# Canvas Sheet Layering & Contrast Migration Plan

## High-Level Goals

- Bring transition segment visuals in line with the marker treatment in `packages/animation/src/components/canvas-sheet/data-point.tsx`: inactive instances render with reduced contrast, selected segments stay bold, and buffer segments remain legible without overpowering keyed data.
- Replace the implicit depth ordering (list index plus ad hoc `Z` values) with an explicit priority model so spline mode consistently stacks selected tracks above the active instance, and the active instance above all other instances.
- Preserve existing interaction affordances—drag/selection flows, buffer visualization, and overlay readability—while keeping the new layering rules straightforward to extend during the forthcoming Phase 2 store refactor.

## Phase 0 – Context Capture

- [ ] Re-read `README.md` and `docs/phase2-preparation.md` to confirm dragging and store-refactor constraints.
- [ ] Document the current color and contrast behavior from `packages/animation/src/components/canvas-sheet/data-point.tsx:150`, including selectability and active-instance dimming rules.
- [ ] Record existing Z ordering from `packages/animation/src/constants.ts` and any hard-coded `z` offsets across canvas components.

## Phase 1 – Transition Segment Contrast Alignment

### 1.1 Store Access & Helpers

- [ ] Add memoized selectors to pull `selectionState` and the active instance inside `transition-segment.tsx`.
- [ ] Create a helper to derive segment metadata (selectable versus buffer, active-instance membership, selection status).

### 1.2 Color Derivation

- [ ] Mirror the DataPoint color mixing for `lineColor`, `fillColor`, buffer adjustments, and theme-aware dimming.
- [ ] Ensure styles degrade gracefully when segments span multiple instances or contain no selectable points.

### 1.3 Wiring & Review

- [ ] Pass the computed colors into `MotionCubicBezierLine` and `MotionCubicBezierFill`.
- [ ] Validate TrackRender modes (Key, Transition, Preview, Spline) to keep the intended opacity and buffer behavior.

## Phase 2 – Track Depth Ordering

### 2.1 Priority Computation

- [ ] Build a utility (e.g., `computeTrackRenderPriority`) that ranks `SourceRow` ids using selection and instance data.
- [ ] Add unit tests for mixed-instance and multi-selection cases.

### 2.2 Renderer Updates

- [ ] Sort `sourceRowIds` in `packages/animation/src/components/canvas-sheet/tracks-renderer.tsx:178` based on priority while preserving stability within buckets.
- [ ] Extend `DataRenderer` to accept a `zOffset` expressing priority (selected > active instance > others).

### 2.3 Constant Updates

- [ ] Introduce explicit Z constants for track layers in `packages/animation/src/constants.ts` (for example, `TrackBase`, `TrackActiveOffset`, `TrackSelectedOffset`).
- [ ] Audit other canvas components to ensure overlays (playhead, bounds, violations) remain in front or behind as intended.

## Phase 3 – Validation & Tooling

- [ ] Manual QA: toggle render modes, switch active instances, and perform drag/selection gestures to verify live reordering and dimming.
- [ ] Add or update screenshot or Storybook coverage if available for spline mode with mixed instances.
- [ ] Run `npm run lint`, targeted tests, and any visual diff tooling before merge.

## Phase 4 – Documentation & Handoff

- [ ] Summarize the new layering rules and color heuristics in the appropriate package README.
- [ ] Update this migration checklist, marking completed tasks with `[x]` as work progresses.
- [ ] Capture residual risks or follow-ups (for example, dependencies on the Phase 2 store refactor) in `docs/phase2-preparation.md` if relevant.
