# Implementation Review Notes

This document records implementation-review critiques for the animation render/migration work, focused on clarity, documentation, and organization.

## Documentation drift
Issue: `packages/animation/docs/drag-preview-flow.md` still documents `applyEffectiveTransitions`, `interpolations`, and `trackContextByTrackId`, which no longer exist after the render/selection migration.

Recommended approach: rewrite the affected steps to mirror the current pipeline (`render`, `selection`, `renderSampleCache`, `dragOverlay.draggedTrackIds`) and remove the retired terms. Keep the doc as a high-level, stable map of responsibilities and move per-function details to the design notes (`line-rendering-design.md`, `derived-render-types.md`) so it stays aligned with the separation-of-concerns goals as the implementation evolves. Explicitly call out the timescale/offset effect on interpolators and violation durations to avoid ambiguity about canonical vs render-time transforms.
Status: complete.

## Transform ownership clarity
Issue: `packages/animation/src/components/canvas-sheet/transition-segment.tsx` applies `xTransform` after `materializeSegmentSample`, but `packages/animation/src/functions/materialize-segment-sample.ts` already applies `SegmentSample.transform`. Once non-identity transforms land, this will double-apply.

Recommended approach: define a single transform boundary and enforce it. Preferred for clarity and performance: treat `SegmentSample.transform` as the authoritative instance/view affine and apply it only in `materializeSegmentSample`, then remove `xTransform` from `TransitionSegment` (or ensure it is identity when `SegmentSample.transform` is used). Keep view-scale (`renderScaleY`) as the only per-renderer mapping so sampling remains cache-friendly and transform application is centralized. Document this contract in `render-types.md` and `line-rendering-design.md`, and reuse the same transform policy for markers/handles/violations to prevent drift.
Status: complete.

## Render marker semantics
Issue: `packages/animation/docs/derived-render-types.md` describes `RenderMarker.x/y` as row-space coordinates, but `packages/animation/src/functions/compute-row-data.ts` sets `x = stamp` and `y` to normalized `[-0.5, 0.5]`, and renderers ignore the fields.

Recommended approach: keep derived data view-invariant for separation of concerns. Either remove `x/y` from `RenderMarker` or redefine them as canonical-space values (e.g., `x = stamp`, `y = normalizedValue`) and update the docs accordingly. If row-space coordinates are desired for performance, compute them in `projectRowVerticalAxes` (where view context exists) and update renderers to consume that single source of truth. This keeps view math centralized and avoids inconsistent per-component scaling.
Status: complete.

## Interpolator input semantics
Issue: `packages/animation/src/functions/compute-track-interpolator.ts` converts input time to world time, but the doc does not specify that the input is local.

Recommended approach: rename the parameter or add a clear doc comment that the input is local stamp (0..1 in instance space). If external use cases need world time, add a small wrapper (e.g., `computeTrackInterpolatorWorld`) to keep responsibilities explicit and prevent accidental double transforms. Add or update a test that exercises non-identity timescale/offset to lock in the intended contract.
Status: complete.

## Render update path
Issue: `packages/animation/src/components/canvas-sheet/transition-segment.tsx` updates geometry both imperatively (`setPositions`) and declaratively (`points` prop), which obscures ownership and can do extra work.

Recommended approach: pick one update path. For performance, keep the imperative typed-array path and remove `points` props so the geometry is updated in one place; alternatively, go fully declarative and drop `setPositions`. The imperative path aligns better with the caching goals and avoids per-render allocations, but it should include a short comment declaring it as the single source of truth.
Status: pending.

## Debug noise
Issue: `packages/animation/src/components/canvas-sheet/violation-renderer.tsx` logs violation data on hover.

Recommended approach: remove the log or guard it behind the existing debug pattern (e.g., a global flag similar to `__DEBUG_BEZIER_HANDLES__`). Keeping logs gated preserves clarity in production and avoids unnecessary console overhead while retaining the ability to debug when needed.
Status: pending.
