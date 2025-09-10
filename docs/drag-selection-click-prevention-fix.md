# Drag Selection Click Prevention Fix

## Issue Description

When multiple points across multiple tracks were selected and dragged, releasing the drag would cause only the marker that was dragged to remain selected, losing the multi-selection. This was caused by a click event firing immediately after the drag completion, which would reset the selection to just the clicked marker.

## Root Cause

The issue occurred in the `DataPoint` component where both drag and click events are handled using `useGesture`. After a drag operation completed:

1. The `onDragEnd` handler would correctly call `commitDrag()`, which maintains the multi-selection
2. However, a click event would then fire immediately after
3. The `onClick` handler would call `clickMarker()`, resetting the selection to just that single marker

## Solution

Added a flag to prevent click events from being processed immediately after drag completion:

### Implementation in `packages/animation/src/components/three/canvas-sheet/data-point.tsx`

1. Added a ref to track if drag just finished:
```typescript
const justFinishedDragging = useRef(false);
```

2. Modified the `onClick` handler to check this flag:
```typescript
onClick: ({ event, shiftKey, metaKey }) => {
  if (playing) return;

  // Skip click if we just finished dragging to prevent selection loss
  if (justFinishedDragging.current) {
    justFinishedDragging.current = false;
    return;
  }

  event.stopPropagation();
  // Handle multi-select with shift and cmd/ctrl keys
  clickMarker(data, sources, allData, shiftKey, metaKey || event.ctrlKey);
}
```

3. Set the flag in `onDragEnd` handler:
```typescript
onDragEnd: ({ event, canceled }) => {
  if (playing) return;

  event?.stopPropagation();

  // Set flag to prevent click event after drag
  justFinishedDragging.current = true;
  // Reset flag after a short delay to allow normal clicks again
  setTimeout(() => {
    justFinishedDragging.current = false;
  }, 100);

  if (canceled) {
    // Revert the drag operation
    cancelDrag();
  } else {
    // Commit the drag operation
    commitDrag();
  }
}
```

## Test Coverage

### Fixed Test Issues

1. **Fixed `multi-drag-selection.test.ts`**:
   - Corrected undefined variable reference in convergence test
   - Fixed boundary conditions test to check actual dragged positions

2. **Fixed `simple-drag-debug.test.ts`**:
   - Updated to use correct API pattern with `produce` and `draft`
   - Fixed state management to use proper Immer patterns

### New Test Coverage

Created `click-after-drag.test.ts` to verify:
- Multi-selection is maintained after drag completion
- Click events don't fire immediately after drag
- Normal click selection works after the timeout period
- Rapid successive drags maintain selection
- Reference markers are preserved after drag
- Edge cases with single marker selection

## Related Actions

The `commitDrag` action in `packages/animation/src/actions/drag/commit-drag.ts` already correctly maintains selection by:

1. Storing IDs of all selected keypoints before updating
2. Applying drag offsets to all dragged keypoints
3. Rebuilding selection to include all frames containing previously selected points
4. Updating reference marker if it was selected

## Impact

- **Before Fix**: Multi-selection would be lost after dragging, with only the clicked/dragged marker remaining selected
- **After Fix**: All selected markers remain selected after drag completion
- **User Experience**: Smoother workflow when working with multiple keyframes, no need to re-select after each drag operation

## Testing Verification

All drag-related tests pass:
- ✓ Multi-drag selection persistence tests
- ✓ Click after drag prevention tests
- ✓ Drag merge selection behavior tests
- ✓ Reference marker persistence tests
- ✓ Edge case handling tests

## Future Considerations

1. The 100ms timeout is hardcoded - could be made configurable if needed
2. The pattern could be extracted into a reusable hook if other components need similar behavior
3. Consider adding visual feedback during the protection period if users report confusion