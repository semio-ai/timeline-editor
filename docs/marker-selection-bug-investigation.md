# Marker Selection Bug Investigation - December 2024

## Bug Description

**Reported Issue**: The last clicked marker in a multi-select operation cannot be re-selected after being dragged and deselected.

### Reproduction Steps
1. Select multiple markers (e.g., 3 markers via shift-click range selection)
2. Drag the selected markers to new positions
3. Click empty space to deselect all markers
4. Try to click on the marker that was "last" in the original multi-selection
5. **BUG**: This specific marker cannot be selected

### Important Notes
- The bug specifically affects the "last" marker in a multi-selection
- Other markers from the same selection can be re-selected normally
- The issue persists across multiple attempts

## Investigation Summary

### Attempted Fixes

#### Fix #1: Use Point IDs as Stable Identifiers
**File**: `src/components/three/canvas-sheet/data-point.tsx`
**Change**: Modified the onClick handler to use point IDs for frame identification
```typescript
// Before: Find frame with matching points
const currentFrame = freshFrames.find((f) =>
  f.points.some((p) => data.points.some((dp) => dp.id === p.id)),
);

// After: Use point IDs as stable identifiers
const pointIds = data.points.map((p) => p.id);
const relevantFrames = freshFrames.filter((frame) =>
  frame.points.some((p) => pointIds.includes(p.id)),
);
```
**Result**: ❌ Bug still present

#### Fix #2: Always Use Stamp-Ignoring Comparison
**File**: `src/components/three/canvas-sheet/data-point.tsx`
**Change**: Modified selection detection to always ignore stamp differences
```typescript
// Before: Switch comparison based on drag state
const compareFunc = state.dragState?.isDragging
  ? compareInstancedFramesIgnoringStamp
  : compareInstancedFrames;

// After: Always use stamp-ignoring comparison
const compareFunc = compareInstancedFramesIgnoringStamp;
```
**Result**: ❌ Bug still present

### What We've Learned

1. **Tests Pass But Bug Persists**: All unit tests for marker selection pass, including specific tests for this scenario (`last-marker-selection-issue.test.ts`), but the bug occurs in the actual UI.

2. **Component vs Store State**: There's a complex interaction between:
   - The `data` prop passed to DataPoint (potentially stale after drag)
   - The selection state in the store (updated after drag)
   - The gesture handling system (useGesture)
   - The React Three Fiber rendering pipeline

3. **Comparison Functions**: The frame comparison logic has two modes:
   - `compareInstancedFrames`: Returns "Incompatible" when stamps differ
   - `compareInstancedFramesIgnoringStamp`: Ignores stamp differences
   
4. **Selection Flow**:
   ```
   Click Event → useGesture → onClick handler → computeFrames → 
   clickMarker (store action) → computeMarkerSelection → 
   Update selection state → Re-render components
   ```

### Architecture Components Involved

#### 1. DataPoint Component (`data-point.tsx`)
- Receives `data` prop with frame info
- Uses `useGesture` for interaction handling
- Manages hover, click, and drag behaviors
- Uses store actions: `clickMarker`, `startDragging`, `updateDragDelta`, `commitDrag`

#### 2. DataRenderer Component (`data-renderer.tsx`)
- Computes frames using `computeVirtualFrames`
- Renders DataPoint components for each frame
- Manages drag state and virtual positions

#### 3. Store Actions
- `clickMarker`: Updates selection based on click
- `startDragging`: Initializes drag state
- `commitDrag`: Applies drag changes and updates selection

#### 4. Selection Functions (`compute-marker-selection.ts`)
- `computeMarkerSelection`: Core selection logic
- Handles simple click, shift-click (range), cmd/ctrl-click (toggle)
- Uses frame comparison functions to determine selection state

## Hypotheses for the Bug

### Hypothesis 1: React Three Fiber Event System
The issue might be in how R3F handles events after drag operations. The last marker might have some state that prevents event propagation through the Canvas → HudSection → TracksRenderer → DataRenderer → DataPoint hierarchy.

### Hypothesis 2: useGesture State Persistence
The `useGesture` hook might be maintaining some internal state about the last dragged element that interferes with subsequent clicks, particularly in the context of the PanZoomControls and camera transformations.

### Hypothesis 3: Instance Reference Issues
Since DataPoints are rendered as instances (`<Instance>`) within the TracksRenderer, there might be issues with how Three.js instances handle events after transformation, especially with the MotionCanvasProvider managing motion values.

### Hypothesis 4: Camera and Viewport Interaction
The PanZoomControls and dynamic camera system might be affecting event raycast calculations specifically for the last marker after drag operations, particularly with the calculatePaddedFrustum viewport adjustments.

### Hypothesis 5: HUD Layer Event Blocking
The multiple HUD sections (top-hud, timeline, minimap, bottom/Stale Reference in Event Handler
The onClick handler might be closing over stale values that specifically affect the last selected marker.

### Hypothesis 5: Store Update Race Condition
There might be a race condition between when the selection is cleared and when the component re-renders, specifically affecting the last marker.

## Browser Testing Setup

To properly debug this issue, we need to test in a real browser environment where we can:
1. Use browser DevTools to inspect component state
2. Set breakpoints in event handlers
3. Observe the actual DOM/WebGL events
4. Track React component updates

### Vitest Browser Mode Configuration

```typescript
// vitest.config.ts addition for browser testing
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      // Enable DevTools for debugging
      providerOptions: {
        launch: {
          devtools: true,
        },
      },
    },
  },
});
```

### Browser Test Structure

```typescript
// tests/browser/marker-selection-bug.test.tsx
import { test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnimationSheet3D } from '../../src/components/three/animation-sheet-3d';
// Or use CanvasSheet for more isolated testing
import { CanvasSheet } from '../../src/components/three/canvas-sheet/canvas-sheet';
import { AnimationContext } from '../../src/context';
import { createTestStore, createTestAnimationData } from '../test-utils';

test('reproduce marker selection bug in browser with full component hierarchy', async () => {
  // 1. Set up test store with animation data
  const store = createTestStore();
  const { animationInstances, tracks } = createTestAnimationData();
  
  // 2. Render the full AnimationSheet3D component
  const { container } = render(
    <AnimationContext.Provider value={store}>
      <AnimationSheet3D
        namespaceId="test"
        animationInstances={animationInstances}
        height={400}
      />
    </AnimationContext.Provider>
  );
  
  // 3. Wait for canvas to render and find markers
  // 4. Simulate multi-selection through the canvas event system
  // 5. Simulate drag operation
  // 6. Clear selection
  // 7. Try to select the last marker
  // 8. Add debugging breakpoints for R3F event propagation
});

test('isolated canvas sheet testing', async () => {
  // For more focused testing, use CanvasSheet directly
  const { container } = render(
    <CanvasSheet
      animationId="test-animation"
      namespaceId="test"
      instanceSettings={{ timescale: 1, offset: 0, active: true }}
      tracks={['track1', 'track2', 'track3']}
      theme="light"
      expanded={[]}
      emphasis={[]}
      trackRender={TrackRender.Key}
    />
  );
  
  // Test marker selection through the canvas rendering pipeline
});
```

## Debugging Strategy

### Step 1: Add Comprehensive Logging
Add detailed logging at each step of the selection process:
```typescript
// In DataPoint onClick
console.log('Click attempt:', {
  markerId: data.id,
  isSelected,
  dataStamp: data.stamp,
  storeSelection: store.selection,
  eventTarget: event.target,
});
```

### Step 2: Track Component Lifecycle
Monitor when DataPoint components mount/unmount/update:
```typescript
useEffect(() => {
  console.log(`DataPoint ${data.id} mounted/updated`, { data, isSelected });
  return () => console.log(`DataPoint ${data.id} unmounting`);
}, [data, isSelected]);
```

### Step 3: Gesture State Inspection
Log useGesture internal state:
```typescript
const bind = useGesture({
  onHover: ({ hovering, event }) => {
    console.log('Hover state:', { markerId: data.id, hovering, event });
  },
  onClick: ({ event, ...gestureState }) => {
    console.log('Full gesture state:', gestureState);
  },
});
```

### Step 4: Three.js Event Inspection
Check if Three.js raycast is hitting the correct object:
```typescript
onClick: ({ event }) => {
  const intersection = event?.intersections?.[0];
  console.log('Three.js intersection:', {
    object: intersection?.object,
    instance: intersection?.instanceId,
    point: intersection?.point,
  });
}
```

## Next Steps

1. **Set up browser testing environment**
   - Configure Vitest for browser mode with Playwright
   - Use the full AnimationSheet3D component with test data from stories
   - Enable Chrome DevTools for live debugging
   - Set breakpoints in DataPoint onClick and gesture handlers

2. **Create reproduction test case**
   ```typescript
   // Key steps to reproduce:
   // 1. Render AnimationSheet3D with multiple tracks
   // 2. Select 3 markers using shift-click (range selection)
   // 3. Note which marker was "last" in selection
   // 4. Drag the selection to a new position
   // 5. Click empty space to clear selection
   // 6. Try to click the "last" marker - BUG: it won't select
   ```

3. **Add targeted debugging in DataPoint**
   ```typescript
   // In data-point.tsx onClick handler
   console.log('Click attempt:', {
     markerId: data.id,
     pointIds: data.points.map(p => p.id),
     isLastInPreviousSelection: /* track this */,
     gestureState: /* full gesture state */,
     threeIntersection: event?.intersections?.[0]
   });
   ```

4. **Check component hierarchy**
   - CanvasSheet → TracksRenderer → DataRenderer → DataPointsRenderer → DataPoint
   - Verify events propagate correctly through this chain
   - Check if any parent component interferes with the "last" marker

5. **Test with different scenarios**
   - Single track vs multiple tracks
   - Different numbers of selected markers (2, 3, 4, etc.)
   - Different drag distances
   - Different marker positions (beginning, middle, end of timeline)

6. **Alternative debugging approaches**
   - Add a debug overlay showing which DataPoint instances are mounted
   - Log all gesture state changes for the problematic marker
   - Use React DevTools to inspect component props/state
   - Use Three.js inspector to check instance rendering

## Key Questions to Answer

1. **Is the click event even firing** on the problematic marker?
2. **What is different about the last marker** compared to others?
3. **Does the issue occur with keyboard selection** (if implemented)?
4. **Does the issue persist after a full page refresh**?
5. **Is there a pattern to which marker becomes unselectable** (always last clicked, last in array, etc.)?

## Potential Workarounds (if root cause can't be found)

1. **Force re-mount**: Key DataPoints differently after drag to force fresh component instances
2. **Event delegation**: Handle clicks at a parent level instead of individual DataPoints
3. **State reset**: Add a mechanism to fully reset gesture state after drag
4. **Alternative selection**: Implement selection via different mechanism (e.g., selection box)

## Resources

- [Vitest Browser Mode Guide](https://vitest.dev/guide/browser/)
- [React Three Fiber Events](https://docs.pmnd.rs/react-three-fiber/api/events)
- [use-gesture Documentation](https://use-gesture.netlify.app/)
- [Three.js Raycasting](https://threejs.org/docs/#api/en/core/Raycaster)

## Test Data Structure

For browser testing, use the pre-built test data from the Storybook stories:

```typescript
// Import test data generators
import {
  sharedAnimatables,      // Pre-defined animatable values
  getSharedAnimation,     // Animation configuration
  sharedTracks,          // Track definitions
  createKeypoints,       // Generate test keypoints
  createAnimationInstances,
  createSingleTrackKeypoints,  // For simpler test cases
  SHARED_ANIMATION_ID,
  SHARED_DURATION
} from '../../../apps/docs/stories/prebuilt/shared-animation-data';

// Example of creating test data for reproduction
const setupTestData = (store) => {
  // Set up animatables (what can be animated)
  store.getState().setAnimatables(sharedAnimatables);
  
  // Set up animation definition
  store.getState().setAnimations(getSharedAnimation());
  
  // Set up tracks
  store.getState().setTracks(sharedTracks);
  
  // Create keypoints - these are the markers that exhibit the bug
  const keypoints = createKeypoints();
  store.getState().createKeypoints(keypoints);
  
  // Configure display
  store.getState().updateFramerate(30);
  store.getState().setTimeDisplay(TimeDisplay.Frames);
};
```

### Key Data Structures

```typescript
interface DataPointProps {
  data: InstancedFrameInfo;  // Contains stamp and points
  allData: InstancedFrameInfo[];
  sources: Source[];
  // ... other props
}

interface InstancedFrameInfo {
  id: string;
  stamp: number;  // Position in timeline (0-1 normalized)
  points: Array<{
    id: string;
    value: RawValue;
    trackId: string;
  }>;
}

// The test data creates markers like:
// - track-position-x: 5 keypoints at different timestamps
// - track-position-y: 5 keypoints at different timestamps  
// - track-position-z: 5 keypoints at different timestamps
// Perfect for reproducing multi-selection and drag scenarios
```

## Conclusion

The bug appears to be related to complex interactions between React Three Fiber's event system, useGesture's state management, and our selection logic. Browser-based testing with real DevTools debugging will be essential to identify the root cause. The fact that unit tests pass but the UI bug persists suggests the issue is in the interaction between these systems rather than the business logic itself.