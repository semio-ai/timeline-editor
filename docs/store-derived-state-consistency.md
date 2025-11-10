# Store Derived-State Consistency

**Author**: semio-agent  
**Status**: Living spec — snapshot orchestrator (snapshot-only mode)
**Last updated**: 2025-11-10

This document audits how the animation store produces preview feedback during drag operations and how the same data settles once a drag commits. The recent Bézier refactor highlighted that our subscription graph still lets derived slices update out of order, which produces visible “snap” artifacts (e.g., violations refiring after the mouse is released). The goal is to map the current dependencies and propose next steps that keep preview and post-commit state in lockstep.

---

## 1. Canonical vs. Derived State

| Slice | Shape | Produced by | Notes |
| --- | --- | --- | --- |
| `tracks` | `Record<TrackId, Track<RawValue>>` | Actions (`updateKeypoint`, `commitDrag`, etc.) | Canonical authoring data. |
| `animatables`, `animations`, `namespaces` | Records | Actions / initialization | Canonical metadata. |
| `selectionState`, `dragState` | Selection / drag descriptors | Click & drag actions | Drive preview logic. |
| `instancedTrackSources` | `Record<RowId, SourceRow>` | `updateInstancedTrackSources.ts` | Row definitions fed into row computations. |
| `trackInterpolators` | `Map<LookupId, { value, derivative }>` | `updateTrackInterpolatorsAndResults.ts` | Recomputed per track whenever `tracks[...]` changes; also mutates `values`, `velocities`, and `violations`. |
| `violations` | `Record<TrackId, Violation[]>` | Same subscription as above | Canonical, committed violations only (no preview). |
| `derivedSnapshot` | `DerivedSnapshot` | Orchestrator | Source of truth for track-level (interpolators, violations) and row-level (`rows[rowId].computed`) derived data. |
| `values`, `velocities` | `Map<LookupId, RawValue>` | `updateInterpolationResultsOnStampChange.ts` | Reads `trackInterpolators` + player state. |
| `viewVerticalAxes` | `Record<ViewId, AxisRange>` | `updateViewVerticalAxes.ts` | Still maintained separately; interpolator math uses its own scaling. |

### Files of interest

- `packages/animation/src/subscriptions/init-derived-orchestrator.ts` (source of truth; publishes `derivedSnapshot`, interpolators, violations, values, and velocities atomically)
- `packages/animation/src/functions/build-derived-snapshot.ts`
- `packages/animation/src/functions/compute-row-data.ts`
- `packages/animation/src/functions/apply-drag-deltas.ts`
- `packages/animation/src/actions/drag/commit-drag.ts`


---

## 2. Event Timeline (Drag → Commit)

### During drag (preview)
1. `updateDrag` updates `dragState`.
2. The orchestrator rebuilds the `DerivedSnapshot` via `buildDerivedSnapshot` and writes `derivedSnapshot` and projections (interpolators, violations, values, velocities) in one atomic `set`.  
   - `computeRowData` still applies `applyDragDeltas` before computing frames/interpolations and preview violations.  
   - Track-level violations under `.canonical` remain authoritative; row-level previews are reflected in `snapshot.rows[rowId].computed.violationSet`.


Preview visuals are sourced from `snapshot.rows[rowId].computed` and are driven by `dragState`.

### On commit (`commitDrag`)
1. `commitDrag` mutates selected `track.points` and clears `dragState`.
2. The orchestrator recomputes canonical track interpolators/violations, projects `values`/`velocities`, and rebuilds row data with `dragState = undefined`, then publishes all derived slices atomically. This removes the ordering race between track-level violations and row recomputation.

---

## 3. Dependency Graph (Simplified)

```
Tracks ─┐
        ├─ updateTrackInterpolatorsAndResults ──┐
Animatables ─┘                                  │
                                                ├─ values / velocities
                                                └─ violations (committed)

Selection ─┐
DragState ─┤
Tracks ────┴─ updateComputedRowData ──> ComputedRowData
Animatables
InstancedTrackSources
Violations  ────────────────┘
```

Key observation: `computedRowData` depends on `violations`, which are produced by a *separate* subscription that is itself triggered by the same track mutations. Because the two subscriptions are not coordinated, the store frequently shows:

1. Preview-time violations (pre-commit) during the last preview render.
2. Commit triggers track changes.  
   - `updateComputedRowData` runs first → `violationSet` still sees the pre-commit array.  
   - UI renders — nothing changes (appears “stale”).  
   - `violations` are then updated → a second pass recomputes row data → UI updates → “snap”.

The drag preview looked correct, but the post-commit view briefly regresses to an older violation state before snapping to the new value.

---

## 4. Why Equality Guards Don’t Prevent It

`updateComputedRowData` uses shallow comparisons across `dragState`, `selectionState`, `violations`, `tracks`, `instancedTrackSources`, etc. When `commitDrag` mutates tracks it produces a new `tracks` object immediately, so the equality guard returns falsy and the subscription runs. That happens **before** `updateTrackInterpolatorsAndResults` has a chance to rewrite violations, so the first pass reads “old” violations. When the violations map later changes, the guard triggers again, but the damage (visible flicker) is already done.

---

## 5. Chosen Direction — Orchestrator + Derived Snapshot
*Consolidate all derived recomputation into one deterministic pipeline and surface both track- and row-level projections from a shared cache.*

- Replace the scattered subscriptions with a single `recomputeDerivedState(state, set)` helper.
- The orchestrator:
  1. Builds updated interpolators and violations for tracks whose stamps/values changed (drag preview could reuse this path via synthetic track copies).
  2. Builds `computedRowData` *within the same call*, using the freshly produced violation arrays.
  3. Publishes all derived slices (`values`, `velocities`, `computedRowData`, `trackInterpolators`, etc.) in one `set` to guarantee coherence.
- Benefits:
- No order-dependent races.
- Easier to move the math into a worker/wasm module in the future because the orchestrator forms a single callback.
- Challenges:
  - Requires reshaping several subscribers and ensuring we still short-circuit unchanged rows for performance.

#### Option A: Expanded Sketch

A possible orchestration pipeline:

```ts
function initDerivedOrchestrator(api: AnimationApi, set: AnimationStoreSetter, get: AnimationStoreGetter) {
  let lastSignature: DerivedSignature | null = null;

  return api.subscribe(
    // Select canonical slices that influence derived state
    (state) => pickDerivedInputs(state),
    (inputs, previousInputs) => {
      const signature = computeSignature(inputs);
      if (signatureEquals(signature, lastSignature)) return;
      lastSignature = signature;

      const updates = recomputeDerivedState({
        inputs,
        previousInputs,
        existingDerived: {
          interpolators: get().trackInterpolators,
          values: get().values,
          velocities: get().velocities,
        },
      });

      // Apply a single atomic set to update all derived slices
      set(updates);
    },
    { fireImmediately: true },
  );
}
```

`pickDerivedInputs` would gather everything that currently feeds the various subscriptions: canonical tracks/animatables/namespaces, instanced row definitions, selection & drag state, player stamp/speed (from `usePlayerStore`), editor view configs, and any geometry data provided by the UI.

`recomputeDerivedState` might subdivide into phases:

1. **Track-Level Phase**
   - For each track whose points or metadata changed since the last signature:
     - Build interpolators (`computeTrackInterpolator`) and derivative functions (`computeDerivativeInterpolator`).
     - Recalculate violations (`computeTrackViolations`) with canonical animatable constraints.
   - Produce incremental updates to `trackInterpolators`, `values`, `velocities`, and `violations`.

2. **Row-Level Phase**
   - For each source row (from `instancedTrackSources`):
     - Use the canonical `violations` map from phase 1 together with selection/drag state to invoke `computeRowData`.
     - Cache results per row so we only recompute when dependent tracks or preview inputs changed.

3. **View Axis Phase**
   - Rebuild `verticalAxisByView` / `verticalWorldRangeByView` once per row or view if settings changed (replacing `updateViewVerticalAxes`).

4. **Player Snapshot Phase**
   - Using the new `trackInterpolators` plus the latest player stamp/direction/speed, derive `values` and `velocities`.

5. **Output Assembly**
   - Merge all phased results into a single object returned from `recomputeDerivedState`, e.g.:
     ```ts
     {
       trackInterpolators: { ... },
       violations: { ... },
       computedRowData: { ... },
       values: newValuesMap,
       velocities: newVelocitiesMap,
       derivedVersion: signature.version,
     }
     ```

`signatureEquals` supplies the guard that previously lived in each individual subscription. It can be as simple as hashing the identity of tracks/rows/selection or as precise as tracking per-track dirty flags.

**Subscriber consolidation**

| Current subscription | Responsibility | New orchestration step |
| --- | --- | --- |
| `updateTrackInterpolatorsAndResults` | Interpolators, values, velocities, committed violations | Phase 1 + 4 |
| `updateComputedRowData` | Row frames/interpolations/preview violations | Phase 2 |
| `updateInterpolationResultsOnStampChange` | Player-driven value updates | Phase 4 |
| `updateViewVerticalAxes` | View axis derivation | Phase 3 |
| `updateAllInterpolatorsAndResultsOnDataChange` | Wiring multiple per-track subscribers | Eliminated (handled centrally) |

Other subscribers (`updateInstancedTrackSources`, `updateGlobalSources`, etc.) either feed canonical inputs or maintain unrelated slices and can remain untouched initially; the orchestrator only replaces the ones generating derived math.

**Implementation considerations**

- **Caching:** use per-track and per-row caches keyed by signature components so unchanged entities aren’t recomputed every tick.
- **Player Store Integration:** either fold player data into the signature or have the orchestrator subscribe to `usePlayerStore` separately but still write `values`/`velocities` through the same code path.
- **Preview vs. commit:** during drag, phase 1 can reuse canonical track interpolators while phase 2 applies `applyDragDeltas` for preview visuals; after commit, the same phases recompute with `dragState = undefined`.
- **Transition path:** start by housing the existing logic inside `recomputeDerivedState` without aggressive caching, then delete redundant subscribers once parity is confirmed.

### Normalized Derived Snapshot (Track cache feeding row view)

Today we recompute the same math in two places: once per track (`updateTrackInterpolatorsAndResults`) and once per row (`updateComputedRowData`). A more explicit organization is to normalize the derived state first, then present both track and row views from that cache.

#### Schema

```ts
type TrackKey = `${string}/${string}/${string}`;

interface DerivedTrack {
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
    animatableId: string;
    duration: number;
    timescale: number;
  };
}

interface DerivedRow {
  id: string;
  trackKeys: TrackKey[];
  computed: ComputedRowData;
}

interface DerivedSnapshot {
  version?: number;
  dragContext?: DragState;
  tracks: Record<TrackKey, DerivedTrack>;
  rows: Record<string, DerivedRow>;
}
```

#### Computation phases
1. **Track phase**
   - Identify dirty `(namespace, instance, track)` tuples.
   - Populate `DerivedSnapshot.tracks[trackKey].canonical` using `computeTrackInterpolator`, `computeDerivativeInterpolator`, and `computeTrackViolations`.
   - When dragging, attach preview overrides under `.preview`.
2. **Row phase**
   - For each `SourceRow`, collect the `TrackKey`s it references and reuse the cached `DerivedTrack` entries when calling `computeFrames`, `computeTransitionSegments`, and `computeViolationSet`.
   - Store the result in `DerivedSnapshot.rows[rowId]`.
3. **Publishing**
   - Write `DerivedSnapshot` to the store (initially alongside legacy slices).  
   - Expose projections:
     ```ts
     state.trackInterpolators → snapshot.tracks mapped to { interpolator, derivative }
     state.violations         → snapshot.tracks mapped to canonical violations
     UI reads snapshot.rows[rowId].computed directly
     ```
   - Preview consumers decide whether to use `.canonical` or `.preview` based on `dragState`.

#### Migration path
1. **Build in parallel.** Implement the snapshot helper/orchestrator without removing existing subscribers; keep emitting legacy slices.
2. **Equivalence tests.** Verify that legacy vs. snapshot outputs match (row frames, interpolations, violations, per-track interpolators/derivatives).
3. **Feature flag rollout.** Toggle consumers to read from `DerivedSnapshot` while legacy data remains in sync.
4. **Retire legacy slices.** Once tests and manual checks are green, delete the redundant subscriptions and rely solely on the normalized snapshot.
   - Final state: a single orchestrator (or snapshot builder) subscription replaces `updateTrackInterpolatorsAndResults`, `updateComputedRowData`, `updateInterpolationResultsOnStampChange`, `updateViewVerticalAxes`, and `updateAllInterpolatorsAndResultsOnDataChange`. Other subscribers (e.g. `updateInstancedTrackSources`, `updateGlobalSources`, player loop wiring) stay untouched unless we later fold their responsibilities into the orchestrator.

This normalization keeps track-level and row-level projections coherent, makes it easy to collapse subscribers later, and prepares the ground for a single orchestrator—or even a worker/wasm module—that produces the entire `DerivedSnapshot` payload in one pass.

## 6. Short-Term Recommendations

1. **Instrument current subscribers** to capture ordering and timing during drag commits (verify the race described in §2).
2. **Prototype the snapshot builder** in parallel with the legacy slices (no consumers switch yet).
3. **Add equivalence tests** to ensure the snapshot output matches today’s per-track/per-row results before retiring any subscriptions.

These steps keep the door open for a future worker/WASM integration where one callback produces the entire derived payload at once.

---

## 7. Implementation Outline & Notes Log

Use this living checklist to plan the migration, log blockers, and document breakthroughs. Update the “Status / Notes” column as work proceeds.

| # | Task | Status / Notes |
| --- | --- | --- |
| 1 | Instrument current subscribers to capture ordering/timing around `commitDrag` (focus: `updateTrackInterpolatorsAndResults` vs `updateComputedRowData`). | ☑ Added `logDerivedEvent` helper and start/end logs in both subscribers. Enable via `globalThis.__SEMIO_DEBUG_DERIVED__ = true` (or `SEMIO_DEBUG_DERIVED=true`) to trace execution order; no behavioural change when disabled. |
| 2 | Introduce a `buildDerivedSnapshot` helper that mirrors existing outputs while still emitting legacy slices. | ☑ Implemented `buildDerivedSnapshot` to compute per-track interpolators/violations and per-row `computeRowData` results from current store inputs. Helper is exported but unused; next step is to drive it from instrumentation/tests before switching consumers. |
| 3 | Add vitest coverage comparing legacy vs snapshot outputs (per-track interpolators/violations, per-row frames/interpolations). | ☑ Added `build-derived-snapshot.test.ts` with factories to diff canonical interpolators/violations and row data against current helpers. |
| 4 | Remove `derivedMode` and run the snapshot orchestrator unconditionally. | ☑ Snapshot-only mode active; orchestrator computes and publishes `derivedSnapshot` and projections atomically. |
| 5 | Switch `computedRowData` consumers to read from the snapshot while keeping legacy data in sync. | ☑ Core components/actions now resolve row data through `resolveComputedRowData`, which prefers the snapshot when `derivedMode === "snapshot"`. `updateComputedRowData` builds the snapshot first, then maps its rows back into the legacy cache so both paths stay aligned. Violations now hydrate through `TrackKey` lookups exclusively, keeping preview and commit parity across namespaces. |
| 6 | Switch `violations`, `trackInterpolators`, `values`, `velocities`, and axis consumers to snapshot projections. | ☑ Snapshot mode now projects violations via `TrackKey`, resolves track interpolators, mirrors axis updates into the snapshot cache, and routes editor value reads through `resolveInterpolatedValues`/`resolveInterpolatedVelocities`. Remaining subscriber work moves to step 7 alongside the orchestrator. |
| 7 | Replace legacy subscribers with the orchestrator that maintains the snapshot and publishes projections atomically. | ☐ |
| 8 | Remove legacy slices/flags, finalize docs, and baseline perf/behaviour. | ☐ |

Feel free to add sub-rows or timestamps when specific issues arise (e.g., cache invalidation bugs, perf regressions) or when a breakthrough unblocks a subsequent step.

---

## 8. References

- `packages/animation/src/actions/drag/commit-drag.ts`
- `packages/animation/src/functions/compute-row-data.ts`
- `packages/animation/src/subscriptions/update-computed-row-data.ts`
- `packages/animation/src/subscriptions/update-track-interpolators-and-results.ts`
- `packages/animation/docs/drag-marker-debugging.md`
- Undo/redo middleware uses zundo on the canonical store slices. Ensure the orchestrator produces derived snapshots *after* canonical mutations so zundo checkpoints remain valid. Preview-only data (drag state, derived snapshot) should remain outside the undo stack or be guarded via selectors passed to zundo.
- `packages/animation/src/functions/build-derived-snapshot.ts` and `packages/animation/src/types/util/derived-snapshot.ts`
