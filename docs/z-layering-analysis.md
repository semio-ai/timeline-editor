# Canvas Sheet Layering Analysis

This note captures the current layering behaviour in the canvas sheet, the reasons we see spline rows self-occluding, and a few directions for stabilising z-index management across render modes.

## Foreground Flag

`SourceRowData.foreground` (packages/animation/src/types/util/source.ts:75) is set to `true` in all `instancedTrackSources` rows. Nothing at render time inspects it any more, so the flag no longer distinguishes foreground vs background content. Any layering logic needs to rely on explicit z offsets or `renderOrder`. To solve this we now stamp a `layerBand` per `SourceRowData` entry in the store subscriptions, making the fore/background (and selection) distinction explicit.

## Active Z Constants

`Z` in packages/animation/src/constants.ts pins broad layers: data sits near 0, violations at −300, ticks −600, backgrounds −500. Most canvas components honour this by putting background meshes at `Z.Background` and letting data live at small positive numbers (0–10). Because tracks currently choose their own offsets inside that narrow band, cross-component layering is inconsistent.

## Why Spline Rows Occlude Each Other

In `TracksRenderer` (packages/animation/src/components/canvas-sheet/tracks-renderer.tsx:176) we map over `sourceRowIds`. For spline mode every row renders with:

* `yOffset = 0`
* `zOffset` unset (commented out)

Each `DataRenderer` therefore positions its instanced hexagons and lines in exactly the same plane. Because depth testing is still enabled, the first row drawn writes depth for any pixel that the following rows want to use. The subsequent rows fail the depth test and disappear behind the earlier row, even when they belong to the active animation.

## Row-Local Layering

Inside a single row:

* Each `DataPoint` uses z values of 10 (hexagon), 2 (background), and 1 (line).
* `TransitionSegment` draws a fill at z = 1 and a line at z = 0 or 2 depending on `isEmpty`.
* `ViolationRenderer` drops down to `Z.Violations` (−300) while ticks/backdrops use `Z.Ticks`/`Z.Background`.

Because rows are not spaced apart on z, the 0–10 range overlaps across rows. `isEmpty` segments sitting at z = 0 can end up behind another row’s line at z = 1 but in front of that row’s background, producing inconsistent overlaps.

## De-Emphasis Filters

Row de-emphasis mixes multiple mechanisms today:

* Colour mixing inside each `DataPoint` (active vs inactive instance) – lots of per-point work.
* Track-level background planes (`FrustumBackground`) for non-spline renders (none for spline).
* Spline mode has no shared overlay, so inactive rows still paint in the same z band.

Moving to coarse filter planes (inactive animation overlay, non-selected overlay) would simplify row colour logic but requires reliable per-group z separation to avoid z fighting.

## Strategy Evaluation

### Track-Level Z Bands

* **Fit:** High. Our meshes already respect relative offsets (DataPoint 0–10, backgrounds at `Z.Background`). Giving every row a dedicated base z (e.g., `baseZ = -idx * 50`) isolates those offsets. The Two-way binding (y offset and z offset) is controlled from `TracksRenderer`, so we can wrap `DataRenderer` with a `group` whose `position.z` equals that base.
* **Targeted problems:** Fixes spline occlusion immediately (rows no longer share depth). Prevents cross-row bleed from `TransitionSegment` fill vs `Line`.
* **Cost:** Low-medium. Needs a helper to compute baseZ and apply it consistently to the main `group` and any overlay companions such as `FrustumBackground`. Because depth-range per row remains small, single-row elements can keep existing z values, avoiding widescale rewrites.

### Render Order Sequencing

* **Fit:** Medium. React-three-fiber lets us disable depth testing (`depthTest={false}`) and set `renderOrder`. If we collapse every in-row mesh to `z=0`, we must disable depth testing on those meshes; otherwise the first draw writes to the depth buffer and later draws at the same depth are culled despite higher `renderOrder`.
* **Strengths:** Deterministic ordering when depth is disabled; we can codify per-element priorities in a central constant table (`RenderOrder.DataPointFill`, `RenderOrder.TransitionLine`, etc.), mirroring the existing `Z` enum.
* **Limitations:** Requires touching every mesh (including instanced ones) to set both `depthTest={false}` and the shared `renderOrder`. Drei’s `<Instances>` component applies `renderOrder`/`depthTest` to the whole instanced mesh, so we can control per-element ordering but not per-instance ordering. Also, with depth disabled we lose hardware occlusion, so any future 3D embellishments must run in a separate layer.

### Layer Buckets + Filter Planes

* **Fit:** Medium-high for de-emphasis. Instead of per-row colour math, we can render in passes:
  1. Inactive animation rows (with a base z far from active rows).
  2. Apply a single transparent quad above them for dimming.
  3. Render active-but-unselected rows.
  4. Apply another quad for selection dimming.
  5. Render selected rows at the top of the data band.
* **Advantages:** Simplifies colour computations; we can revert DataPoint colour mixing to a direct palette. Planes only need to know the min/max z of the bucket.
* **Complications:** Requires reliable base z spacing to avoid the quads intersecting rows (again pointing to track-level z bands). We also need sort order control to ensure overlays appear above quads but below HUD components—manageable via the `Z` enum if we reserve additional slots.

### Layers (Three.js Layer Masks)

* **Fit:** Low-moderate. Three.js layers can enable/disable rendering per camera. Our setup uses a single orthographic camera for the data region; adding multiple cameras per bucket would complicate `useMotionCanvas`. Using layers alone won't change draw order, so it isn't a standalone solution for occlusion or filtering.

### Depth Bias Utilities

* **Fit:** High as infrastructure. Whether we pick base z bands or render-order numbers, we need a single helper that calculates the per-row offset and exposes constants for row-internal elements. A small `layering.ts` module (e.g., `computeRowDepth(idx, phase)`) keeps these rules coherent and makes future adjustments trivial.

## Recommended Approach

1. **Introduce Per-Row Anchors**
   * Assign each row a tiny dedicated offset (e.g., `baseZ = rowIndex * ε`, with ε ≈ 0.01). This keeps rows distinct for depth testing without consuming large z spans. A helper can hand out `baseZ` and related offsets.
   * Outcome: spline rows no longer occlude, and global overlays (tick marks, bounds) can stay on the existing `Z` constants without needing huge gaps.

2. **Use RenderOrder for Intra-Row Priority (depthTest ON)**
   * Collapse all child meshes in `DataRenderer` to `z = baseZ` (no additional per-element offsets).
   * Keep `depthTest` enabled so rows respect overlay planes and other global geometry.
   * Introduce a central `RenderOrder` map (similar to `Z`) that defines priorities (`DataPointFill`, `DataPointBackplate`, `TransitionLine`, etc.), apply them consistently, and rely on render order—rather than z offsets—to draw fills beneath lines.

3. **Stage Filter Planes via Bucket Rendering**
   * With rows sitting in minimal z bands, we can add per-bucket filter quads between bands (`inactive`, `active-unselected`, `selected`) without risking z fighting. These quads live slightly above the highest `baseZ` in the bucket.
   * Benefits: de-emphasis happens once per bucket, colour calculations simplify, and spline mode can still separate inactive vs active rows.

4. **Compute Layer Bands in Store Subscriptions**
   * Instead of a runtime context, we can stamp the per-point depth band (`foregroundSelected`, `foreground`, `background`) when `instancedTrackSources` are materialised. The subscription already knows `selectionState.instanceId` and can cheaply look up `selectionState.keypoints`, so each `SourceRowData` leaves the store with the correct band baked in.
   * Instanced meshes still apply ±ε offsets relative to the band-specific base (`foregroundZ`, `backgroundZ`) exported from the layering helpers, keeping foreground and background points separated even inside a single frame.
   * The consolidated “global” row becomes trivial: it simply flattens the per-point data (the band info is already there), so the timeline view stays in sync with the individual track rows.
   * Tests can now assert the assignment logic without needing Three.js rendering—just inspect the `SourceRowData` payloads in store unit tests.

5. **Add Layering Utilities**
   * Centralise both base-z assignment and render-order constants in a single module so future components (e.g., halo outlines) integrate easily.

## Next Questions

* What stride (gap between row bands) balances safety and precision? With float32 depth buffers, even 1.0 is usually enough if all row internals stay within ±0.5, but using 10–20 gives breathing room.
* How do we handle the existing `FrustumBackground` offsets? It currently uses global constants (Z.Background). We'll need to translate those into row-relative values while keeping absolute overlays (ticks, playhead) on the global axis.
* Can we cache baseZ per row to avoid recomputation each frame? Yes—store alongside `sourceRowIds` or compute in memoed selectors.

By staging in this order—(1) per-row base z bands, (2) utilities, (3) filter planes/buckets—we progressively solve the occlusion bug, simplify per-point colour logic, and lay groundwork for more sophisticated layering (e.g., depth-of-field effects) without fighting ad-hoc z tweaks.

## Migration Inventory

Below is a concrete checklist for migrating the current codebase to the “flat row + renderOrder” formulation.

### Progress

- ✅ Added layering helpers (`ROW_DEPTH_EPSILON`, `computeRowBaseZ`, `RenderOrder`).
- ✅ `TracksRenderer` now assigns a unique base depth to every row—spline and non-spline alike—so depth testing stays reliable regardless of scroll mode.
- ✅ `DataRenderer`, `DataPoint`, and `TransitionSegment` respect the new base depth. Instanced hexagons still use tiny per-instance offsets (±`ROW_DEPTH_EPSILON` fractions) because drei does not expose per-instance `renderOrder`; the offsets prevent self-occlusion while rows remain effectively flat overall.
- 🔄 Remaining: propagate consistent ordering to ancillary overlays (violations/backgrounds) if needed, introduce bucket-level filter planes, and centralise any future row overlays through the layering utilities.

### 1. Layering Utilities

- Add a new helper module (e.g., `src/constants/layering.ts`) that exports:
  - `ROW_DEPTH_EPSILON` (≈0.01) and `computeRowBaseZ(rowIndex: number)`.
  - A `RenderOrder` enum mirroring the existing `Z` enum, covering every intra-row element (fills, lines, backplates, violations, backgrounds, overlays).
- Update exports (`constants/index.ts` or similar) so components can import from a single place.

### 2. TracksRenderer

- When mapping `sourceRowIds`, compute `baseZ = computeRowBaseZ(idx)` and pass it into `DataRenderer`, `SharedSplineBackground`, and the per-row overlay group.
- Remove the old per-row `zOffset` logic; the main `<group>` for a row should be positioned at `[0, yOffset, baseZ]`.
- Ensure the hover/tick/playhead group still sits on the existing global `Z` plane so HUD overlays remain above data.

### 3. DataRenderer

- Accept a `baseZ` prop and apply it to the outer `<group>`.
- Eliminate ad-hoc `zOffset` values when instantiating `DataPoint`, `TransitionSegment`, `ViolationRenderer`, and `FrustumBackground`.
- For components that still need relative offsets within the row (e.g., highlight halos), compute them by adding tiny deltas to `baseZ` (`baseZ + 0.001`) rather than relying on magic numbers.
- Pass render-order constants down to children (see below).

### 4. DataPoint

- Remove hard-coded z values (`10`, `2`, `1`) in the `<Instance>` and `<Line>` positioning. Instead rely on `renderOrder` constants:
  - `DataPointBackplate` (lowest order)
  - `DataPointFill`
  - `DataPointLine` (highest)
- Set `depthTest={true}` and `depthWrite={true}` on materials (default), and assign `renderOrder={RenderOrder.DataPointFill}` etc.
- Ensure instanced meshes receive the `renderOrder`. Drei’s `<Instances>` exposes a `renderOrder` prop—set it once per instancer.
- Each `SourceRowData` now carries a `layerBand` flag (`background` / `foreground` / `foregroundSelected`), stamped in the store subscriptions. Components resolve band offsets from the shared constants (`LAYER_BAND_OFFSETS`) so instanced meshes and transition segments land in the correct bucket without recomputing selection state at render time.

### 5. TransitionSegment

- Replace `z={1}` / `z={0}` with `renderOrder` constants (`RenderOrder.TransitionFill`, `RenderOrder.TransitionLine`).
- Keep depth testing enabled. If `isEmpty` needs to draw above/below other elements, adjust via render-order instead of toggling z.

### 6. ViolationRenderer / FrustumBackground / SharedSplineBackground

- Transition any explicit z constants (e.g., `Z.Background`) to either:
  - Global overlays that ignore the row (still fine to use `Z`), or
  - Row-relative overlays that adopt `renderOrder`.
- For `FrustumBackground`, position the mesh at `baseZ` and give it a low render-order so data markers render in front.

### 7. Other Canvas Components

- Audit `HoverMarker`, `PlayheadMarker`, `BoundsOverlay`, `TickBackground`, `SharedSplineBackground` to ensure they either:
  - Stay on global layers (using `Z`), or
  - Adopt row-relative render-order values if they should respect per-row stacking.

### 8. Filter Planes

- Implement shared quads for inactive/active-unselected buckets once row base offsets are in place. Each quad gets `renderOrder` set just above the bucket it shades and sits at `baseZ + δ`.

### 9. Store / Selectors (optional enhancements)

- Cache `baseZ` per row if recomputation shows up in profiles (e.g., extend `computedRowData` or create a memoized selector returning both `rowId` and `baseZ`).

### 10. Testing & Validation

- Extend Storybook/Vitest scenarios to cover:
  - Overlapping spline rows with selection toggles.
  - Inactive vs active filter plane interactions.
  - `isEmpty` transition segments stacked with normal segments in the same row.
- Capture before/after screenshots for regression safety.

### Mapping Legacy z Values → RenderOrder

| Legacy Element                              | Old z (relative) | New RenderOrder Placeholder              |
|---------------------------------------------|------------------|------------------------------------------|
| DataPoint foreground hexagon                | 10               | Row base + small positive ε (instanced)  |
| DataPoint backplate hexagon                 | 2                | Row base − small ε (instanced)           |
| DataPoint vertical line                     | 1                | `RenderOrder.DataPointLine` (depthWrite=false) |
| Transition fill                             | 1                | `RenderOrder.TransitionFill`             |
| Transition line                             | 0 or 2           | `RenderOrder.TransitionLine`             |
| Violation markers (row)                     | −300 (`Z`)       | `RenderOrder.RowViolations` (optional)   |
| Row background (FrustumBackground)          | −500 (`Z`)       | `RenderOrder.RowBackdrop`                |
| SharedSplineBackground (spline mode)        | varied           | `RenderOrder.RowBackgroundSpline`        |

Use this table as the seed for the shared `RenderOrder` map. Once the constants are defined, each component can import the relevant entry and assign it to `renderOrder`.
### Layer Bands from Store Subscriptions

* **Fit:** High. Rather than introducing a new runtime context, we can classify each `SourceRowData` when `instancedTrackSources` (or the consolidated row) are produced. The subscription already has access to `selectionState.instanceId` and `selectionState.keypoints`, so it can stamp `layerBand: "foregroundSelected" | "foreground" | "background"` alongside the existing metadata.
* **Advantages:** Rendering stays dumb—components simply read the band and add the predefined offset. It also makes the consolidated/global row trivial because the band travels with the point data, and it enables unit tests that assert layering without Three.js involvement.
* **Considerations:** We still need a deterministic merge rule when a frame mixes categories (highest-priority band wins), and the subscription equalityFn must include the new band so updates propagate correctly. Transition segments reuse the same band resolution.
