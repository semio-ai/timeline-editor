# Virtual Dragging Implementation Guide

## Overview

This guide provides a step-by-step implementation plan for adding virtual dragging capability to the Three.js-based animation timeline. The implementation uses a store-based approach with preview positions that are only committed on drag completion.

## Key File References

### Core Files to Modify
- **Store**: `packages/animation/src/store.ts` - Main animation store
- **Store Types**: `packages/animation/src/store-types.ts` - Type definitions
- **Data Point**: `packages/animation/src/components/three/canvas-sheet/data-point.tsx` - Individual keyframe component
- **Data Renderer**: `packages/animation/src/components/three/canvas-sheet/data-renderer.tsx` - Track renderer
- **Update Keypoint**: `packages/animation/src/actions/update-keypoint.ts` - Keypoint update logic

### Reference Implementation (Old SVG)
- **Frame Marker**: `packages/animation/src/components/track-internals/frame-marker.tsx` - Previous dragging implementation
- **Data Display**: `packages/animation/src/components/track-internals/data-display.tsx` - Previous renderer with draggingFrames

### Utility Functions
- **Compute Frames**: `packages/animation/src/functions/compute-frames.ts` - Frame computation with drag prevention
- **Compute Marker Selection**: `packages/animation/src/functions/compute-marker-selection.ts` - Selection logic
- **Compute Local Stamp**: `packages/animation/src/functions/compute-local-stamp.ts` - Timestamp transformations

### Undo/Redo Integration
- **Studio Store**: `apps/studio/src/hooks/store.ts` - Uses `temporal` from zundo
- **Temporal Store Type**: Lines 67-73 define what's tracked for undo/redo

## Implementation Stages

## Stage 1: Add Drag State to Store (Day 1-2)

### 1.1 Update Store Types

**File**: `packages/animation/src/store-types.ts`

```typescript
// Add to AnimationData interface
export interface AnimationData {
  // ... existing fields ...
  
  // Drag state for virtual preview
  dragState: DragState | null;
  
  // Computed track data (will be implemented in Stage 3)
  computedTracks: Record<string, ComputedTrackData>;
}

export interface DragState {
  isDragging: boolean;
  // Map of keypointId to drag information
  draggedKeypoints: Map<string, DraggedKeypoint>;
  // Original positions before drag started
  originalPositions: Map<string, number>;
  // Current drag offset in timeline units
  currentDelta: number;
  // Whether to snap to frames
  snapToFrames: boolean;
  // Track IDs affected by drag
  affectedTrackIds: Set<string>;
}

export interface DraggedKeypoint {
  keypointId: string;
  trackId: string;
  originalStamp: number;
  previewStamp: number;
}

// Add to AnimationActions interface
export interface AnimationActions {
  // ... existing actions ...
  
  // Drag actions
  startDragging: (selection?: InstancedFrameInfo[]) => void;
  updateDragPreview: (deltaStamp: number, snapToFrames: boolean) => void;
  commitDrag: () => void;
  cancelDrag: () => void;
  
  // Computed data actions (Stage 3)
  updateComputedTracks: (trackIds: string[]) => void;
}
```

### 1.2 Implement Drag Actions

**File**: `packages/animation/src/store.ts`

```typescript
// Add to AnimationSlice
startDragging: (selection?: InstancedFrameInfo[]) => {
  const state = get();
  const currentSelection = selection || state.selection;
  
  if (currentSelection.length === 0) return;
  
  const draggedKeypoints = new Map<string, DraggedKeypoint>();
  const originalPositions = new Map<string, number>();
  const affectedTrackIds = new Set<string>();
  
  currentSelection.forEach(frame => {
    frame.points.forEach(point => {
      draggedKeypoints.set(point.id, {
        keypointId: point.id,
        trackId: point.trackId,
        originalStamp: frame.stamp,
        previewStamp: frame.stamp
      });
      originalPositions.set(point.id, frame.stamp);
      affectedTrackIds.add(point.trackId);
    });
  });
  
  set({
    dragState: {
      isDragging: true,
      draggedKeypoints,
      originalPositions,
      currentDelta: 0,
      snapToFrames: true,
      affectedTrackIds
    }
  });
},

updateDragPreview: (deltaStamp: number, snapToFrames: boolean) => {
  set(produce((state: AnimationData) => {
    if (!state.dragState) return;
    
    const { frameCount } = get(); // Assuming frameCount is available
    
    state.dragState.currentDelta = deltaStamp;
    state.dragState.snapToFrames = snapToFrames;
    
    state.dragState.draggedKeypoints.forEach((dragInfo) => {
      const newStamp = dragInfo.originalStamp + deltaStamp;
      
      // Apply snapping if enabled
      dragInfo.previewStamp = snapToFrames 
        ? closestFrame(newStamp, frameCount)
        : newStamp;
      
      // Ensure within bounds [0, 1]
      dragInfo.previewStamp = Math.max(0, Math.min(1, dragInfo.previewStamp));
    });
  }));
},

commitDrag: () => {
  const state = get();
  if (!state.dragState) return;
  
  // Collect all updates
  const updates: { trackId: string; keypoint: Partial<Keypoint<RawValue>> }[] = [];
  
  state.dragState.draggedKeypoints.forEach((dragInfo) => {
    updates.push({
      trackId: dragInfo.trackId,
      keypoint: {
        id: dragInfo.keypointId,
        stamp: dragInfo.previewStamp
      }
    });
  });
  
  // Batch update with merging allowed
  state.updateKeypoints(updates, true);
  
  // Clear drag state
  set({ dragState: null });
},

cancelDrag: () => {
  set({ dragState: null });
}
```

### 1.3 Testing Stage 1

```typescript
// Test file: packages/animation/src/store.test.ts

describe('Drag State Management', () => {
  it('should initialize drag state with selected keypoints', () => {
    const store = createAnimationStore();
    const selection = [/* mock InstancedFrameInfo */];
    
    store.getState().startDragging(selection);
    
    const dragState = store.getState().dragState;
    expect(dragState).not.toBeNull();
    expect(dragState.isDragging).toBe(true);
    expect(dragState.draggedKeypoints.size).toBeGreaterThan(0);
  });
  
  it('should update preview positions during drag', () => {
    const store = createAnimationStore();
    store.getState().startDragging();
    store.getState().updateDragPreview(0.1, true);
    
    const dragState = store.getState().dragState;
    dragState.draggedKeypoints.forEach((dragInfo) => {
      expect(dragInfo.previewStamp).not.toBe(dragInfo.originalStamp);
    });
  });
  
  it('should commit changes and clear state', () => {
    const store = createAnimationStore();
    const updateKeypoints = jest.spyOn(store.getState(), 'updateKeypoints');
    
    store.getState().startDragging();
    store.getState().commitDrag();
    
    expect(updateKeypoints).toHaveBeenCalled();
    expect(store.getState().dragState).toBeNull();
  });
});
```

## Stage 2: Integrate Drag with DataPoint Component (Day 2-3)

### 2.1 Update DataPoint to Use Store Actions

**File**: `packages/animation/src/components/three/canvas-sheet/data-point.tsx`

```typescript
// Add to DataPoint component
const [startDragging, updateDragPreview, commitDrag, cancelDrag] = useAnimationStore(
  useShallow((state) => [
    state.startDragging,
    state.updateDragPreview,
    state.commitDrag,
    state.cancelDrag
  ])
);

const dragState = useAnimationStore(useShallow((state) => state.dragState));

// Check if this point is being dragged
const isBeingDragged = useMemo(() => {
  if (!dragState) return false;
  return data.points.some(p => dragState.draggedKeypoints.has(p.id));
}, [dragState, data.points]);

// Calculate preview position if being dragged
const previewStamp = useMemo(() => {
  if (!isBeingDragged || !dragState) return data.stamp;
  
  // Get the first point's preview position (all should be at same stamp)
  const firstPoint = data.points[0];
  const dragInfo = dragState.draggedKeypoints.get(firstPoint.id);
  return dragInfo?.previewStamp ?? data.stamp;
}, [isBeingDragged, dragState, data]);

// Update gesture handling
const bind = useGesture({
  onDragStart: ({ event }) => {
    event.stopPropagation();
    
    // If this marker is selected, drag all selected markers
    // Otherwise, select and drag only this marker
    if (!isSelected) {
      clickMarker(data, sources, allData, false, false);
    }
    
    // Start dragging with current selection
    startDragging();
  },
  
  onDrag: ({ movement, shiftKey, event }) => {
    event.stopPropagation();
    
    // Convert screen movement to timeline delta
    const [deltaX] = movement;
    const timelineDelta = (deltaX / viewportWidth) * animationDuration;
    
    // Convert to normalized stamp [0, 1]
    const normalizedDelta = timelineDelta / animationDuration;
    
    updateDragPreview(normalizedDelta, !shiftKey);
  },
  
  onDragEnd: ({ event }) => {
    event.stopPropagation();
    commitDrag();
  },
  
  onDragCancel: () => {
    cancelDrag();
  }
});

// Update position based on preview
const xPosition = useMemo(() => {
  return previewStamp * animationDuration;
}, [previewStamp, animationDuration]);

// Add visual feedback for dragging state
const opacity = useSpring(isBeingDragged ? 0.7 : 1, {
  stiffness: 300,
  damping: 20
});
```

### 2.2 Update DataRenderer to Handle Virtual Frames

**File**: `packages/animation/src/components/three/canvas-sheet/data-renderer.tsx`

```typescript
// Remove local draggingFrames state
// const [draggingFrames, setDraggingFrames] = useState<string[]>([]);

// Get drag state from store
const dragState = useAnimationStore(useShallow((state) => state.dragState));

// Compute frames with drag state
const frameData: InstancedFrameInfo[] = useMemo(() => {
  const draggingIds = dragState 
    ? Array.from(dragState.draggedKeypoints.keys())
    : undefined;
  
  // Get base frames
  const frames = computeFrames(tracks, draggingIds);
  
  // Apply preview positions if dragging
  if (dragState) {
    return frames.map(frame => {
      const isDragged = frame.points.some(p => 
        dragState.draggedKeypoints.has(p.id)
      );
      
      if (isDragged) {
        // Get preview stamp from first point
        const dragInfo = dragState.draggedKeypoints.get(frame.points[0].id);
        return {
          ...frame,
          stamp: dragInfo?.previewStamp ?? frame.stamp
        };
      }
      
      return frame;
    });
  }
  
  return frames;
}, [tracks, dragState]);
```

### 2.3 Testing Stage 2

```typescript
// Test file: packages/animation/src/components/three/canvas-sheet/data-point.test.tsx

describe('DataPoint Dragging', () => {
  it('should start drag when gesture begins', () => {
    const { getByTestId } = render(<DataPoint {...mockProps} />);
    const point = getByTestId('data-point');
    
    fireEvent.mouseDown(point);
    fireEvent.mouseMove(point, { clientX: 100 });
    
    const dragState = useAnimationStore.getState().dragState;
    expect(dragState?.isDragging).toBe(true);
  });
  
  it('should update preview position during drag', () => {
    const { getByTestId } = render(<DataPoint {...mockProps} />);
    const point = getByTestId('data-point');
    
    fireEvent.mouseDown(point);
    fireEvent.mouseMove(point, { clientX: 100 });
    
    // Check that preview position has changed
    const dragState = useAnimationStore.getState().dragState;
    const dragInfo = dragState?.draggedKeypoints.values().next().value;
    expect(dragInfo?.previewStamp).not.toBe(dragInfo?.originalStamp);
  });
  
  it('should maintain multi-selection during drag', () => {
    const store = useAnimationStore.getState();
    store.selection = [mockFrame1, mockFrame2];
    
    const { getByTestId } = render(<DataPoint {...mockProps} />);
    const point = getByTestId('data-point');
    
    fireEvent.mouseDown(point);
    
    const dragState = store.dragState;
    expect(dragState?.draggedKeypoints.size).toBe(
      mockFrame1.points.length + mockFrame2.points.length
    );
  });
});
```

## Stage 3: Implement Virtual Interpolators (Day 3-4)

### 3.1 Create Virtual Track Helper

**File**: `packages/animation/src/functions/apply-drag-offsets.ts`

```typescript
import { produce } from 'immer';
import { Track, RawValue } from '../types';
import { DragState } from '../store-types';

/**
 * Creates virtual tracks with drag preview positions applied
 */
export function applyDragOffsets(
  tracks: Record<string, Track<RawValue>>,
  dragState: DragState | null
): Record<string, Track<RawValue>> {
  if (!dragState || !dragState.isDragging) {
    return tracks;
  }
  
  return produce(tracks, draft => {
    // Apply offsets to each dragged keypoint
    dragState.draggedKeypoints.forEach((dragInfo) => {
      const track = draft[dragInfo.trackId];
      if (!track) return;
      
      const pointIndex = track.points.findIndex(
        p => p.id === dragInfo.keypointId
      );
      
      if (pointIndex >= 0) {
        track.points[pointIndex] = {
          ...track.points[pointIndex],
          stamp: dragInfo.previewStamp
        };
      }
    });
    
    // Re-sort points after applying offsets
    Object.values(draft).forEach(track => {
      track.points.sort((a, b) => a.stamp - b.stamp);
    });
  });
}
```

### 3.2 Update Interpolator Subscriptions

**File**: `packages/animation/src/store.ts`

```typescript
// Modify the interpolator subscription
api.subscribe(
  (state: AnimationData) => ({
    track: state.tracks[trackId],
    dragState: state.dragState,
    animatableValue: state.animatables[state.tracks[trackId].animatableId]
  }),
  ({ track, dragState, animatableValue }) => {
    if (!track) return;
    
    // Create virtual track if dragging
    const virtualTrack = dragState?.affectedTrackIds.has(trackId)
      ? applyDragOffsets({ [trackId]: track }, dragState)[trackId]
      : track;
    
    // Use virtual track for interpolator during drag
    const trackToInterpolate = dragState?.isDragging ? virtualTrack : track;
    
    const trackInterp = computeTrackInterpolator(trackToInterpolate, instance);
    const derivativeInterp = computeDerivativeInterpolator(trackInterp, duration);
    
    // Rest of interpolator logic...
  }
);
```

### 3.3 Testing Stage 3

```typescript
// Test file: packages/animation/src/functions/apply-drag-offsets.test.ts

describe('Virtual Track Creation', () => {
  it('should create virtual tracks with preview positions', () => {
    const tracks = createMockTracks();
    const dragState = createMockDragState();
    
    const virtualTracks = applyDragOffsets(tracks, dragState);
    
    // Original tracks should be unchanged
    expect(tracks).toEqual(createMockTracks());
    
    // Virtual tracks should have preview positions
    dragState.draggedKeypoints.forEach((dragInfo) => {
      const point = virtualTracks[dragInfo.trackId].points.find(
        p => p.id === dragInfo.keypointId
      );
      expect(point?.stamp).toBe(dragInfo.previewStamp);
    });
  });
  
  it('should maintain point ordering after offset', () => {
    const tracks = createMockTracks();
    const dragState = createMockDragState();
    
    const virtualTracks = applyDragOffsets(tracks, dragState);
    
    Object.values(virtualTracks).forEach(track => {
      for (let i = 1; i < track.points.length; i++) {
        expect(track.points[i].stamp).toBeGreaterThanOrEqual(
          track.points[i - 1].stamp
        );
      }
    });
  });
});
```

## Stage 4: Move Computations to Store (Day 4-5)

### 4.1 Add Computed Track Data Structure

**File**: `packages/animation/src/store-types.ts`

```typescript
export interface ComputedTrackData {
  // Frame data
  frames: InstancedFrameInfo[];
  virtualFrames: InstancedFrameInfo[];
  
  // Transition segments
  transitions: TransitionSegment[];
  paddedTransitions: TransitionSegment[];
  
  // Violations
  violations: ViolationSet;
  
  // Bounds for vertical rendering
  verticalBounds: [number, number];
  
  // Last computation timestamp
  lastComputed: number;
  
  // Track IDs included in computation
  trackIds: string[];
}
```

### 4.2 Create Computation Selector

**File**: `packages/animation/src/selectors/computed-track-selector.ts`

```typescript
import { AnimationData } from '../store-types';
import { computeFrames, computeTransitionSegments, computeVerticalBounds } from '../functions';

export function computeTrackData(
  state: AnimationData,
  trackIds: string[],
  sources: Source[]
): ComputedTrackData {
  const tracks = pick(state.tracks, trackIds);
  
  // Apply drag offsets if active
  const virtualTracks = state.dragState?.isDragging
    ? applyDragOffsets(tracks, state.dragState)
    : tracks;
  
  // Compute base frames (without drag)
  const frames = computeFrames(
    tracks,
    state.dragState?.isDragging 
      ? Array.from(state.dragState.draggedKeypoints.keys())
      : undefined
  );
  
  // Compute virtual frames (with drag preview)
  const virtualFrames = computeFrames(virtualTracks);
  
  // Use virtual frames for transitions during drag
  const framesToUse = state.dragState?.isDragging ? virtualFrames : frames;
  
  const transitions = computeTransitionSegments(framesToUse, trackIds);
  const paddedTransitions = computeFilledInterpGaps(transitions);
  
  const violations = computeViolationSet(
    pick(state.violations, trackIds)
  );
  
  const verticalBounds = computeVerticalBounds(
    virtualTracks,
    state.animatables,
    sources
  );
  
  return {
    frames,
    virtualFrames,
    transitions,
    paddedTransitions,
    violations,
    verticalBounds,
    lastComputed: Date.now(),
    trackIds
  };
}
```

### 4.3 Add Store Subscription for Computed Data

**File**: `packages/animation/src/store.ts`

```typescript
// Add to store initialization
api.subscribe(
  (state: AnimationData) => ({
    tracks: state.tracks,
    dragState: state.dragState,
    violations: state.violations,
    animatables: state.animatables
  }),
  ({ tracks, dragState }) => {
    // Group tracks by animation for efficient computation
    const trackGroups = groupTracksByAnimation(tracks);
    
    const computedTracks: Record<string, ComputedTrackData> = {};
    
    trackGroups.forEach(group => {
      // Only recompute if tracks or drag state changed
      const shouldRecompute = 
        !state.computedTracks[group.key] ||
        state.computedTracks[group.key].lastComputed < Date.now() - 16 ||
        dragState?.affectedTrackIds.has(group.trackIds[0]);
      
      if (shouldRecompute) {
        const computed = computeTrackData(
          state,
          group.trackIds,
          group.sources
        );
        
        // Share computed data across tracks in same group
        group.trackIds.forEach(trackId => {
          computedTracks[trackId] = computed;
        });
      }
    });
    
    set({ computedTracks });
  },
  {
    equalityFn: shallow,
    // Throttle during drag for performance
    fireImmediately: true
  }
);
```

### 4.4 Simplify DataRenderer

**File**: `packages/animation/src/components/three/canvas-sheet/data-renderer.tsx`

```typescript
export const DataRenderer = memo(function DataRenderer({
  sources = [],
  height = 36,
  // ... other props
}: DataRendererProps) {
  const trackIds = useMemo(() => uniq(sources.map(s => s.trackId)), [sources]);
  
  // Simply select pre-computed data from store
  const computedData = useAnimationStore(
    useShallow(state => {
      // Get computed data for first track (all in group share same data)
      return state.computedTracks[trackIds[0]] || null;
    })
  );
  
  // Fallback if not computed yet
  if (!computedData) {
    return null;
  }
  
  const {
    virtualFrames,
    paddedTransitions,
    violations,
    verticalBounds
  } = computedData;
  
  const color = useColors(trackIds);
  
  return (
    <group position={[0, yOffset, zOffset]}>
      <DataPointsRenderer
        frameData={virtualFrames}
        theme={theme}
        trackRender={trackRender}
        height={height - 1}
        verticalBounds={{ 
          min: verticalBounds[0], 
          max: verticalBounds[1] 
        }}
        sources={sources}
      />
      
      {paddedTransitions.map((segment, index) => (
        <TransitionSegment
          key={`${segment.start.id}-${segment.end.id}-${index}`}
          {...segment}
        />
      ))}
      
      <ViolationRenderer
        violationSet={violations}
        theme={theme}
        height={height - 1}
      />
    </group>
  );
});
```

### 4.5 Testing Stage 4

```typescript
// Test file: packages/animation/src/selectors/computed-track-selector.test.ts

describe('Computed Track Data', () => {
  it('should compute all derived data', () => {
    const state = createMockAnimationState();
    const computed = computeTrackData(state, ['track1'], []);
    
    expect(computed.frames).toBeDefined();
    expect(computed.virtualFrames).toBeDefined();
    expect(computed.transitions).toBeDefined();
    expect(computed.paddedTransitions).toBeDefined();
    expect(computed.violations).toBeDefined();
    expect(computed.verticalBounds).toHaveLength(2);
  });
  
  it('should use virtual tracks during drag', () => {
    const state = createMockAnimationState();
    state.dragState = createMockDragState();
    
    const computed = computeTrackData(state, ['track1'], []);
    
    // Virtual frames should differ from base frames during drag
    expect(computed.virtualFrames).not.toEqual(computed.frames);
  });
  
  it('should share computation across grouped tracks', () => {
    const store = createAnimationStore();
    // Add multiple tracks that should be grouped
    
    store.getState().updateComputedTracks(['track1', 'track2']);
    
    const computed1 = store.getState().computedTracks['track1'];
    const computed2 = store.getState().computedTracks['track2'];
    
    // Should be the same reference (shared computation)
    expect(computed1).toBe(computed2);
  });
});
```

## Stage 5: Integration Testing and Polish (Day 5-6)

### 5.1 End-to-End Testing

```typescript
// Test file: packages/animation/e2e/dragging.test.tsx

describe('Dragging Integration', () => {
  it('should complete full drag workflow', async () => {
    const { container } = render(<AnimationTimeline />);
    
    // Select multiple keypoints
    const point1 = screen.getByTestId('data-point-1');
    const point2 = screen.getByTestId('data-point-2');
    
    fireEvent.click(point1);
    fireEvent.click(point2, { shiftKey: true });
    
    // Start dragging
    const dragHandle = screen.getByTestId('data-point-1');
    fireEvent.mouseDown(dragHandle);
    
    // Verify drag state initialized
    await waitFor(() => {
      const state = useAnimationStore.getState();
      expect(state.dragState?.isDragging).toBe(true);
    });
    
    // Drag to new position
    fireEvent.mouseMove(document, { clientX: 200 });
    
    // Verify preview updates
    await waitFor(() => {
      const computed = useAnimationStore.getState().computedTracks['track1'];
      expect(computed.virtualFrames[0].stamp).not.toBe(
        computed.frames[0].stamp
      );
    });
    
    // Complete drag
    fireEvent.mouseUp(document);
    
    // Verify changes committed
    await waitFor(() => {
      const state = useAnimationStore.getState();
      expect(state.dragState).toBeNull();
      expect(state.tracks['track1'].points[0].stamp).toBe(/* new position */);
    });
  });
  
  it('should handle drag cancellation', async () => {
    // Test ESC key cancels drag
    // Test that original positions are restored
  });
  
  it('should respect frame snapping', async () => {
    // Test with and without shift key
    // Verify positions snap to frame boundaries
  });
});
```

### 5.2 Performance Testing

```typescript
describe('Dragging Performance', () => {
  it('should handle dragging 100+ keypoints', async () => {
    const startTime = performance.now();
    
    // Create many keypoints
    // Start drag
    // Move multiple times
    // Measure frame rate
    
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(1000); // Under 1 second
  });
  
  it('should throttle updates during rapid movement', async () => {
    const updateSpy = jest.spyOn(store.getState(), 'updateDragPreview');
    
    // Simulate rapid mouse movements
    for (let i = 0; i < 100; i++) {
      fireEvent.mouseMove(document, { clientX: i });
    }
    
    // Should be throttled, not called 100 times
    expect(updateSpy).toHaveBeenCalledTimes(expect.lessThan(20));
  });
});
```

### 5.3 Zundo Integration Verification

```typescript
describe('Undo/Redo with Dragging', () => {
  it('should create single undo entry for drag operation', () => {
    const store = useAnimationStore.getState();
    const temporal = (store as any).temporal;
    
    const initialHistory = temporal.getState().pastStates.length;
    
    // Perform drag operation
    store.startDragging();
    store.updateDragPreview(0.1, true);
    store.commitDrag();
    
    const finalHistory = temporal.getState().pastStates.length;
    expect(finalHistory).toBe(initialHistory + 1);
  });
  
  it('should restore original positions on undo', () => {
    const store = useAnimationStore.getState();
    const temporal = (store as any).temporal;
    
    const originalStamp = store.tracks['track1'].points[0].stamp;
    
    // Drag and commit
    store.startDragging();
    store.updateDragPreview(0.1, true);
    store.commitDrag();
    
    // Undo
    temporal.getState().undo();
    
    expect(store.tracks['track1'].points[0].stamp).toBe(originalStamp);
  });
});
```

## Performance Optimizations

### Memoization Strategy
```typescript
// Use stable references for computed data
const computedTracksRef = useRef<ComputedTrackData>();
const computedTracks = useMemo(() => {
  if (
    !computedTracksRef.current ||
    computedTracksRef.current.lastComputed < lastTrackUpdate
  ) {
    computedTracksRef.current = computeTrackData(/* ... */);
  }
  return computedTracksRef.current;
}, [lastTrackUpdate]);