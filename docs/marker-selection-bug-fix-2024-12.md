# Marker Selection Bug Fix - December 2024

## Issue Description

A bug was reported where the last clicked marker in a multi-select operation could not be re-selected after being dragged and deselected. This issue specifically affected the user workflow when:

1. Multiple markers were selected (e.g., via shift-click range selection)
2. The selected markers were dragged to new positions
3. The selection was cleared (clicking empty space)
4. Attempting to click the marker that was "last" in the original selection failed to select it

## Root Cause Analysis

The bug was caused by a frame comparison mismatch in the `DataPoint` component's selection detection after drag operations:

### The Problem Flow

1. **Component Props**: Each `DataPoint` receives a `data` prop containing frame info at render time
2. **After Drag**: When markers are dragged, the actual keypoints in the store are updated with new timestamps
3. **Stale Reference**: The `data` prop in the component still references the old position (original stamp)
4. **Comparison Mismatch**: The selection comparison function returns `Incompatible` when stamps differ

### The Real Issue

The issue was in the selection detection logic in `data-point.tsx`:

```typescript
const isSelected = useAnimationStore(
  useShallow((state) => {
    // This was switching between comparison functions
    const compareFunc = state.dragState?.isDragging
      ? compareInstancedFramesIgnoringStamp
      : compareInstancedFrames;
    
    const comparisons = state.selection.map((s) => compareFunc(s, data));
    return comparisons.includes(FrameComparison.Equal) || 
           comparisons.includes(FrameComparison.Superset);
  }),
);
```

The `compareInstancedFrames` function returns `Incompatible` when two frames have different stamps but share common points. After dragging:
- The selection in the store has frames with NEW stamps
- The component's `data` prop still has the OLD stamp
- `compareInstancedFrames(selection, data)` returns `Incompatible`
- The marker appears unselected even though it's actually in the selection
- Clicking the "unselected" marker fails because the selection logic gets confused

## The Fix

### Implementation

The fix was simple but crucial - always use stamp-ignoring comparison for selection detection:

```typescript
const isSelected = useAnimationStore(
  useShallow((state) => {
    // Always use stamp-ignoring comparison for robustness
    // This handles cases where the component's data prop has stale stamps after drag
    const compareFunc = compareInstancedFramesIgnoringStamp;
    
    const comparisons = state.selection.map((s) => compareFunc(s, data));
    return comparisons.includes(FrameComparison.Equal) || 
           comparisons.includes(FrameComparison.Superset);
  }),
);
```

Additionally, the click handler was improved to use point IDs as stable identifiers:

```typescript
// Use the point IDs as stable identifiers, not the frame
const pointIds = data.points.map((p) => p.id);

// Find frames that contain ANY of our point IDs
const relevantFrames = freshFrames.filter((frame) =>
  frame.points.some((p) => pointIds.includes(p.id)),
);

// Create a frame with only the clicked marker's points
const clickedMarkerFrame = {
  ...currentFrame,
  points: currentFrame.points.filter((p) => pointIds.includes(p.id)),
};
```

### Key Changes

1. **Consistent Comparison**: Always use `compareInstancedFramesIgnoringStamp` for selection detection
2. **Stable Identifiers**: Use point IDs for frame lookup during clicks
3. **Robust Selection**: The marker correctly shows as selected even with stale stamps
4. **Precise Clicking**: Only the clicked marker is selected, not all at the timestamp

## Architecture Decision: Fix Now vs Later

### Decision: Fix in Phase 1 (Now)

The fix was implemented immediately in Phase 1 rather than waiting for the Phase 2+ architectural changes that will move computed state to the store.

### Rationale

1. **Straightforward Fix**: The solution is localized to the DataPoint component's comparison logic
2. **User Impact**: This is a user-facing bug affecting daily workflow - fixing it immediately improves UX
3. **Testing Foundation**: Fixing now allows us to establish test coverage before major refactoring
4. **Root Cause**: The issue is about stale prop data vs fresh store state - a React rendering concern
5. **No Conflict**: The fix won't interfere with planned Phase 2+ architectural improvements

### Alternative Considered

Waiting for Phase 2+ (moving computed state to store) was considered but rejected because:
- The architectural change wouldn't automatically fix this specific issue
- Users would continue experiencing the bug for an extended period
- The fix would be more complex to test after architectural changes
- No guarantee the refactor would address this edge case

## Testing

### Test Coverage

The fix is covered by multiple test suites:

1. **`last-marker-selection-issue.test.ts`**: Specifically tests the reported bug scenario
2. **`marker-selection-after-drag.test.ts`**: Tests selection behavior after drag operations
3. **`click-after-drag.test.ts`**: Tests that selection is maintained properly

### Key Test Scenarios

- ✅ Selecting individual markers after multi-select drag
- ✅ Handling multiple markers at the same timestamp
- ✅ Range selection after drag operations
- ✅ Toggle selection (Ctrl/Cmd-click) after drag
- ✅ Selection persistence through drag operations
- ✅ Preventing spurious clicks after drag

### Manual Testing Checklist

1. Select multiple markers using shift-click
2. Drag the selection to a new position
3. Click empty space to deselect
4. Click each previously selected marker individually - all should be selectable
5. Test with markers that merge at the same timestamp
6. Test with markers from different tracks

## Performance Impact

The fix has minimal performance impact:
- `compareInstancedFramesIgnoringStamp` is actually simpler than the stamp-checking version
- Point ID lookups remain O(n) where n is the number of frames
- No additional state or re-renders introduced
- Selection detection is more consistent and predictable

## Related Issues

This fix also addresses:
- Selection of merged markers at the same timestamp
- Stability of selection after drag operations
- Consistency of marker identification across drag workflows

## Future Considerations

When implementing Phase 2+ (computed state in store):
1. Ensure point IDs remain the stable identifier for markers
2. Maintain the filtering logic to prevent selecting all markers at a timestamp
3. Consider adding visual indicators for which specific marker will be selected in merged frames
4. Keep test coverage to prevent regression

## Conclusion

The fix successfully resolves the marker selection bug by ensuring consistent stamp-ignoring comparison for selection detection, combined with using point IDs as stable identifiers for click handling. This approach correctly handles the case where React component props contain stale stamp values while the store has updated values. The solution is robust, maintainable, and compatible with future architectural improvements. The immediate implementation provides instant value to users while establishing a solid foundation for future development.