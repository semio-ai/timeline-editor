# Fix for Disappearing Marker During Drag

## Problem Description

When dragging a marker in the animation timeline, the marker would disappear instead of showing at its preview position during the drag operation. This made it impossible to see where the marker would be placed until the drag was completed.

## Root Causes Identified

### 1. Virtual Frames Not Being Used
The `DataRenderer` component was not using the `computeVirtualFrames` function during drag operations. Instead, it was using the regular `computeFrames` function with a local `draggingFrames` state that wasn't connected to the store-based drag system.

```tsx
// Before (incorrect)
const frameData = useMemo(() => {
  return computeFrames(tracks, draggingFrames);
}, [tracks, draggingFrames]);
```

### 2. Incorrect Pixel-to-World Coordinate Conversion
The drag delta calculation was using a simplified fixed scaling factor that didn't account for the actual camera zoom level and viewport dimensions.

```tsx
// Before (incorrect)
const deltaStamp = mx * 10; // Fixed scaling factor
```

### 3. Disconnected Drag State Management
The component was using local state (`onSetDraggingFrames`) instead of the centralized store-based drag state, causing a mismatch between what the store knew about the drag and what was being rendered.

## Solutions Implemented

### 1. Use Virtual Frames During Drag

Updated `DataRenderer` to use `computeVirtualFrames` when a drag operation is active:

```tsx
// After (correct)
const dragState = useAnimationStore(useShallow((state) => state.dragState));

const frameData = useMemo(() => {
  // Use virtual frames when dragging to show preview positions
  if (dragState && dragState.isDragging) {
    return computeVirtualFrames(tracks, dragState);
  }
  return computeFrames(tracks);
}, [tracks, dragState]);
```

### 2. Proper Coordinate System Conversion

Implemented correct pixel-to-world coordinate conversion using the orthographic camera's frustum:

```tsx
// After (correct)
const orthoCamera = camera as THREE.OrthographicCamera;
const frustumWidth = orthoCamera.right - orthoCamera.left;
const pixelsToWorld = frustumWidth / gl.domElement.clientWidth;
const deltaStamp = mx * pixelsToWorld;
```

### 3. Remove Local Drag State Management

Removed the local `draggingFrames` state and `onSetDraggingFrames` callbacks, relying entirely on the store-based drag state:

```tsx
// Removed these:
// const [draggingFrames, setDraggingFrames] = useState<string[]>([]);
// onSetDraggingFrames={setDraggingFrames}
```

## How the Fix Works

### Drag Flow with Virtual Positions

1. **Drag Start**: 
   - User starts dragging a marker
   - `startDragging()` is called, initializing drag state in store
   - Store records original positions of all selected keypoints

2. **Drag Update**:
   - Mouse movement is captured in pixels
   - Pixels are converted to world coordinates using camera frustum
   - `updateDragDelta()` updates virtual positions in store
   - `computeVirtualFrames()` creates frames at preview positions
   - Markers render at virtual positions (original + offset)

3. **Drag End**:
   - Either `commitDrag()` or `cancelDrag()` is called
   - If committed, virtual positions become actual positions
   - If canceled, virtual positions are discarded
   - Rendering returns to actual positions

### Virtual Frame Computation

The `computeVirtualFrames` function:
1. Takes the original tracks
2. Applies drag offsets from the drag state
3. Returns frames with keypoints at their preview positions
4. Does NOT modify the actual track data

This allows the UI to show preview positions while keeping the actual data unchanged until commit.

## Visual Feedback During Drag

With this fix, users now see:
- **During Drag**: Markers at their preview positions (where they would be if dropped)
- **On Commit**: Markers stay at the dropped position
- **On Cancel**: Markers snap back to original positions

## Testing the Fix

### Manual Testing Steps

1. **Single Marker Drag**:
   - Select a single marker
   - Drag it to a new position
   - Verify marker is visible during drag at preview position
   - Release to commit, verify marker stays

2. **Multi-Marker Drag**:
   - Select multiple markers
   - Drag them together
   - Verify all markers show at preview positions
   - Verify relative positions maintained

3. **Zoom Level Testing**:
   - Zoom in/out on timeline
   - Drag markers at different zoom levels
   - Verify smooth movement regardless of zoom

4. **Cancel Testing**:
   - Start dragging
   - Press Escape or trigger cancel
   - Verify markers return to original positions

### Expected Behavior

- ✅ Markers visible throughout drag operation
- ✅ Preview positions update smoothly with mouse movement
- ✅ Correct scaling at all zoom levels
- ✅ Frame snapping works when holding shift
- ✅ Cancel operation restores original positions

## Performance Considerations

The fix maintains good performance by:
- Using memoized computations for virtual frames
- Only computing virtual frames when drag state changes
- Leveraging React's reconciliation for efficient updates

## Related Files

- `packages/animation/src/components/three/canvas-sheet/data-renderer.tsx`
- `packages/animation/src/components/three/canvas-sheet/data-point.tsx`
- `packages/animation/src/functions/compute-virtual-frames.ts`
- `packages/animation/src/actions/drag/drag-actions.ts`

## Summary

This fix resolves the marker disappearing issue by:
1. Properly integrating virtual frame computation during drag
2. Implementing correct coordinate system conversion
3. Using centralized store-based drag state management

The result is a smooth, visual drag experience where users can see exactly where their markers will be placed before committing the change.