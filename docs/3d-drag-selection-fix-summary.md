# 3D Timeline Drag Selection Fix Implementation

## Problem Statement

When dragging timeline markers in the 3D canvas-based timeline (DataPoint component), two critical issues were occurring:

1. **Visual Selection Loss During Drag**: Selected markers lost their visual selection indicator (color/scale changes) while being dragged
2. **Selection State Loss After Drag**: Markers were no longer selected after the drag operation completed

This created a poor user experience where users couldn't visually track which markers were selected during a drag operation and had to re-select markers after each drag.

## Root Causes Identified

### 1. Frame Comparison Incompatibility During Drag

The core issue was in the `compareInstancedFrames` function which returns `Incompatible` when comparing frames with different stamps but identical point IDs:

```typescript
// In compareInstancedFrames:
if (a.stamp !== b.stamp && intersectionSize > 0) {
  return FrameComparison.Incompatible;
}
```

During dragging:
- The selection array contains frames with original stamps (e.g., 0.1)
- Virtual frames created by `computeVirtualFrames` have dragged stamps (e.g., 0.15)
- The comparison returns `Incompatible` even though they represent the same marker
- The `isSelected` check fails, removing the visual selection indicator

### 2. Selection Not Updated After Drag Commit

The `commitDrag` function was updating keypoint positions in tracks but not updating the selection array with the new positions. This meant:
- After drag completes, selection still has old stamps
- The markers at new positions don't match the selection
- Markers appear unselected after drag

## Solutions Implemented

### 1. Added Stamp-Ignoring Comparison Function

Created `compareInstancedFramesIgnoringStamp` function that compares frames based only on point IDs, not stamps:

```typescript
export function compareInstancedFramesIgnoringStamp(
  a: InstancedFrameInfo,
  b: InstancedFrameInfo,
): FrameComparison {
  // Extract unique point IDs from each frame
  const aPointIds = new Set(a.points.map((point) => point.id));
  const bPointIds = new Set(b.points.map((point) => point.id));
  
  // Compare based only on point IDs, ignoring stamps
  // ... comparison logic without stamp check
}
```

### 2. Updated DataPoint Selection Check

Modified the DataPoint component to use stamp-ignoring comparison during drag:

```typescript
const isSelected = useAnimationStore(
  useShallow((state) => {
    // Use stamp-ignoring comparison during drag to maintain selection visual
    const compareFunc = state.dragState?.isDragging
      ? compareInstancedFramesIgnoringStamp
      : compareInstancedFrames;
    
    const comparisons = state.selection.map((s) => compareFunc(s, data));
    return (
      comparisons.includes(FrameComparison.Equal) ||
      comparisons.includes(FrameComparison.Superset)
    );
  }),
);
```

### 3. Updated Reference Marker Check

Applied the same logic to reference marker comparison:

```typescript
const isReference = useAnimationStore(
  useShallow((state) => {
    if (!state.referenceMarker) return false;
    // Use stamp-ignoring comparison during drag
    const compareFunc = state.dragState?.isDragging
      ? compareInstancedFramesIgnoringStamp
      : compareInstancedFrames;
    return compareFunc(state.referenceMarker.marker, data) === FrameComparison.Equal;
  }),
);
```

### 4. Updated Commit-Drag to Maintain Selection

Modified `commit-drag.ts` to update the selection array with new positions:

```typescript
// Build a map of keypoint ID to new stamp
const newStampsByKeypointId = new Map<string, number>();

state.dragState.draggedKeypoints.forEach((dragInfo) => {
  const newStamp = dragInfo.originalStamp + dragInfo.currentOffset;
  newStampsByKeypointId.set(dragInfo.keypointId, newStamp);
});

// Update selection with new positions
const updatedSelection: InstancedFrameInfo[] = state.selection.map((frame) => {
  const firstPointNewStamp = newStampsByKeypointId.get(frame.points[0]?.id);
  if (firstPointNewStamp !== undefined) {
    return {
      ...frame,
      stamp: firstPointNewStamp,
      points: frame.points,
    };
  }
  return frame;
});

// Clear drag state and update selection
set({
  dragState: null,
  selection: updatedSelection,
});
```

## How It Works Now

### During Drag:
1. User starts dragging a marker (selected or unselected)
2. Virtual frames are created with preview positions
3. `isSelected` check uses `compareInstancedFramesIgnoringStamp` during drag
4. Comparison succeeds because point IDs match despite different stamps
5. Visual selection indicator (color/scale) is maintained throughout drag

### After Drag Commit:
1. Keypoints are updated with new positions
2. Selection array is updated with new stamps
3. Markers remain selected at their new positions
4. User can continue working with the same selection

### After Drag Cancel:
1. Drag state is cleared
2. Selection remains unchanged
3. Markers return to original positions
4. Selection is maintained

## Benefits

1. **Consistent Visual Feedback**: Selected markers maintain their orange/scaled appearance throughout the entire drag operation
2. **Persistent Selection**: Markers remain selected after dragging, allowing for multiple consecutive operations
3. **Better UX**: Users can clearly see which markers are selected and being dragged at all times
4. **Proper Multi-Selection**: Multiple selected markers move together and remain selected as a group

## Files Modified

1. **`packages/animation/src/functions/compare-instanced-frames.ts`**
   - Added `compareInstancedFramesIgnoringStamp` function for drag-aware comparison

2. **`packages/animation/src/components/three/canvas-sheet/data-point.tsx`**
   - Updated `isSelected` check to use stamp-ignoring comparison during drag
   - Updated `isReference` check to use stamp-ignoring comparison during drag

3. **`packages/animation/src/actions/drag/commit-drag.ts`**
   - Added selection update logic to maintain selection with new positions after commit

## Testing

Created comprehensive test suite (`data-point-drag-selection.test.ts`) that verifies:
- Stamp-ignoring comparison works correctly during drag
- Selection visual is maintained using the new comparison
- Selection is updated with new positions after commit
- Multi-track selections work correctly
- Reference marker visual is maintained during drag
- Edge cases like boundary clamping are handled

## Technical Details

### Coordinate Space
- All positions are in normalized 0-1 space
- DataPoint converts screen movement to normalized timeline positions
- Virtual frames show preview positions during drag

### Frame Identity
- Frames are identified by their point IDs, not stamps
- During drag, the same logical frame exists at two positions:
  - Original position (in selection array)
  - Virtual position (in virtual frames)
- Stamp-ignoring comparison bridges this gap

### Visual Feedback
- Selection state drives visual properties (color, scale)
- During drag, comparison must succeed for visuals to persist
- After drag, selection must be updated for continued visual feedback