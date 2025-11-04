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
