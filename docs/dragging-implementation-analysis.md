# Dragging Implementation Analysis for Three.js Data Points

## Overview

This document analyzes the requirements and implementation options for adding dragging capability to the new Three.js-based data points in the animation system. The goal is to enable users to drag keyframes along the timeline while properly handling multi-selection scenarios.

## Current State Analysis

### Three.js Implementation (New)
- **Location**: `packages/animation/src/components/three/canvas-sheet/data-point.tsx`
- **Current Features**:
  - Selection tracking via `useAnimationStore`
  - Click handling with modifier keys (shift/ctrl) for multi-select
  - Hover states and visual feedback
  - `useGesture` hooks with `onDragStart` and `onDragEnd` callbacks (currently unused)

### SVG Implementation (Old)
- **Location**: `packages/animation/src/components/track-internals/frame-marker.tsx`
- **Key Features**:
  - Dragging with `draggingFrames` state to prevent merging during drag
  - Updates keypoints via `updateKeypoints` with `canMerge` flag
  - Frame snapping with shift key override for free movement
  - Coordinate transformation via zoom scales

## Key Requirements

### 1. Multi-Selection Dragging
When multiple data points are selected:
- Dragging any selected point should move all selected points
- Relative positions between selected points should be maintained
- Visual feedback should indicate all points are being moved

### 2. Frame Prevention During Drag
The `draggingFrames` pattern from the old implementation serves to:
- Prevent automatic merging of keyframes at the same timestamp during drag
- Allow temporary overlap while dragging
- Only resolve merging when drag ends

### 3. Coordinate System Handling
Three.js uses different coordinate systems than SVG:
- World space coordinates for 3D positioning
- Need to convert between screen space drag deltas and timeline positions
- Account for camera zoom and pan transformations

## Implementation Options

### Option 1: Direct Port with Dragging Frames (Recommended)

**Approach**: Port the `draggingFrames` pattern directly to the Three.js implementation.

**Implementation**:
1. Add `draggingFrames` state to `DataRenderer`
2. Pass dragging state to `computeFrames` function
3. Update selected keypoints during drag using `updateKeypoints`
4. Clear dragging state on drag end

**Pros**:
- Proven pattern from existing implementation
- Maintains consistency with old behavior
- Leverages existing `computeFrames` logic

**Cons**:
- Requires state management at the renderer level
- May need adjustment for Three.js coordinate system

**Code Structure**:
```typescript
// In DataRenderer
const [draggingFrames, setDraggingFrames] = useState<string[]>([]);

// In DataPoint
onDragStart: () => {
  const selectedIds = getSelectedFrameIds();
  onSetDraggingFrames(selectedIds);
}

onDrag: (state) => {
  const deltaX = calculateTimelineDelta(state.movement[0]);
  updateSelectedKeypoints(deltaX);
}

onDragEnd: () => {
  onSetDraggingFrames([]);
  mergeOverlappingFrames();
}
```

### Option 2: Store-Based Dragging State

**Approach**: Move dragging state to the animation store for global access.

**Implementation**:
1. Add `draggingSelection` to AnimationData store
2. Track drag offset and original positions in store
3. Apply transformations during render based on drag state

**Pros**:
- Centralized state management
- Easier to coordinate with undo/redo
- Can be accessed by any component

**Cons**:
- More complex store updates
- Potential performance impact with frequent updates

### Option 3: Virtual Dragging with Preview

**Approach**: Show preview positions during drag, only commit on release.

**Implementation**:
1. Create temporary "ghost" positions during drag
2. Render both original and preview positions
3. Commit changes only on drag end

**Pros**:
- Clear visual feedback
- Easy to cancel operations
- No intermediate state corruption

**Cons**:
- More complex rendering logic
- Potential visual clutter

## Recommended Implementation Plan

### Phase 1: Basic Dragging
1. Implement Option 1 (Direct Port) as it's most straightforward
2. Add drag handling to `data-point.tsx`:
   ```typescript
   onDrag: (state) => {
     // Convert screen movement to timeline position
     const newPosition = calculateNewPosition(state);
     
     // Update all selected keypoints
     if (isSelected) {
       updateAllSelectedKeypoints(newPosition - data.stamp);
     } else {
       updateSingleKeypoint(data, newPosition);
     }
   }
   ```

### Phase 2: Enhanced Features
1. Add frame snapping (hold shift for free movement)
2. Implement bounds checking to prevent dragging outside valid range
3. Add visual feedback for invalid positions

### Phase 3: Integration with Edit Operations
1. Ensure dragging respects undo/redo system
2. Coordinate with cut/copy/paste operations
3. Handle edge cases like dragging across animation boundaries

## Relationship to Cut/Copy/Paste Operations

### Shared Concerns
- **Selection Management**: Both operations work on the current selection
- **Frame Merging**: Both need to handle potential timestamp conflicts
- **Undo/Redo**: Both should integrate with the history system

### Key Differences
- **Dragging**: Modifies existing keypoints in place
- **Cut/Copy/Paste**: Creates new keypoints, potentially in different tracks

### Recommended Abstraction
Create shared utilities for:
1. **Selection queries**: `getSelectedKeypoints()`, `getSelectionBounds()`
2. **Batch updates**: `updateMultipleKeypoints()`, `createMultipleKeypoints()`
3. **Conflict resolution**: `resolveTimestampConflicts()`, `mergeKeypoints()`

## Technical Considerations

### Performance
- Batch updates using `updateKeypoints` (already supports arrays)
- Throttle drag updates to prevent excessive re-renders
- Use `memo` and `useShallow` to minimize unnecessary computations

### Coordinate Transformations
```typescript
// Convert Three.js world position to timeline stamp
const worldToTimeline = (worldX: number): number => {
  const normalizedX = (worldX - viewportStart) / viewportWidth;
  return normalizedX * animationDuration;
};

// Apply zoom-invariant scaling
const applyInvariantDelta = (delta: number, zoom: number): number => {
  return delta / zoom;
};
```

### State Management Flow
1. User initiates drag → Store selection state
2. During drag → Update temporary positions
3. On drag end → Commit changes and resolve conflicts
4. Post-drag → Clear temporary state

## Implementation Priority

1. **High Priority**:
   - Basic single-point dragging
   - Multi-selection dragging
   - Frame snapping

2. **Medium Priority**:
   - Visual feedback during drag
   - Bounds checking
   - Undo/redo integration

3. **Low Priority**:
   - Advanced conflict resolution
   - Animation curve preservation
   - Cross-track dragging

## Testing Considerations

### Unit Tests
- Test `computeFrames` with dragging state
- Verify keypoint updates maintain data integrity
- Test coordinate transformation accuracy

### Integration Tests
- Multi-selection drag scenarios
- Edge cases (dragging to bounds, overlapping points)
- Performance with large selections

### User Acceptance Criteria
- Dragging feels responsive and intuitive
- Visual feedback is clear and immediate
- Multi-selection behavior matches user expectations
- No data loss or corruption during drag operations

## Conclusion

The recommended approach is to start with Option 1 (Direct Port) as it leverages proven patterns from the existing SVG implementation. The key is to properly handle the coordinate system differences and ensure the dragging state is properly managed through the component hierarchy.

The implementation should prioritize maintaining the existing user experience while taking advantage of Three.js's performance benefits. Special attention should be paid to multi-selection scenarios and ensuring that all selected points move together cohesively.

Future enhancements can build on this foundation to add more sophisticated features like curve preservation, cross-track operations, and advanced conflict resolution.