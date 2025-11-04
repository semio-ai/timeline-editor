## Drag Marker Debugging Notes

### 2025-02-16 – Attempts around pointer reconstruction
- Restored anchor/delta reconstruction (`anchor + (pointer - pointerStart)`) so threshold drift is removed.
- Added refs to capture the initial pointer coordinate and anchor stamp; kept consistent across `onDrag` and `onDrag2D`.
- Result: behavior still fails—snapping remains offset. Conclusion: drift is not caused by the threshold delta; core issue lies elsewhere.

### 2025-02-16 – Mapping world coordinates to data viewport
- Introduced `mapWorldToTimeline` that converts world-space pointer positions (which include camera padding) into true timeline coordinates via `getDataViewportFromFrustum`.
- Anchor/start refs now store timeline-space values; both horizontal and vertical updates use this mapping before snapping.
- Pending verification: expects marker snapping to align with playhead cart across zoom levels.

### 2025-02-16 – Vertical regression after commit
- While dragging, the preview Y uses the padded spline axis (`verticalAxisByView`), because `DataPoint` passes those bounds into `startDrag` and `applyDragDeltas`.
- `commitDrag` meanwhile rebuilds marker contexts from `computedRowData.verticalBounds`, which are the unpadded values. It substitutes these bounds when computing the persisted value delta.
- The mismatch means the final value is scaled back toward the pre-padding domain, so the curve snaps inward as soon as the drag commits.
- Fix should make `commitDrag` reference the same padded vertical range (or skip the context override) so the committed value matches the previewed drag position.

### 2025-02-16 – Commit uses padded axis
- Updated `commitDrag` to give precedence to the anchor’s `valueScale` domain when determining the vertical range and clamp bounds.
- This keeps the normalization consistent with `startDrag`/`updateDrag`, so the committed value remains exactly where the preview left it.

### 2025-02-16 – Commit reuses preview math
- Refactored `commitDrag` to call `applyDragDeltas` for each selected keypoint, matching the preview logic byte-for-byte.
- Guarantees the persisted results respect the same snapping and clamping applied during drag visualization.

### 2025-02-16 – Preview violations use constraint bounds
- Adjusted the row computation so previewed frames and violation checks use per-track constraint bounds (e.g., opacity 0–1) instead of the broader, padded row range.
- Prevents temporary violation flashes when dragging beyond the visual clamp.

### 2025-02-17 – Curve desync during spline drags
- **Observation**: `DataPoint` switches to the immediate store value while dragging (`packages/animation/src/components/canvas-sheet/data-point.tsx:526`), but `TransitionSegment` keeps reading from motion values that only update after React paints, so the curve lags a frame behind.
- **SSR caveat**: Replacing the effect that syncs motion values with `useLayoutEffect` would emit the usual warning if this hook ran during SSR, because the layout phase cannot execute without a DOM. In practice the canvas sheet only renders on the client (and we can wrap the call in an isomorphic helper that falls back to `useEffect` when `window` is undefined), so this is not a blocker.

#### Option A: useLayoutEffect for motion-value sync
1. Create a local `useIsomorphicLayoutEffect` (e.g., `const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;`).
2. Swap the existing `useEffect` in `useTransitionCurve` with that helper so the motion values (`startY`, `cp1Y`, etc.) update before the next paint (`packages/animation/src/hooks/use-transition-curve.ts:38-49`).
3. Verify that `MotionCubicBezierLine`/`Fill` receive the new numbers immediately and that no warnings appear in the client-only canvas build.

#### Option B: direct geometry path while dragging
1. Extend `useTransitionCurve` (or a sibling hook) to return both the motion values and raw numbers for the control points so we can bypass springs when needed.
2. In `TransitionSegment`, detect `includesDraggedTrack` and hand the raw numbers to a lightweight bezier renderer that sets positions synchronously, similar to the marker (`packages/animation/src/components/canvas-sheet/transition-segment.tsx:147-205`).
3. Keep the existing motion-values path for idle playback so we preserve spring smoothing outside of active drags.

### 2025-02-17 – Row interpolation pipeline still assumes ease curves
- **Status**: The store-driven computation helpers (`packages/animation/src/functions/compute-row-data.ts`, `compute-track-interpolator.ts`, `compute-track-violations.ts`) still rebuild track interpolators with a global `easeInOutCubic` even though tracks now store per-keypoint cubic control points (`packages/animation/src/types/data/keypoint.ts`). Rendering already respects those controls via `compute-transition-params.ts`, so UI curves are accurate but the derived store data (virtual frames, violation previews) diverges.
- **Store vs. render**: `computeRowData` runs inside the subscription pipeline (`packages/animation/src/subscriptions/update-computed-row-data.ts`, wired via `initAnimationSubscriptions` in `packages/animation/src/store.ts`), so the proposed changes live entirely in the derived-data layer. React components that render curves already consume the correct handles and will only benefit from the store handing them consistent data—no renderer changes expected.
- **Proposal**: Rework `computeTrackInterpolator` so each adjacent keypoint pair produces a cubic Bézier segment derived from the keypoint `out`/`in` handles. Use world-space timestamps (current logic already normalizes stamps via `computeWorldStamp`). The interpolator should piecewise-evaluate these cubic splines rather than sampling an ease curve. Numbers can evaluate directly; vector/color values can reuse component-wise Bezier evaluation (Pomax’s `bezierjs` repo documents the basis functions and derivative math).
- **Reference logic**: Rendering already constructs `cp1`/`cp2` by blending the normalized handles into timeline space (`packages/animation/src/functions/compute-transition-params.ts:70-123`). We can mirror that math in the store’s interpolation pipeline so the data backing computed rows matches the canvas output, without changing the React rendering code.
- **Post-change note**: The updated interpolator now translates normalized sample times into instance world time before solving segment parameters (`packages/animation/src/functions/compute-track-interpolator.ts:138-182`). Without that conversion the preview violation pass (which samples in normalized space) diverged from the store’s post-commit results, so this step keeps drag-preview violations and the committed state perfectly aligned.

#### Proposed implementation sketch
1. Precompute a sorted segment list of `{ start, end, cp1, cp2 }`, where control points convert from normalized handle coords into global stamps and values (for numeric tracks) or per-component values (for complex types). This can live beside `computeTransitionParams` or share a helper.
2. Replace the current `piecewise(easeInOutCubic, …)` call with a segment-aware interpreter:
   - Find the segment covering `time`; normalize `u = (time - start.stamp)/(end.stamp - start.stamp)`.
   - Evaluate the cubic using Bernstein polynomials. For multi-dimensional values, evaluate each component.
   - Fall back to clamped start/end values outside the segment span.
3. Cache per-track segment data so violation previews reuse it without recomputing control points for each sample.

#### Violation/velocity checks without dense baking
- Current violations probe the interpolator every ~10 ms (`compute-track-violations.ts:34-83`), which effectively “bakes” the spline. Once segments are true cubics we can improve this by solving each analytic constraint per segment:
  1. For min/max: evaluate the cubic’s component extrema by solving the derivative quadratic; test the resulting parameter values plus endpoints.
  2. For velocity: compute the first derivative analytically (see `compute-derivative-interpolator.ts` and the Bézier derivative formula) and compare magnitudes at extrema instead of finite differences.
  3. For monotonic bounds (e.g., when velocity constraints only apply on numeric tracks), the derivative magnitude can be obtained directly from the cubic’s derivative polynomial, avoiding time slicing.
- These refinements align with the techniques described in Pomax’s Bézier primer (`https://github.com/Pomax/bezierjs`), which provides reference implementations for extrema finding and derivative evaluation.

#### Follow-up considerations
- Update any downstream consumers (e.g., `compute-filled-interp-gaps`) that might assume linear/ease spacing.
- Ensure drag previews reuse the same Bézier math so the virtual frames seen in the UI match persisted violations.
- Store updates (subscriptions in `packages/animation/src/store.ts`, e.g., `initAnimationSubscriptions`) will automatically pick up the refined interpolator once the helper functions change; components consuming store selectors should not require modifications unless they relied on the old ease-only behavior.
