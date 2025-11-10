# @semio/animation Documentation

`@semio/animation` supplies the shared animation timeline, selection, and gesture system used across Semio surfaces. The package exposes React components (timeline HUD, track controls, playback widgets), the zustand store that powers them, helper actions for manipulating animation data, and a suite of utilities for rendering and validating animated motion.

This document captures the current organization, data structures, and runtime flow of the library. Pair it with the root `AGENTS.md` and `packages/animation/AGENTS.md` when planning new work.

## Package Anatomy

| Path | Purpose | Notes |
| --- | --- | --- |
| `src/index.tsx` | Package entry point | Re-exports public components, hooks, store helpers, actions, utilities, and test fixtures. Keep this file authoritative for public API shape. |
| `src/components/` | React components for the animation sheet, controls, HUD, and visualization widgets | Split into focused sub-folders (`animation-sheet`, `controls`, `canvas-sheet`, etc.). Components consume the zustand store via hooks and context. |
| `src/actions/` | Pure Immer reducers mutating `AnimationData` | Includes creation/update/removal of animations, tracks, keypoints, color controls, and drag orchestration (`actions/drag/*`). All mutations flow through these helpers. |
| `src/functions/` | Pure computation helpers and derived data builders | Houses frame interpolation, source-tree management, drag math, virtual frame generation, selection-state helpers, and rendering-specific transforms. |
| `src/hooks/` | React hooks for interacting with the store, gestures, and rendering primitives | Includes gesture bindings (`use-drag-gestures`, `use-zoom-gestures`), spring helpers, player integration, and selectors (`use-animation-store`). |
| `src/subscriptions/` | Store subscriptions registered at init | Maintain derived state (interpolators, computed rows, global sources), synchronize with the shared player store, and clean up via unsubscribe handles. |
| `src/store.ts` | zustand store slice factory | Composes `AnimationData` state with `AnimationActions`, wires Immer-based updates, and bootstraps subscriptions. |
| `src/store-types.ts` | Canonical types for store state and actions | Documented source of truth for the data model. Update alongside behaviour changes. |
| `src/types/` | Domain types for animations, sources, views, and drag state | Structured by `data/` and `util/` folders; heavily referenced by consumer apps. |
| `src/test-fixtures/` | Reusable sample animations/tracks | Use these when adding Vitest coverage or Storybook scenarios. |
| `src/tests/` | Vitest suites (currently commented while refactors land) | Re-enable/update when functionality becomes active. |
| `docs/` | Architecture and migration notes | Add supplementary deep dives here; keep this README as the high-level map. Prune/merge supplementary deep dives when no longer relevant or outdated. |

## Migration Plans

- [ ] [Selection State Migration](./selection-migration.md)
- [ ] [Canvas Sheet Layering & Contrast Migration](./canvas-sheet-layering-migration.md)
- [ ] Centralize test microtask flushing by adding a shared helper (e.g., `flushMicrotasks`) and replacing `setTimeout`-based waits in tests

## Core Data Model

The zustand store (`AnimationData` in `store-types.ts`) is the single source of truth. Key fields:

- `values` / `velocities`: `Map<string, RawValue>` keyed by namespace-qualified IDs describing the sampled value/velocity at the current stamp. Updates propagate to the player and consuming apps.
- `trackInterpolators`: Cache of active interpolators (`TrackInterpolators`) used to sample values and detect violations.
- `namespaces`: Namespaced animation instances keyed by ID. Encodes instance/group relationships so overlapping tracks do not stomp each other.
- `animations` / `tracks`: Canonical animation metadata (`StoredAnimation` + `Track<RawValue>`) loaded in the editor. Tracks reference keypoints and interpolator configuration.
- `selectionState`: Path-based selection record managed via `functions/selection-state-manager.ts`. Replaces the earlier point-array selection.
- `previews`: Semantic time markers (`Preview`) for scrubbers, hover, etc.
- `dragState`: Structure describing in-progress virtual drag operations, including original keypoint positions and offsets.
- `editorViews`: Multi-window configuration (see `types/util/view.ts`) capturing view mode, active source rows, and layout preferences.
- `sourcesByAnimationInstance` / `instancedTrackSources`: Hierarchical representation of animation data grouped by animation, namespace, and instance.
- `sourceRowIds`: Global order of visible rows for views; per-row computed data is read from `derivedSnapshot.rows[rowId].computed`.
- `violations`: Track-level validation results (e.g., interpolation or constraint issues).
- `preferences`: UI toggles (hover dashed line, data previews) synced with consuming apps.
- `animatables`: Temporary bridge storing legacy animatable metadata during migration.

Updates to these structures should go through the corresponding actions and pure helpers—avoid direct mutations in components.

## Actions & Mutations

All state changes flow through the `src/actions` layer. Notable groups:

- **Animation lifecycle**: `addAnimation`, `removeAnimation`, `createNewDefaultAnimation`, `setAnimations`, `getStorableAnimation` (with serialization logic in `functions/compute-stored-animation.ts`).
- **Track & keypoint editing**: `createTrack`, `updateTrack`, `removeTrack`, `createKeypoint`, `updateKeypoint`, `removeKeypoint`, plus batch variants for multi-edit operations. These functions ensure track metadata stays in sync with `animations[...]`.
- **Selection & gestures**: `clickMarker` coordinates modifier-key behaviour and ties into the selection state. Drag-specific actions (`startDragging`, `updateDragDelta`, `commitDrag`, `cancelDrag`) maintain ID-based selections, update virtual frames, and resample values through helper functions such as `apply-drag-offsets.ts`.
- **Preferences**: `setPreferences` maintain UI-specific metadata while keeping mutations pure.

Each action assumes Immer-managed drafts—pass the zustand state into the helper instead of mutating directly.

## Derived State & Subscriptions

`initAnimationSubscriptions` registers long-lived observers (see `src/subscriptions`):

- `updatePlayerLoop` and `updateOverallDuration` keep the global player (`@semio/utils`) aligned with sheet bounds and duration changes.
- `updateAllInterpolatorsAndResultsOnDataChange` and `updateInterpolationResultsOnStampChange` recompute `values`, `velocities`, and `trackInterpolators` as data or playback stamp changes.
- `updateInstancedTrackSources`, `updateGlobalSources`, `updateSourceRowIds`, and `updateConsolidatedSourceRow` build the canonical inputs for rows. The snapshot orchestrator (`initDerivedOrchestrator`) computes `derivedSnapshot` and projections consumed by sheet components and Storybook demos.

Subscriptions return teardown functions; `initAnimationSubscriptions` wires the orchestrator and input subscriptions and defers registration to avoid cascading updates during initial store creation.

## Data Flow Overview

```mermaid
stateDiagram-v2
  direction LR

  state "Animation" as Animation
  state "Track<RawValue>" as TrackRaw
  state "AnimationInstance" as AnimInstance
  state "AnimatableValue" as AnimValue
  state "DragState" as DragState
  state "PlayerData" as PlayerData

  state "Source[]" as SourceArray
  state "SourceRow" as SourceRow
  state "SourceRow (global view)" as GlobalSourceRow

  state "InstancedFrameInfo[]" as InstancedFrames
  state "InstancePair[]" as TransitionPairs
  state "{min,max} bounds" as Bounds
  state "ViolationSet" as ViolationSet
  state "Row (derivedSnapshot.rows[*].computed)" as RowComputed
  state "SelectionState" as SelectionState

  state "TrackInterpolators" as TrackInterpolators
  state "Map<string, RawValue>" as Values
  state "Map<string, RawValue> (velocities)" as Velocities
  state "Record<string, Violation[]>" as ViolationMap
  state "TrajectoryMessage" as TrajectoryMessage

  [*] --> Animation
  [*] --> TrackRaw
  [*] --> AnimInstance
  [*] --> AnimValue
  [*] --> DragState
  [*] --> PlayerData

  Animation --> SourceArray : updateGlobalSources<br/>computeDefaultSourcesFromInstance
  TrackRaw --> SourceArray : updateGlobalSources
  AnimInstance --> SourceArray : updateGlobalSources
  AnimValue --> SourceArray : updateGlobalSources

  SourceArray --> SourceRow : updateInstancedTrackSources
  SourceArray --> GlobalSourceRow : computeConsolidatedSourceRow

  SourceRow --> InstancedFrames : computeFrames
  DragState --> InstancedFrames : applyDragDeltas
  InstancedFrames --> TransitionPairs : computeTransitionSegments<br/>computeFilledInterpGaps

  SourceRow --> Bounds : computeVerticalBounds
  TrackRaw --> Bounds : computeVerticalBounds
  AnimValue --> Bounds : computeVerticalBounds

  ViolationMap --> ViolationSet : computeViolationSet

  TransitionPairs --> ComputedRowData : updateComputedRowData
  Bounds --> ComputedRowData : updateComputedRowData
  ViolationSet --> ComputedRowData : updateComputedRowData
  InstancedFrames --> ComputedRowData : updateComputedRowData
  SourceRow --> ComputedRowData : updateComputedRowData
  GlobalSourceRow --> ComputedRowData : updateComputedRowData

  ComputedRowData --> SelectionState : selection-state-manager

  TrackRaw --> TrackInterpolators : computeTrackInterpolator
  AnimInstance --> TrackInterpolators : computeTrackInterpolator
  AnimValue --> TrackInterpolators : computeTrackInterpolator

  TrackInterpolators --> Values : updateInterpolationResultsOnStampChange
  TrackInterpolators --> Velocities : updateInterpolationResultsOnStampChange
  PlayerData --> Values : updateInterpolationResultsOnStampChange
  PlayerData --> Velocities : updateInterpolationResultsOnStampChange

  TrackInterpolators --> ViolationMap : computeTrackViolations
  AnimValue --> ViolationMap : computeTrackViolations
  TrackRaw --> ViolationMap : computeTrackViolations

  TrackInterpolators --> TrajectoryMessage : computeTrackTrajectories
  SourceRow --> TrajectoryMessage : computeTrackTrajectories
  PlayerData --> TrajectoryMessage : computeTrackTrajectories
```


## Rendering Surface

- `AnimationSheet` / `AnimationSheetCore` compose the timeline UI (headers, controls, track list, canvas).
- `ControlWidget`, `TrackControl`, `MotionCubicBezierLine/MotionCubicBezierFill`, and the `controls/` subtree power the HUD and inspector.
- `canvas-sheet/` contains Three.js powered visualizations, pairing with gesture hooks for pan/zoom.
- Components rely on `AnimationContext` + `useAnimationStore` to bind to store slices; avoid re-exporting raw store handles from components.

Storybook stories live in `apps/docs/stories` under the `Animation/` namespace. When adding new UI, create a companion story grouped by package name so the centralized docs stay organized.

## Gestures & Springs

Hooks under `src/hooks` wrap `@use-gesture/react`, and custom math helpers to provide:

- Drag/zoom gestures (`use-drag-gestures`).
- Positioning, rendering springs (`use-hover-spring`, `use-playhead-spring`, `use-invariant-scale`).
- Visuals/Name context exposure (`use-names`, `use-colors`, `use-track-animatables`).
- Camera helpers for Three.js scenes (`use-ortho-camera-setup`).

Use these hooks rather than inlining gesture logic inside components; they encapsulate the ID-based selection system and store mutations.

## Testing & Fixtures

- Vitest suites in `src/tests` illustrate how to exercise reducers and derived data helpers. Some suites are currently commented pending the ID-based selection rollout—revive or extend them as features stabilize.
- Fixtures in `src/test-fixtures` provide deterministic animations/tracks. Reuse them in tests and Storybook to keep scenarios consistent.

## Working Notes

- Keep documentation in sync with major architectural changes (selection refactors, gesture migrations, virtualization updates). Add deep dives under `docs/` for large efforts and link them from PRs.
- Record TODOs with `TODO(semio-agent):` and reference the relevant doc when partial work remains.
- When altering exported types or store shape, update this README (data model section) and note the changes in `packages/animation/AGENTS.md`.

Staying aligned with these patterns keeps `@semio/animation` reliable for downstream apps and easier for future contributors—human or automated—to navigate.
