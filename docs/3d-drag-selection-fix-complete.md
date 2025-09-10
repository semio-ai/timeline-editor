# 3D Timeline Drag Selection Fix - Complete Implementation

## Problem Statement

When dragging timeline markers in the 3D canvas-based timeline (DataPoint component), three critical issues were occurring:

1. **Visual Selection Loss During Drag**: Selected markers lost their visual selection indicator (color/scale changes) while being dragged
2. **Selection State Loss After Drag Commit**: Markers were no longer selected after the drag operation completed
3. **Background Click Clearing Selection**: The background was clearing selection on mouse release after drag

This created a poor user experience where users couldn't visually track which markers were selected during a drag operation and had to re-select markers after each drag.

## Root Causes Identified

### 1. Frame Comparison Incompatibility During Drag

The `compareInstancedFrames` function returns `Incompatible` when comparing frames with different stamps but identical point IDs:

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

### 3. Background Click Event on Drag Release

The `FrustumBackground` component had an `onClick` handler that unconditionally cleared selection:
```typescript
onClick={(e) => {
  clearSelection();  // This was being called on mouse release after drag
  pointerEvents.onClick?.(e);
}}
```

When a drag operation ended, the mouse release event was triggering this click handler, clearing the selection immediately after the drag completed.

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

### 3. Fixed Commit-Drag Selection Preservation

Rewrote `commit-drag.ts` to properly maintain selection after updates using Immer:

```typescript
set(
  produce((draft) => {
    // Store selected keypoint IDs before updates
    const selectedKeypointIds = new Set<string>();
    state.selection.forEach((frame) => {
      frame.points.forEach((point) => {
        selectedKeypointIds.add(point.id);
      });
    });

    // Apply drag offsets to keypoints
    draft.dragState?.draggedKeypoints.forEach((dragInfo) => {
      const track = draft.tracks[dragInfo.trackId];
      if (track) {
        const point = track.points.find((p) => p.id === dragInfo.keypointId);
        if (point) {
          point.stamp = dragInfo.originalStamp + dragInfo.currentOffset;
        }
      }
    });

    // Recompute frames and update selection
    const newFrames = computeFrames(draft.tracks);
    draft.selection = newFrames.filter((frame) => {
      return frame.points.some((point) => selectedKeypointIds.has(point.id));
    });

    // Clear drag state
    draft.dragState = null;
  }),
);
```

### 4. Fixed Background Click Interference

Updated `FrustumBackground` to track drag state and avoid clearing selection immediately after drag:

```typescript
const dragState = useAnimationStore(useShallow((state) => state.dragState));
const justFinishedDraggingRef = useRef(false);

useEffect(() => {
  if (!dragState && justFinishedDraggingRef.current === true) {
    // Clear flag after short delay
    const timer = setTimeout(() => {
      justFinishedDraggingRef.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }
  if (dragState?.isDragging) {
    justFinishedDraggingRef.current = true;
  }
}, [dragState]);

// In onClick handler:
onClick={(e) => {
  // Don't clear selection if we just finished dragging
  if (!justFinishedDraggingRef.current) {
    clearSelection();
  }
  pointerEvents.onClick?.(e);
}}
```

## How It Works Now

### During Drag:
1. User starts dragging a marker (selected or unselected)
2. Virtual frames are created with preview positions
3. `isSelected` check uses `compareInstancedFramesIgnoringStamp` during drag
4. Comparison succeeds because point IDs match despite different stamps
5. Visual selection indicator (color/scale) is maintained throughout drag

### After Drag Commit:
1. Keypoints are updated with new positions in a single Immer transaction
2. Frames are recomputed from the updated tracks
3. Selection is rebuilt by finding frames containing the originally selected keypoint IDs
4. Markers remain selected at their new positions
5. Background click handler is temporarily disabled to prevent accidental deselection

### After Drag Cancel:
1. Drag state is cleared
2. Selection remains unchanged
3. Markers return to original positions
4. Selection is maintained

## Benefits

1. **Consistent Visual Feedback**: Selected markers maintain their orange/scaled appearance throughout the entire drag operation
2. **Persistent Selection**: Markers remain selected after dragging, allowing for multiple consecutive operations
3. **No Accidental Deselection**: Background clicks immediately after drag don't clear selection
4. **Better UX**: Users can clearly see which markers are selected and being dragged at all times
5. **Proper Multi-Selection**: Multiple selected markers move together and remain selected as a group

## Files Modified

1. **`packages/animation/src/functions/compare-instanced-frames.ts`**
   - Added `compareInstancedFramesIgnoringStamp` function for drag-aware comparison

2. **`packages/animation/src/components/three/canvas-sheet/data-point.tsx`**
   - Updated `isSelected` check to use stamp-ignoring comparison during drag
   - Updated `isReference` check to use stamp-ignoring comparison during drag

3. **`packages/animation/src/actions/drag/commit-drag.ts`**
   - Complete rewrite using Immer to properly maintain selection
   - Store keypoint IDs before update
   - Rebuild selection from new frames after update
   - Handle reference marker updates

4. **`packages/animation/src/components/three/canvas-sheet/frustum-background.tsx`**
   - Added drag state tracking
   - Prevent selection clearing immediately after drag ends
   - Use ref to track "just finished dragging" state

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

### Event Handling
- DataPoint calls `stopPropagation()` on drag events
- Background tracks drag state to avoid processing clicks after drag
- 100ms delay ensures drag-end events complete before allowing background clicks

### State Management
- Uses Immer for atomic state updates
- Selection rebuild happens in same transaction as keypoint updates
- Ensures consistency between tracks and selection

## Testing Approach

Created comprehensive test suites:
- `data-point-drag-selection.test.ts` - Tests selection logic during drag
- Verifies stamp-ignoring comparison
- Tests selection persistence after commit
- Validates multi-track selection behavior
- Tests edge cases like boundary clamping

## Known Considerations

1. **Performance**: With large numbers of selected markers, frame recomputation may impact performance
2. **Merge Behavior**: When keypoints merge during commit, selection correctly includes the merged frame
3. **Timing**: The 100ms delay for background click protection is empirically determined
4. **Multi-View**: This fix applies to the 3D canvas view; SVG timeline has separate implementation