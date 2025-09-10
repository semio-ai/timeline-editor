# DataPoint Drag Integration Fixes

## Overview

This document outlines the fixes and improvements made to the DataPoint component to properly integrate with the store-based drag system implemented in Phase 1.

## Issues Addressed

### 1. UseGesture API Compatibility

**Problem**: The initial implementation incorrectly used `cancel` property in `onDragEnd`, which doesn't exist in the @use-gesture/react API.

**Solution**: Updated to use the correct `canceled` property that is provided by the gesture state.

```tsx
// Before (incorrect)
onDragEnd: ({ event, cancel }) => {
  if (cancel) {
    cancelDrag();
  }
}

// After (correct)
onDragEnd: ({ event, canceled }) => {
  if (canceled) {
    cancelDrag();
  } else {
    commitDrag();
  }
}
```

### 2. Drag State Management

**Problem**: The component could attempt to update drag state even when no drag operation was active, leading to potential errors.

**Solution**: Added proper state tracking with refs and validation checks:

```tsx
const isDraggingRef = useRef<boolean>(false);
const dragState = useAnimationStore(useShallow((state) => state.dragState));

// In onDrag handler
if (!dragState || !dragState.isDragging) return;

// In onDragEnd handler
if (isDraggingRef.current && dragState && dragState.isDragging) {
  // Process drag end
}
```

### 3. Escape Key Cancellation

**Problem**: No way to cancel an active drag operation via keyboard.

**Solution**: Added keyboard event listener for escape key:

```tsx
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isDraggingRef.current && dragState?.isDragging) {
      cancelDrag();
      isDraggingRef.current = false;
      dragStartPosition.current = null;
    }
  };

  if (isDraggingRef.current) {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }
}, [isDraggingRef.current, dragState?.isDragging, cancelDrag]);
```

## Complete Integration Flow

### 1. Drag Start
- User starts dragging a data point
- Component checks if point is selected, auto-selects if not
- Calls `startDragging()` from store
- Sets local tracking refs

### 2. Drag Update
- Captures mouse movement in pixels
- Converts to timestamp units (scaling factor configurable)
- Calls `updateDragDelta()` with optional frame snapping (shift key)
- Store updates virtual positions without modifying actual data

### 3. Drag End
- Checks if drag was canceled (via gesture or escape key)
- Calls either `commitDrag()` or `cancelDrag()` from store
- Cleans up local tracking state
- Triggers optional callback

## Key Features

### Auto-Selection
Points that aren't selected are automatically selected when drag starts:
```tsx
if (!isSelected) {
  clickMarker(data, sources, allData, false, false);
}
startDragging();
```

### Frame Snapping
Hold shift key during drag to snap to frame boundaries:
```tsx
updateDragDelta(deltaStamp, shiftKey);
```

### Proper Cleanup
All refs and state are properly cleaned up on drag end or cancel:
```tsx
dragStartPosition.current = null;
isDraggingRef.current = false;
```

## Configuration

### Scaling Factor
The pixel-to-timestamp conversion uses a configurable scaling factor:
```tsx
const deltaStamp = mx * 10; // Adjust this scaling factor as needed
```

This should be adjusted based on:
- Current zoom level
- Timeline scale
- User preference for drag sensitivity

## Testing Considerations

### Manual Testing Checklist
- [ ] Drag single point
- [ ] Drag multiple selected points
- [ ] Auto-select and drag unselected point
- [ ] Cancel drag with escape key
- [ ] Cancel drag via gesture (e.g., right-click during drag)
- [ ] Frame snapping with shift key
- [ ] Drag across different zoom levels

### Edge Cases to Test
- Starting drag on unselected point
- Canceling drag mid-operation
- Rapid successive drags
- Dragging to negative timestamps
- Dragging past timeline bounds

## Future Improvements

### 1. Dynamic Scaling
Implement zoom-aware scaling factor:
```tsx
const scaleX = useInvariantScale();
const deltaStamp = mx * (10 / scaleX.get());
```

### 2. Visual Feedback
Add visual indicators for:
- Drag preview positions
- Snap indicators
- Constraint violations

### 3. Constraints
Implement drag constraints:
- Minimum/maximum timestamps
- Prevent overlapping keypoints
- Track-specific boundaries

### 4. Performance Optimization
- Debounce drag updates for better performance
- Use requestAnimationFrame for smooth updates
- Implement virtual scrolling for large datasets

## Related Components

- **Store**: `packages/animation/src/store.ts`
- **Drag Actions**: `packages/animation/src/actions/drag/`
- **Virtual Frames**: `packages/animation/src/functions/compute-virtual-frames.ts`
- **Types**: `packages/animation/src/store-types.ts`

## Summary

The DataPoint component now properly integrates with the store-based drag system, providing:
- ✅ Correct gesture API usage
- ✅ Robust state management
- ✅ Keyboard cancellation support
- ✅ Auto-selection behavior
- ✅ Frame snapping
- ✅ Proper cleanup and error handling

These fixes ensure reliable drag-and-drop functionality while maintaining clean separation between UI interactions and state management.