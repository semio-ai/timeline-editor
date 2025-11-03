## Drag Marker Debugging Notes

### 2025-02-16 – Attempts around pointer reconstruction
- Restored anchor/delta reconstruction (`anchor + (pointer - pointerStart)`) so threshold drift is removed.
- Added refs to capture the initial pointer coordinate and anchor stamp; kept consistent across `onDrag` and `onDrag2D`.
- Result: behavior still fails—snapping remains offset. Conclusion: drift is not caused by the threshold delta; core issue lies elsewhere.

### 2025-02-16 – Mapping world coordinates to data viewport
- Introduced `mapWorldToTimeline` that converts world-space pointer positions (which include camera padding) into true timeline coordinates via `getDataViewportFromFrustum`.
- Anchor/start refs now store timeline-space values; both horizontal and vertical updates use this mapping before snapping.
- Pending verification: expects marker snapping to align with playhead cart across zoom levels.
