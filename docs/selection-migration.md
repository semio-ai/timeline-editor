## Selection State Migration Plan

This guide walks through migrating `@semio/animation` from the current path‑based selection implementation to the keypoint/instance keyed approach outlined in `selection.md`.

### 1. Establish the target data model
```ts
interface SelectionAnchor {
  rowId: SourceRowId;
  markerId: string;
}

interface SelectionState {
  /**
   * Identifies the animation instance whose keypoints are currently selectable.
   * This replaces `activeAnimationInstance` in the store so the selection
   * becomes the single source of truth.
   */
  instanceId: string | null;
  keypoints: Map<string /* trackId */, Set<string /* keypointId */>>;
  reference?: SelectionAnchor;
}
```
- [x] Added the new keypoint-driven `SelectionState` model in code.
- [ ] Add derived helpers for rendering (`isMarkerSelected`, `isRowReferenced`) that accept computed marker data instead of raw path strings.
- [x] Began migrating `state.activeAnimationInstance` usages so they reference `selectionState.instanceId`, avoiding duplicated authorities for the active instance.

### 2. Refactor the store slice
- [x] Replaced the legacy `selectionState` + `activeAnimationInstance` pairing with the new consolidated state in the store and default factories.
- [x] Updated `store-types.ts` so consumers access the active instance through `selectionState.instanceId`.
- [ ] Remove helpers that assume path-based representations (`pathSet`, `rowStates`) and rework selectors to leverage the new structure (remaining consumers: selection tests + ancillary tooling).

### 3. Refactor event actions
```ts
interface SelectionActions {
  clickMarker(
    selection: SelectionState,
    markerPoints: MarkerPoint[],
    context: { rowId: SourceRowId; markerId: string; shift?: boolean; mod?: boolean },
  ): SelectionState;

  clearSelection(selection: SelectionState): SelectionState;

  getRangeSelection(
    selection: SelectionState,
    rowId: SourceRowId,
    startMarkerId: string,
    endMarkerId: string,
    computedRowData: ComputedRowDataMap,
  ): SelectionState;
}
```
- [x] Rebuilt `clickMarkerAction`, modifier toggles, and range handling; store-level actions return `Partial<AnimationData>` patches (parity with `clickMarkerAction`). Keep pure helpers that return `SelectionState` for unit tests.
- [x] Removed reliance on path-based mutations; selection changes now read/write the keypoint map.
- [x] Range selection now resolves marker stamps lazily from `computedRowData` (prevents stale references post-drag).
- [x] Implemented `clickLineAction` and added `clickLine` store action; segment clicks act on row-foreground keys and never modify the reference.

### 4. Update derived selectors and helpers
- [x] Replaced `selection-state-manager.ts` with keypoint-centric helpers (`extractKeypoints`, `collectRangeKeypoints`, etc.).
- [ ] Audit remaining consumers that still depend on marker-path helpers (tests + debugging utilities) and migrate them.
  - Introduced shared test helpers (`selection-test-helpers.ts`) and migrated the click-marker, basic-selection, modifier-selection, visual-selection, and global-track-selection suites off `createMarkerPath`/`pathSet`; runtime selectors (`isMarkerSelected`, etc.) still pending.

### 5. Migrate renderers and hooks
- [~] `DataPoint` now reads from the new selection structure and uses the refactored click action. Remaining surfaces (row headers, keyboard handlers) still expect path utilities.
- [x] `TransitionSegment` now dispatches `clickLine` on click (row-wide selection; no reference updates).
- Verify visuals using the helper API (reference markers, partial selection) and delete any fallback logic that expected multiple surfaces to map to identical paths.

### 6. Simplify store shape
- [ ] Drop any leftover path-centric selectors/utilities once tests + tools are updated.
- [x] Removed `activeAnimationInstance` in favour of `selectionState.instanceId`.
- [ ] Clean up deprecated helpers/loggers after the consumer audit.

### 7. Refresh test coverage
- [ ] Update selection test fixtures to assert against keypoint ids rather than path strings.
  - Completed for the migrated suites above; remaining debug/drag fixtures still emit path strings.
- Add new tests that cover:
  - Added `line-click-selection.test.ts` covering row-wide toggle, Cmd/Ctrl toggling across rows, cross-row Shift behaves like a plain click, and instance inference for `selectionState.instanceId`; global-row filtering test still TODO.
  - Modifier behavior (reference updates, toggling)
  - Range selection after marker drag (confirms stamp lookup is live)
  - Global-row filtering (only active instance keypoints selected)
- [ ] Migrate the selection test suite to the new helper conventions (currently still path-based and failing).
  - Completed for `basic-selection.test.ts`, `click-marker-action.test.ts`, `global-track-selection.test.ts`, `modifier-selection.test.ts`, and `visual-selection.test.ts`; remaining suites (`timeline-track-selection-debug`, drag/virtual-frame diagnostics) still rely on path-based assertions.
  - Added regression coverage that preserves multi-row selections when a new shift range is created in a different row.
- Remove any path-format assertions that no longer apply.

### 8. Documentation and handoff
- [x] Updated `selection.md` with the redesigned model and linked migration notes.
- [ ] Update `docs/README.md` and other docs after tests + remaining components migrate.
- Note any intentional deviations (e.g., if legacy compatibility needs to remain for downstream consumers).

Following these steps will replace the fragile path-based system with an instance/keypoint driven model that better matches the documented behaviour and stays resilient when marker paths change.

### Spec vs Implementation Variances

- Transition segment (row) clicks not yet implemented
  - Spec: Clicking a transition segment should act on all foreground keys in that row. Plain click selects all foreground keys if any are unselected; if all are selected, it deselects the entire row. Cmd/Ctrl should toggle according to the same rules without clearing other rows. Shift across rows is a fresh click (unless we later add row-range selection).
  - Impl: No `clickLine` action exists yet, and `TransitionSegment` currently logs on click without dispatching selection. There is no row-level foreground key aggregation helper yet.

- Instance scoping for global row
  - Spec: You cannot select across animation instances; in global/timeline rows, only active instance data are interactive.
  - Impl: `resolveInstanceId` derives an instance from `MarkerPoint[]`; if multiple instance ids appear and no selection instance is set, it returns the first found id. This relies on upstream filtering to supply points for a single instance. Proposed guardrails: ensure extractors (`extractKeypoints` and the new `extractSegmentKeypoints`) always filter by the `instanceId` determined for the current selection, and short-circuit if no points match the active instance.

- MOD/CMD-click reference handling
  - Spec: A valid Cmd/Ctrl click resets the reference only on marker clicks; segment clicks must not modify the reference. If toggling off the current reference via a marker click, the reference is cleared.
  - Impl: Implemented: for markers, `handleModifierToggle` already matches this behaviour; for segments, `clickLine` never updates or clears the reference.

- Shift-click scope and replacement behaviour
  - Spec: Shift-click is row-scoped; cross-row shift behaves like a fresh single click. Within the same row, Shift collects an inclusive range between the reference and clicked anchor; with Cmd/Ctrl+Shift, it extends rather than replaces. Shift-clicking should not clear selections accumulated in other rows.
  - Impl: `handleShiftSelection` enforces row-scoping, preserves selections in other rows, and uses `extend` (passed via `mod`) to add rather than replace. This aligns with the spec.

- Foreground-only inclusion
  - Spec: Visual “selected” state and row/segment selection consider only foreground selectable data; non-foreground or non-selectable points should not enter the selection set.
  - Impl: The current helpers imply filtering but this is not yet exhaustively asserted in tests. Proposed: ensure both marker and segment extractors include a `foregroundOnly` filter aligned with `SourceRowInfo`/computed row data.

- Derived view helpers still pending
  - Spec: View should mark a marker as selected if all of its foreground points are selected, and reference styling should follow the stored anchor.
  - Impl: The TODO for `isMarkerSelected`/`isRowReferenced` remains. Complete these to ensure visuals match the spec, including group/global propagation rules.

### 9. Implement `clickLine` (Transition Segment Selection)

Introduce a cohesive line-click action that mirrors `clickMarker` semantics while applying row-level foreground rules:

```ts
// Store-level action (parity with clickMarkerAction): returns a store patch
function clickLineAction(
  state: AnimationData,
  rowId: SourceRowId,
  segmentId: string,
  shift?: boolean,
  mod?: boolean,
): Partial<AnimationData>;

// Optional pure helper for unit tests
function applyClickLine(
  selection: SelectionState,
  context: { rowId: SourceRowId; segmentId: string; shift?: boolean; mod?: boolean },
  computedRowData: ComputedRowDataMap,
): SelectionState;
```

Behavioural rules:
- Plain click:
  - Determine `instanceId` consistent with `selection.instanceId` (or switch to a valid instance present on the row if selection has none).
  - Resolve the set S = all foreground `{ trackId, keypointId }` pairs in the given `rowId` for `instanceId`.
  - If all of S are currently selected, deselect S (no effect on other rows).
  - Otherwise, replace current selection with S and do not modify the reference (segment clicks never change the reference).
- Cmd/Ctrl click:
  - Toggle the membership of S without clearing other rows; do not modify the reference (segment clicks never change the reference).
- Shift click:
  - Cross-row: treat as plain click (no multi-row range required).
  - Same row: optionally support range selection using row-local ordering between the current reference anchor and the clicked segment. The range set is the union of foreground keypoints for all markers/segments in the inclusive range. With Cmd/Ctrl+Shift, extend rather than replace. If not implemented immediately, route to plain click for MVP.

Store and helpers:
- Add `extractSegmentKeypoints(row: ComputedRowData, instanceId: string, segmentId: string, foregroundOnly = true): KeypointAddress[]` that returns all row-foreground keypoints for the active instance (note: per spec, the unit here is the entire row’s foreground keys, not just the segment span).
- Add `collectRangeKeypointsByAnchor(row: ComputedRowData, instanceId: string, a: { markerId?: string }, b: { markerId?: string }): KeypointAddress[]` to support segment/marker mixed anchors by resolving to the nearest marker indices.
- Keep `SelectionAnchor` marker-only; segment clicks must not adjust or set the reference. Maintain signature cohesion with `clickMarker`, but do not set reference within `clickLine`.

Renderer wiring:
- Update `TransitionSegment` to dispatch `clickLineAction` with `{ rowId, segmentId, shift, mod }` (store patch style) instead of logging.
- Ensure segment clicks are disabled for non-foreground/non-selectable rows, and that global/timeline rows emit points only for the active instance.

Tests:
- Add `line-click-selection.test.ts` covering:
  - Plain click row-toggle (select all foreground; second click deselects row).
  - Cmd/Ctrl toggle across multiple rows.
  - Cross-row Shift behaves as plain click.
  - Same-row Shift range (if implemented) unions markers/segments inclusively.
  - Global row filtering to active instance.
- Extend visual selection tests to assert foreground-only propagation for group/global rows.

Documentation updates:
- `selection.md` now describes transition segment clicks (row-level toggling, instance scoping, modifier behaviour). Keep segment and marker semantics aligned wherever possible.
- Note optional same-row Shift range for segments as an enhancement; core requirement is row-level toggle on plain/mod clicks.

Migration checklist additions:
- [x] Implement `clickLine` action with replace/toggle rules above.
- [~] Add `extractSegmentKeypoints` and (optionally) `collectRangeKeypointsByAnchor`. Note: functionality implemented inline as `collectRowForegroundKeypoints` within `clickLineAction`; promote to a shared helper if needed elsewhere.
- [x] Wire `TransitionSegment` onClick to `clickLine`.
- [ ] Complete derived view helpers (`isMarkerSelected`, `isRowReferenced`) to reflect row/foreground rules.
- [~] Add tests listed above and ensure global-row instance filtering is enforced in extractors.
  - Added `line-click-selection.test.ts` covering row-wide toggle, Cmd/Ctrl toggling across rows, cross-row Shift behaves like a plain click, and instance inference for `selectionState.instanceId`; a dedicated global-row filtering test is still pending.
