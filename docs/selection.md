# Key Selection

In this document, we outline the expected behavior for the selection of keys within the animation-editor, as well as the expected visuals that should accompany selection.

### Relevant types/files
- `SourceRow`, `SourceGroup`, `SourceTrack`, and `SourceRowData`: [source.ts](src/types/util/source.ts)
- `InstancedFrameInfo`: [instanced-frame-info.ts](src/types/util/instanced-frame-info.ts)
- `Namespace`: [namespace.ts](src/types/data/namespace.ts)
- `Animation`: [animation.ts](src/types/data/animation.ts)
- `Track`: [track.ts](src/types/data/track.ts)
- `Keypoint`: [keypoint.ts](src/types/data/keypoint.ts)
- `DataPoint`: [data-point.tsx](src/components/canvas-sheet/data-point.tsx)
- `computeConsolidatedSourceRow`: [compute-consolidated-source-row.ts](src/functions/compute-consolidated-source-row.ts)

## General notes
Selection has a specific meaning in this context, since there is a distinction between `SourceRow` types and `Track` data. With animation instances, it is possible for an animation (with its component tracks) to be rendered multiple times across different separate rows in the UI. It is derived from a hierarchical data structure of `SourceGroup` and `SourceTrack` elements, such that each parent group is rendered above all the children in the list. Each `SourceRow` element contains within it the `SourceRowData` that it contains, which is aggregated from its children. Thus, a `SourceRow` derived from a `SourceGroup` element would contain data from all the children `SourceTrack` elements (only `SourceTrack` data technically contribute data). When rendering a `SourceRow`, the computed `InstancedFrameInfo` (derived from animations' `keypoints`) are translated into markers. Thus, each row can render multiple `InstancedFrameInfo` data as markers, and each marker can represent data from one or more animation `Track` entries.

What this source information means, however is that there is an interaction between the concepts of _rows_, _tracks_, and _animation instances_. Generally speaking, rows are the visual way that users perceive the [possibly hierarchical] organization of tracks. If a marker is clicked within a row, it isn't something in the _row_ that is selected, but rather a pointer to the keypoint data of an individual animation's track[s], conditioned on the animation instance. This matters for cases like the timeline (the `global` row) or rows derived from groups generally, since these rows effectively aggregate the information of their children (according to the `SourceRowData`). If a given marker within that row contains an `InstancedFrameInfo` entry with only a single marker in it, and that marker is selected, it doesn't matter whether it is in the row that was actually clicked. As long as an `InstancedFrameInfo` _only_ contains information from selected markers, it is _visualized_ as selected. If a group-derived marker whose `InstancedFrameInfo` mixes selected _and_ unselected markers, we use the unselected visuals. As a further clarification, however, the check to see whether an indivdiual group-derived marker is visualized as selected only considers data in the foreground for this check (see `SourceRowInfo`). As such, if the only foreground data marker in the point is selected, but there are unselected data _not_ in the foreground, it would be visualized as selected. Similarly, data marked as not being `selectable` are not added to the selection.

The only case where a given `SourceRow` can contain entries that span `AnimationInstances` is in the `global` or timeline row. In this case, selection is filtered by `selectionState.instanceId`, such that any elements not in that instance are non-interactive. Thus, selection can only happen on rows with data spanning single animation instances, or in the global row within the current selected instance.

## Single Click

When clicking a marker without any modifier keys, that marker should be considered "selected". If a marker is already selected, this replaces the current selection. Since only one animation instance can be marked as active at a given time (see `selectionState.instanceId`, which identifies the animation instance whose keypoints are currently selectable), clicking on a marker from an animation instance other than the current one sets `selectionState.instanceId` to the instance corresponding to the newly clicked marker. This also sets the clicked marker to being the "reference" marker, in the event that the user goes on to do a multi-select operation. Off-clicking in the canvas editor (any space other than a marker) deselects the current marker and removes it as a reference, but does not change `selectionState.instanceId`. Additionally, it should be noted that selecting a marker within a `SourceRow` derived from a group with multiple children tracks effectively selects all keypoints specified within the `InstancedFrameInfo`. For transition segments, a plain click behaves analogously but operates on the set of foreground keypoints in the row (regardless of segment span) (see “Transition Segment (Row) Click”).

- Question: For the “replace current selection” step, should we clear `selectionState.pathSet` entirely before re-adding the clicked marker paths, or preserve other paths that belong to the same `InstancedFrameInfo`? Answer: This specification is only considering the expected behavior and conceptualization of the selection state, given the data structures for things like `SourceRowData`, `InstancedFrameInfo`, and `Keypoint`. It is explicitly not considering in this portion of the document how the selection state is formalized as a data structure, since that may have to change from its current version in order to produce this specified behavior.

## Transition Segment (Row) Click

Clicking a transition segment within a row acts on all foreground keypoints in that row (not just the segment’s span). The selection rules are:
- If none or only a subset of the segment’s foreground keypoints are currently selected, the click selects all of the segment’s foreground keypoints in that row.
- If all of the segment’s foreground keypoints are already selected, the click deselects the entire row segment (removes those keypoints from the selection).

Row-scoping and instances:
- A transition-segment click cannot select across animation instances. If a row contains mixed instances (e.g., the global row), only keypoints belonging to the current `selectionState.instanceId` are considered/selectable.
- If the current reference marker is in a different row, a plain click on a segment acts as a fresh single click (replaces selection with the segment’s foreground keypoints and sets the new reference in that row).
- Holding Cmd/Ctrl while clicking a segment in a different row toggles that segment’s foreground keypoints according to the rules above without clearing existing selection, and does not change the reference marker.

Shift behavior:
- Shift-clicking transition segments behaves like a plain click. There is no special range behavior for segments.
- Optionally, we may later support selecting all rows between the reference row and the clicked row if that becomes trivial to implement, but it is not required.

Action shape:
- Introduce a dedicated action, e.g. `clickLine({ rowId, segmentId, shift?, mod? })`, with semantics mirroring `clickMarker` where possible. It should:
  - Resolve the set of foreground `{trackId, keypointId}` pairs for the row within the active instance.
  - Apply the same replace/toggle/range rules as marker selection.
  - Do not modify the selection reference on segment clicks; preserve the prior reference marker from the previous row.

## Shift-click

If there is a reference marker present, and the user clicks on another marker within the same _row_ while holding shift, it is possible to extend the selection to include the new marker and any markers in between. Note, shift-clicking only works within individual _rows_, and attempting to shift-click across rows simply results in the marker in the newly clicked row becoming the current singluar selection (as if single-clicked). The question of whether a row is the same row is a question of comparing the ids of the `SourceRow`, since these should be unique. Notably, shift-clicking does _NOT_ reset the reference marker to the clicked marker. Therefore, if another marker is selected the new row selection is recomputed relative to the original reference. The other takeaway from this is that reference markers are _row-specific_. If the user selects a marker in a row, and that marker is also present in the timeline/global row (and would be visualized as selected according to the rules above), trying to extend the selection from the timeline would not work, since the reference marker is in a separate row. Since data markers marked as not selectable, or not editable or not in the foreground are generally rendered with interactive elements, they should not effect the state of the selection. However, as stated elsewhere, the rules preventing editing and managing selection should also be enforced in the backend.

Shift-clicking does **not** clear selections that were previously accumulated in other rows or via modifier clicks. Any keypoints that are already selected outside the active row remain in the selection set until they are explicitly toggled off or cleared.

## MOD/CMD-Click

With mod/cmd-click, it is possible to extend the current selection across rows, or in separate regions within rows. This applies to both marker clicks and transition-segment (row) clicks. Like with shift-click, this extension only works _within_ the current `selectionState.instanceId`, and attempting to mod/cmd-click a marker/segment in a row other than the current `selectionState.instanceId` functions as a simple click. If valid, marker clicks reset the reference to the clicked marker; segment clicks do not modify the reference. Shift-clicking or mod/cmd-clicking after this point can continue in a chain until either an invalid selection is performed (e.g. outside the current `selectionState.instanceId`) or a non-interactive area is clicked, thereby allowing large selections of disjoint regions to be created. If a marker or segment currently in the selection is mod/cmd-clicked, it acts as a toggle that deselects/reselects the corresponding keypoints (for segments: all foreground keypoints in the row).

## Visuals

When a marker is "selected", it adopts a different visual than a deselected one. Selection state can come in two different variants, namely if it is a "reference" marker or just selected. Full details on this visual difference is provided in the implementation of the `DataPoint`, but generally selection results in an outline (light/dark depending on current theme) around the colored marker, while references invert this pattern, putting the color in the outline and the light/dark color as the marker color. Generally, the `selectable` flag, along with the `foreground` and `editable` flags, when negative, result in the element being rendered with a non-interactive visual (vertical line only). If the data contains mixed values, these are separated out visually, but rules should also be enforced in the API.

## On Row IDs

For row ids, we need unique ids, even when individual tracks may appear multiple times when present in multiple animation instances. We do this by constructing unique paths/addresses that reflect this hierarchy, and use a standard pattern for describing the different levels, with different delimiters indicating semantic and effective differences. The first portion of this path/address is separated by `/` elements:

`{namespaceId}/{instanceId}/`

This portion allows us to characterize each row according to both the namespace it is in, as well as the specific animation instance. The next portion of the path/address reflects the structure of individual groups and tracks within. For now, we only allow two possible levels of nesting (with complex datatypes in tracks producing `SourceGroup` and `SourceTrack` entries). In the future, we will allow arbitrary nesting and organization while removing complex datatypes, simplifying the relationship. Until then, if a `Track` is a simple type, the address would look like

`{namespaceId}/{instanceId}/{trackId}`

For complex datatypes, the top-level path `{namespaceId}/{instanceId}/{trackId}` would correspond to the `SourceGroup`, while individual sub-paths `{namespaceId}/{instanceId}/{trackId}.{attribute}` refer to `SourceTracks` with attribute flags. Note that the `trackId` is effectively the `groupId` here.

Again, in the future, we will simplify the group and complex datatype relationship, such that `SourceTracks` only point to simple data, and there is no `attribute` flag. In this case, it will be possible to arbitrarily nest groups, such that paths such as `{namespaceId}/{instanceId}/{groupId}.{attribute}.{subattribute}.{subsubattribute}` are possible, such that the `subsubattribute` points to a single `Track`, while the `groupId`, `attribute`, and `subattribute` all correspond to `SourceGroup` elements.


# Working Space
- **Spec Alignment**
  - `basic-selection.test.ts` exercises single-click replacement, instance switching, and grouped-track selection, matching the behaviors defined in the *Single Click* section.
  - `modifier-selection.test.ts` covers Ctrl/Cmd toggling, row-scoped Shift ranges, and combined modifiers, aligning with the *Shift-click* and *MOD/CMD-Click* rules.
  - `global-track-selection.test.ts` verifies bidirectional syncing between global and track markers and ensures selections remain bound to the active animation instance as described in *General notes*.
  - `visual-selection.test.ts` enforces the rule that markers only appear selected when all selectable points are selected, consistent with the mixed-data guidance in *General notes*.

- **Coverage Gaps**
  - No test asserts that `foreground` data alone drives the visual-selected state, leaving the “foreground-only check” note unverified.
  - Non-interactive flags beyond `selectable` (`editable`, `foreground` false) are not exercised, so we lack guardrails for the “non-interactive visual” expectations.
  - Modifier tests do not confirm that a valid Cmd/Mod click resets the reference marker, which the *MOD/CMD-Click* section now specifies.
  - Off-click deselection behavior is documented but only indirectly covered through `clearSelection()`; the canvas interaction path is untested.

- **Test Failures (latest run)**
  - `packages/animation/src/tests/selection/click-marker-action.test.ts:132` reports six selected paths after Ctrl/Cmd extension where the spec expects three, implying selection units include duplicate surfaces (global + track) that the doc treats as a single conceptual marker.
  - `packages/animation/src/tests/selection/click-marker-action.test.ts:165` shows Ctrl/Cmd selection clearing the range instead of expanding it, so the implementation behaves like single-select contrary to the multi-select expectations.
  - `packages/animation/src/tests/selection/click-marker-action.test.ts:187`, `packages/animation/src/tests/selection/global-track-selection.test.ts:167`, and `packages/animation/src/tests/selection/modifier-selection.test.ts:340` all fail to locate position/vector markers (`px*`), indicating computed row data is missing the grouped track points that the spec assumes are available.
  - `packages/animation/src/tests/selection/global-track-selection.test.ts:147` reveals a path-format mismatch (`global#id` vs `global/id`), so the spec’s URI-style paths diverge from the selection manager’s actual hash-delimited representation.
  - `packages/animation/src/tests/selection/global-track-selection.test.ts:350` shows global markers not appearing selected when their track counterparts are, meaning the visual propagation guaranteed in *General notes* is not happening.
  - `packages/animation/src/tests/selection/modifier-selection.test.ts:162` and `packages/animation/src/tests/selection/modifier-selection.test.ts:197` demonstrate Cmd/Ctrl clicks failing to retain prior selections, contradicting the toggle semantics described in *MOD/CMD-Click*.
  - `packages/animation/src/tests/selection/modifier-selection.test.ts:304` keeps the old reference marker after a cross-row shift click, while the doc states the reference should relocate when a new row becomes the focus.

- **Proposed Selection State Redesign**
  - Store selection purely as `{ trackId: string; keypointId: string }` pairs scoped to the active instance. Concretely, represent this as `Map<TrackId, Set<KeypointId>>`, and lift instance awareness into the surrounding store (`activeAnimationInstance` already enforces single-instance selection).
  - Track the reference marker separately as `{ rowId: SourceRowId; anchor: { trackId; keypointId }; stamp: number }`, since range selection depends on row-local ordering rather than marker replication across surfaces.
  - Derive view state on demand: when rendering a marker, mark it selected if all of its foreground `InstancedFrameInfo.points` map to selected keypoint pairs; reference styling applies when the marker’s `(rowId, markerId)` matches the stored reference tuple.
  - Event rules under this scheme:
    - **Single click**: resolve the marker to its constituent keypoint pairs, replace the selected map with those pairs, and update the reference descriptor to the clicked row/anchor.
    - **Shift-click**: if the incoming rowId matches the reference rowId, collect all keypoints between the anchor stamp and the clicked stamp (inclusive) and replace or extend selection depending on whether Cmd/Mod is also pressed; if the row differs, treat as a single click per the spec’s row-scoping rule.
    - **Cmd/Mod-click**: toggle membership of the marker’s keypoint pairs within the map and update the reference anchor to the newly clicked row so subsequent Shift ranges originate from the latest explicit click.
    - **Global row clicks**: expand the marker to the subset of keypoint pairs whose instanceId matches `selectionState.instanceId`; this keeps cross-instance data out of the selection set while still lighting up mirrored views.
    - **Canvas off-click**: clear the map and null the reference descriptor while leaving `selectionState.instanceId` untouched, matching the deselect behavior outlined earlier in the doc.

- **Next Steps**
  - Migration is underway: the store, selection helpers, drag flow, and `DataPoint` now use the keypoint-based state. Remaining work includes migrating the selection test suite and any UI surfaces still depending on marker paths.
  - Continue refining the migration checklist in `packages/animation/docs/selection-migration.md`, especially the outstanding helper/component/test updates.
  - Decide whether to recompute the reference stamp lazily (lookup on shift-click) or maintain it reactively when drag operations settle; document the final decision before wiring additional consumers.
