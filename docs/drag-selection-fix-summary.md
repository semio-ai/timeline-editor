# Drag Selection Fix Implementation

## Problem Statement

When dragging timeline markers, two critical issues were occurring:
1. **Visual Selection Loss During Drag**: Selected markers lost their visual selection indicator while being dragged
2. **Selection State Loss After Drag**: Markers were no longer selected after the drag operation completed

This was causing a poor user experience as users couldn't see which markers were selected during a drag operation, and had to re-select markers after each drag.

## Root Causes

### 1. Incorrect Selection Check in FrameMarker
The `FrameMarker` component (2D timeline) was checking if a marker was selected by comparing against the playhead position (`state.player.stamp`) instead of checking the actual selection array.

```typescript
// BEFORE - Incorrect
const isSelected = usePlayerStore(
  useShallow((state) => trackIds.length > 0 && state.player.stamp === data.stamp),
);
```

### 2. Selection Not Updated After Drag Commit
When `commitDrag` was called, it updated the keypoint positions but didn't update the selection array to reflect the new positions of the dragged markers.

### 3. Inconsistent Drag Systems
The 2D timeline (`FrameMarker`) was using direct keypoint updates during drag, while the 3D view (`DataPoint`) was using the virtual dragging system. This inconsistency led to different behaviors between views.

### 4. DataDisplay Not Using Virtual Frames
The `DataDisplay` component was using `computeFrames` with local drag tracking instead of `computeVirtualFrames` with the store-based drag state.

## Solutions Implemented

### 1. Fixed FrameMarker Selection Check
Updated `FrameMarker` to check against the selection array, matching the behavior of `DataPoint`:

```typescript
// AFTER - Correct
const isSelected = useAnimationStore(
  useShallow((state) => {
    const comparisons = state.selection.map((s) => compareInstancedFrames(s, data));
    return (
      comparisons.includes(FrameComparison.Equal) ||
      comparisons.includes(FrameComparison.Superset)
    );
  }),
);
```

### 2. Updated Commit-Drag to Maintain Selection
Modified `commit-drag.ts` to update the selection array with new positions after drag:

```typescript
// Build a map of keypoint ID to new stamp for updating selection
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

### 3. Unified FrameMarker to Use Virtual Dragging
Updated `FrameMarker` to use the same virtual dragging system as `DataPoint`:

```typescript
// Auto-select if not already selected
if (!isSelected) {
  clickMarker(data, sources, allData, false, false);
}

// Start virtual dragging
startDragging();

// Update drag delta in normalized space
updateDragDelta(deltaInNormalized, shouldSnap);

// Commit or cancel based on drag end state
if (state.canceled) {
  cancelDrag();
} else {
  commitDrag();
}
```

### 4. Updated DataDisplay to Use Virtual Frames
Modified `DataDisplay` to use `computeVirtualFrames` for consistent drag preview:

```typescript
// BEFORE
const frameData: InstancedFrameInfo[] = useMemo(() => {
  return computeFrames(tracks, draggingFrames);
}, [tracks, draggingFrames]);

// AFTER
const dragState = useAnimationStore(useShallow((state) => state.dragState));

const frameData: InstancedFrameInfo[] = useMemo(() => {
  return computeVirtualFrames(tracks, dragState);
}, [tracks, dragState]);
```

## Benefits

1. **Consistent Visual Feedback**: Selected markers now maintain their visual selection indicator throughout the entire drag operation
2. **Persistent Selection**: Markers remain selected after dragging, allowing for multiple drag operations without re-selection
3. **Unified Behavior**: Both 2D and 3D timeline views now use