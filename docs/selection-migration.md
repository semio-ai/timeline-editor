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
- [x] Rebuilt `clickMarkerAction`, modifier toggles, and range handling on top of the new `SelectionState`.
- [x] Removed reliance on path-based mutations; selection changes now read/write the keypoint map.
- [x] Range selection now resolves marker stamps lazily from `computedRowData` (prevents stale references post-drag).

### 4. Update derived selectors and helpers
- [x] Replaced `selection-state-manager.ts` with keypoint-centric helpers (`extractKeypoints`, `collectRangeKeypoints`, etc.).
- [ ] Audit remaining consumers that still depend on marker-path helpers (tests + debugging utilities) and migrate them.

### 5. Migrate renderers and hooks
- [~] `DataPoint` now reads from the new selection structure and uses the refactored click action. Remaining surfaces (row headers, keyboard handlers) still expect path utilities.
- Verify visuals using the helper API (reference markers, partial selection) and delete any fallback logic that expected multiple surfaces to map to identical paths.

### 6. Simplify store shape
- [ ] Drop any leftover path-centric selectors/utilities once tests + tools are updated.
- [x] Removed `activeAnimationInstance` in favour of `selectionState.instanceId`.
- [ ] Clean up deprecated helpers/loggers after the consumer audit.

### 7. Refresh test coverage
- Update selection test fixtures to assert against keypoint ids rather than path strings.
- Add new tests that cover:
  - Modifier behavior (reference updates, toggling)
  - Range selection after marker drag (confirms stamp lookup is live)
  - Global-row filtering (only active instance keypoints selected)
- [ ] Migrate the selection test suite to the new helper conventions (currently still path-based and failing).
- Remove any path-format assertions that no longer apply.

### 8. Documentation and handoff
- [x] Updated `selection.md` with the redesigned model and linked migration notes.
- [ ] Update `docs/README.md` and other docs after tests + remaining components migrate.
- Note any intentional deviations (e.g., if legacy compatibility needs to remain for downstream consumers).

Following these steps will replace the fragile path-based system with an instance/keypoint driven model that better matches the documented behaviour and stays resilient when marker paths change.
