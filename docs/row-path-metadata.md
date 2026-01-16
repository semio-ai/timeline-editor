# Source Tree Layout (Draft)

This note records a proposed adjustment to how the animation editor expresses row layout
without overloading storage keys. The Source hierarchy remains the single layout schema,
while SourceRow remains the flattened UI output derived from that hierarchy.

For now, focus on the default layout that matches current behavior. Overlay/interleave
layouts are future options and should not affect the initial migration.

## Background: Complex Animatables Are Flattened

The editor is moving away from complex animatable values (e.g. `Vector3`) and instead
normalizes them into separate simple animatables (`position.x`, `position.y`, `position.z`).
This is already done when loading legacy data and will become the default.

Implications:

- Each leaf track row is paired to a single animatable (number/string/boolean).
- Groups (e.g. Position → X/Y/Z) are organizational only and can be rearranged.
- Row layout should be driven by the Source hierarchy, not by key paths.

## Key Path vs. Row Path

- Key path: storage/bridge addressing (e.g. `entity/channel/animatable.component`).
- Row path: UI grouping/ordering derived from the Source tree.
- Value key (internal): per-track lookup used by the animation package; distinct from storage keys.

These must remain distinct so keys can reflect target/feedback/sim while rows can
interleave or overlay channels without changing storage semantics.

## Proposed Change: Explicit Channel + Layout Hints

Use an explicit channel label on Source tracks and a layout hint on Source groups.
The channel label identifies sibling tracks (target/feedback/sim), while the group
layout controls how those siblings are flattened into rows.

### Interface Updates (annotated)

```ts
export type SourceChannel = string;
```

```ts
interface SourceBase {
  animationId: string;
  namespaceId: string;
  instanceId: string;
  readonly?: boolean;
}
```

```ts
export interface SourceTrack extends SourceBase {
  id: string;
  trackId: string;
  animatableId: string;
  type: "string" | "number" | "boolean";
  hidden: boolean;
  muted: boolean;
  iconCode?: string;

  // NEW: identifies which channel this track belongs to (target/feedback/sim).
  channel?: SourceChannel;
}
```

```ts
export interface SourceGroup extends SourceBase {
  id: string;
  groupId: string;
  name: string;
  type: "vector3" | "vector2" | "euler" | "rgb" | "hsl" | "group";
  expanded: boolean;
  iconCode?: string;
  children: Source[];

  // NEW: controls how child sources are flattened into rows.
  // - "nested": current behavior (group row + child rows)
  // - "interleave": emit child rows in order (useful for target/feedback adjacency)
  // - "overlay": merge child tracks into one row (useful for superimposed render)
  layout?: "nested" | "interleave" | "overlay";
}
```

`SourceRow` remains unchanged; the layout behavior is encoded in the Source tree itself.
`channel` is optional and only used when multiple sibling tracks need pairing.

## Row Construction Behavior (derived)

Row flattening (`computeSourceRowsFromSources`) should interpret `SourceGroup.layout`:

- `nested` (default/undefined): keep current behavior.
- `interleave`: emit one row per child in the declared order (can be ordered by `channel`).
- `overlay`: emit a single row containing multiple `SourceRowData` entries.

This keeps the animation package generic: it does not interpret channel semantics, it only
uses the label to keep sibling ordering stable when requested.

## Example: Target + Feedback Pairing

Source tree (conceptual):

```
EntityGroup (ur5_0)
  └─ AnimatableGroup (position)
       ├─ Track (position.x, channel="target")
       └─ Track (position.x, channel="feedback")
```

Set `layout: "overlay"` to render target/feedback on one row, or `layout: "interleave"` to
render them as adjacent rows. Leaf tracks remain one animatable each.

## Studio Integration Notes

Studio should build the Source tree to encode desired layout while keeping key paths
stable for storage/bridge. The animation editor simply respects the Source hierarchy
and layout hints—no Studio-specific logic is required inside the package.

## Default Layout (Current Behavior)

The current editor layout corresponds to `layout: "nested"` everywhere:

- Each SourceTrack becomes its own leaf row.
- Group nodes create a group row plus child rows.
- Channel labels are optional and unused unless multiple channel tracks are created.

This should remain the default during migration; channel pairing can be introduced later
without changing the default row order.

## Track-Keyed State.values (Proposed)

`state.values`, `state.velocities`, and `state.trackInterpolators` should be keyed by a
track value key rather than an animatable key. This keeps the animation package aligned
with its primary unit of work (tracks) and avoids forcing a single animatable view
inside the package.

### Value Key Format (internal)

Use the track key shape, not the animatable key:

```
{namespaceId}/{instanceId}/{trackId}
```

`namespaceId` should remain `{entity}/{channel}` for storage alignment, while
`instanceId` is the animation instance id. `trackId` alone is not unique across
instances, so the full track key is required.

This key is internal to the animation package; it is not the storage or bridge key.

### Consumer Remap to Animatable Values (Studio or other library)

Consumers can derive a single animatable view by projecting track-keyed values into
`{namespaceId}/{animatableId}` keys. This remap happens outside `@semio/animation`.

Recommended projection steps:

1) Build a lookup from `trackId` to `animatableId` (via `tracks` or `SourceRowData`).
2) For each entry in `values`:
   - Parse `{namespaceId}/{instanceId}/{trackId}`.
   - Map to `{namespaceId}/{animatableId}` using the lookup.
   - Apply a conflict policy when multiple tracks target the same animatable.

Conflict policies (choose one and document it in Studio):

- Priority order (target > feedback > sim).
- Last-write-wins (stable ordering by channel or track metadata).
- Track-tag weighting (explicit numeric priority).
- Aggregation for numbers only (average/median) when overlays should blend.

This change can be introduced without changing row layout, because rows are derived
from Source trees, not from value keys.

### Migration Steps (Studio deferred)

1) Animation package: write `values`/`velocities`/`trackInterpolators` using track keys.
2) Animation package UI: read values by track key (not animatable key).
3) Studio (or another library): build and maintain an animatable projection map using
   the chosen conflict policy.

### Current Implementation Note

- The animation package now keys `values`/`velocities`/`trackInterpolators` by
  `${namespaceId}/${instanceId}/${trackId}` using `buildTrackKey`.
- `SourceGroup.layout` and `SourceTrack.channel` are typed and documented, but row
  flattening still uses the current nested behavior; future interleave/overlay logic
  should be implemented in `computeSourceRowsFromSources`.
- Tests that assert `state.values` should be updated to the new track-keyed map once
  the implementation lands.

## Examples: Key Paths vs. Row Paths

These examples assume key paths follow the draft key format for flattened animatables:

```
{entity}/{channel}/{animatable}
```

Note: complex animatables are normalized into leaf animatables (e.g. `position.x`), so the
dot belongs to the animatable id itself; there is no separate component segment.

Row paths are derived from the Source tree (group nesting). The animation editor does not
compute row paths from key paths.

### Example A: Overlay target + feedback on one row

Source tree (conceptual):

```
EntityGroup: ur5_0
  AnimatableGroup: position.x (layout="overlay")
    Track: position.x (channel="target")
    Track: position.x (channel="feedback")
```

Key paths:

```
ur5_0/target/position.x
ur5_0/feedback/position.x
```

Row path (derived from group nesting):

```
ur5_0 > position.x
```

Rendered rows:

```
Row "position.x" contains two SourceRowData entries (target + feedback overlay)
```

### Example B: Interleave target + feedback as adjacent rows

Source tree (conceptual):

```
EntityGroup: ur5_0
  AnimatableGroup: position.x (layout="interleave")
    Track: position.x (channel="target")
    Track: position.x (channel="feedback")
```

Key paths:

```
ur5_0/target/position.x
ur5_0/feedback/position.x
```

Row paths (derived from group nesting, ordered by channel):

```
ur5_0 > position.x > target
ur5_0 > position.x > feedback
```

Rendered rows:

```
Row "position.x (target)" then row "position.x (feedback)"
```

### Example C: Flattened Vector3 with target/feedback

Source tree (conceptual):

```
EntityGroup: ur5_0
  AnimatableGroup: position (layout="interleave")
    AnimatableGroup: position.x (layout="overlay")
      Track: position.x (channel="target")
      Track: position.x (channel="feedback")
    AnimatableGroup: position.y (layout="overlay")
      Track: position.y (channel="target")
      Track: position.y (channel="feedback")
    AnimatableGroup: position.z (layout="overlay")
      Track: position.z (channel="target")
      Track: position.z (channel="feedback")
```

Key paths:

```
ur5_0/target/position.x
ur5_0/feedback/position.x
ur5_0/target/position.y
ur5_0/feedback/position.y
ur5_0/target/position.z
ur5_0/feedback/position.z
```

Row paths (derived from group nesting):

```
ur5_0 > position > position.x
ur5_0 > position > position.y
ur5_0 > position > position.z
```

Rendered rows:

```
Each axis row overlays target + feedback, and the axes are interleaved under "position"
```
