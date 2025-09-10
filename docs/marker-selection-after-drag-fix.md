# Marker Selection After Drag Fix

## Problems

There were two related issues with marker selection after dragging:

### Problem 1: All Markers at Same Timestamp Selected
After dragging markers in the timeline, clicking on a single marker would incorrectly select all markers at the same timestamp, rather than just the clicked marker.

### Problem 2: Selection Cleared After Drag
The multi-selection would be lost immediately after completing a drag operation due to a spurious click event firing after the drag ended.

### Combined Symptoms
- User drags one or more markers to a new position
- Multiple markers end up at the same timestamp (either through intentional placement or merging)
- Clicking on one specific marker selects ALL markers at that timestamp
- Multi-selection is lost after dragging completes
- This made it impossible to maintain selection after dragging or select individual markers when multiple markers shared a timestamp

## Root Causes

### Issue 1: Timestamp Collision
The issue was in the `DataPoint` component's `onClick` handler (`data-point.tsx`). After dragging completes, the code would:

1. Compute fresh frames to get the latest data
2. Find the frame matching the clicked marker by checking if any point IDs matched
3. Pass the ENTIRE frame to the selection function

### Issue 2: Click Event After Drag
The `useGesture` library's drag handling would trigger both `onDragEnd` and `onClick` events. The click event would fire immediately after the drag ended, causing the selection to be replaced with just the clicked marker.

```typescript
// The problematic code:
const currentFrame = freshFrames.find((f) =>
  f.points.some((p) => data.points.some((dp) => dp.id === p.id)),
);

// This would pass the entire frame with ALL points at that timestamp
clickMarker(currentFrame, sources, freshFrames, shiftKey, metaKey || event.ctrlKey);
```

When markers were merged at the same timestamp after dragging, `currentFrame` would contain ALL points at that timestamp, not just the points from the clicked marker. This caused the selection system to select all markers at that timestamp.

## Solutions

### Fix 1: Filter Frame Points
The fix filters the frame to only include the points that belong to the clicked marker before passing it to the selection function:

```typescript
// Create a frame with only the clicked marker's points, using the current timestamp
// This prevents selecting all markers at the same timestamp after dragging
const clickedMarkerFrame = {
  ...currentFrame,
  points: currentFrame.points.filter((p) => data.points.some((dp) => dp.id === p.id)),
};

// Handle multi-select with shift and cmd/ctrl keys
clickMarker(clickedMarkerFrame, sources, freshFrames, shiftKey, metaKey || event.ctrlKey);
```

### Fix 2: Prevent Click After Drag
Added a flag to prevent the click handler from executing immediately after a drag operation:

```typescript
// Track if we just finished dragging to prevent immediate click
const justFinishedDragging = useRef<boolean>(false);

// In onClick handler:
if (justFinishedDragging.current) {
  justFinishedDragging.current = false;
  return;
}

// In onDragEnd handler:
justFinishedDragging.current = true;
setTimeout(() => {
  justFinishedDragging.current = false;
}, 100);
```

## Technical Details

### Frame Merging During Drag
When markers are dragged to the same timestamp, they are automatically merged into a single frame object that contains all points at that timestamp. This is the expected behavior for the animation system.

### Selection Granularity
The selection system works at the point level within frames. By filtering the frame to only include the clicked marker's points, we ensure that:
- Only the clicked marker's tracks are selected
- Other markers at the same timestamp remain unaffected
- Multi-select operations (Ctrl/Cmd-click) still work correctly

### Compatibility
These fixes maintain compatibility with all existing selection modes:
- **Simple click**: Selects only the clicked marker
- **Ctrl/Cmd-click**: Adds/removes only the clicked marker from selection
- **Shift-click**: Range selection still works correctly
- **Drag selection**: Multiple markers can still be dragged together
- **Multi-selection persistence**: Selection is maintained after drag operations

## Testing

Comprehensive tests were added to verify both fixes:
- `marker-selection-after-drag.test.ts`: Tests various scenarios where markers share timestamps after dragging
- `click-after-drag.test.ts`: Tests that selection is maintained after drag operations
- Existing selection tests continue to pass, confirming no regression

### Key Test Scenarios
1. Clicking a marker when multiple markers share the same timestamp
2. Multi-select operations with timestamp collisions
3. Range selection across merged markers
4. Toggle selection behavior with merged markers
5. Selection persistence after drag completion
6. Preventing spurious clicks after drag operations

## Related Files

- `packages/animation/src/components/three/canvas-sheet/data-point.tsx` - Contains the fix
- `packages/animation/src/tests/marker-selection-after-drag/marker-selection-after-drag.test.ts` - Tests for the fix
- `packages/animation/src/functions/compute-marker-selection.ts` - Selection computation logic (unchanged)