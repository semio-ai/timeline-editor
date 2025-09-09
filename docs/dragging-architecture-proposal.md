# Virtual Dragging Architecture Proposal

## Executive Summary

This proposal outlines a store-based architecture for implementing dragging with virtual preview positions, addressing both the immediate need for dragging functionality and the broader architectural concern of moving computational logic from components to the store.

## Core Principles

1. **Single Source of Truth**: All state, including temporary drag state, lives in the store
2. **Computed State**: Derived values (frames, interpolations, violations) are computed in the store
3. **Virtual Preview**: Drag operations show preview positions without modifying actual keypoints
4. **Atomic Commits**: Changes are only persisted on drag completion
5. **Immediate Feedback**: Visual updates happen in real-time despite deferred commits

## Architecture Overview

### Store Structure

```typescript
interface AnimationData {
  // Existing state
  tracks: Record<string, Track<RawValue>>;
  selection: InstancedFrameInfo[];
  referenceMarker: { marker: InstancedFrameInfo; sources: Source[] } | null;
  
  // New: Drag state
  dragState: {
    isDragging: boolean;
    draggedKeypoints: Map<string, DraggedKeypoint>; // keypointId -> drag info
    startPositions: Map<string, number>; // keypointId -> original stamp
    deltaStamp: number; // Current drag offset
  } | null;
  
  // New: Computed state (memoized)
  computedTracks: Record<string, ComputedTrackData>;
}

interface DraggedKeypoint {
  trackId: string;
  keypointId: string;
  originalStamp: number;
  currentOffset: number;
}

interface ComputedTrackData {
  frames: InstancedFrameInfo[];
  virtualFrames: InstancedFrameInfo[]; // Includes drag preview positions
  transitions: TransitionSegment[];
  paddedTransitions: TransitionSegment[];
  violations: ViolationSet;
  verticalBounds: [number, number];
  interpolator: (stamp: number) => RawValue | undefined;
  virtualInterpolator: (stamp: number) => RawValue | undefined; // Accounts for drag state
}
```

## Implementation Strategy

### Phase 1: Virtual Drag State Management

```typescript
// Store actions
interface AnimationActions {
  // Drag initiation
  startDragging: (selection?: InstancedFrameInfo[]) => void;
  
  // Drag update (called during drag)
  updateDragDelta: (deltaStamp: number, snapToFrames: boolean) => void;
  
  // Drag completion
  commitDrag: () => void;
  
  // Drag cancellation
  cancelDrag: () => void;
}

// Implementation
startDragging: (selection) => {
  const currentSelection = selection || get().selection;
  const draggedKeypoints = new Map();
  const startPositions = new Map();
  
  currentSelection.forEach(frame => {
    frame.points.forEach(point => {
      draggedKeypoints.set(point.id, {
        trackId: point.trackId,
        keypointId: point.id,
        originalStamp: frame.stamp,
        currentOffset: 0
      });
      startPositions.set(point.id, frame.stamp);
    });
  });
  
  set({
    dragState: {
      isDragging: true,
      draggedKeypoints,
      startPositions,
      deltaStamp: 0
    }
  });
},

updateDragDelta: (deltaStamp, snapToFrames) => {
  set(produce((state) => {
    if (!state.dragState) return;
    
    state.dragState.deltaStamp = deltaStamp;
    state.dragState.draggedKeypoints.forEach((dragInfo) => {
      dragInfo.currentOffset = snapToFrames 
        ? snapToFrame(deltaStamp, state.framerate)
        : deltaStamp;
    });
  }));
},

commitDrag: () => {
  const state = get();
  if (!state.dragState) return;
  
  // Batch update all dragged keypoints
  const updates = Array.from(state.dragState.draggedKeypoints.values()).map(dragInfo => ({
    trackId: dragInfo.trackId,
    keypoint: {
      id: dragInfo.keypointId,
      stamp: dragInfo.originalStamp + dragInfo.currentOffset
    }
  }));
  
  set(produce((state) => {
    // Apply all updates
    updates.forEach(({ trackId, keypoint }) => {
      updateKeypoint(state, trackId, keypoint, true); // Allow merging on commit
    });
    
    // Clear drag state
    state.dragState = null;
  }));
}
```

### Phase 2: Computed State in Store

```typescript
// Selector for computed track data
const computeTrackData = (
  trackIds: string[],
  tracks: Record<string, Track<RawValue>>,
  dragState: DragState | null,
  animatables: Record<string, AnimatableValue>,
  sources: Source[]
): ComputedTrackData => {
  // Apply virtual positions if dragging
  const virtualTracks = dragState 
    ? applyDragOffsets(tracks, dragState)
    : tracks;
  
  // Compute frames (with drag prevention if needed)
  const frames = computeFrames(tracks, dragState?.isDragging ? 
    Array.from(dragState.draggedKeypoints.keys()) : undefined);
  
  // Compute virtual frames for preview
  const virtualFrames = dragState 
    ? computeFrames(virtualTracks, undefined)
    : frames;
  
  // Compute transitions
  const transitions = computeTransitionSegments(virtualFrames, trackIds);
  const paddedTransitions = computeFilledInterpGaps(transitions);
  
  // Compute violations
  const violations = computeViolationSet(
    computeTrackViolations(virtualTracks, animatables)
  );
  
  // Compute bounds
  const verticalBounds = computeVerticalBounds(
    virtualTracks, 
    animatables, 
    sources
  );
  
  // Create interpolators
  const interpolator = createTrackInterpolator(tracks);
  const virtualInterpolator = createTrackInterpolator(virtualTracks);
  
  return {
    frames,
    virtualFrames,
    transitions,
    paddedTransitions,
    violations,
    verticalBounds,
    interpolator,
    virtualInterpolator
  };
};

// Helper to apply drag offsets to tracks
const applyDragOffsets = (
  tracks: Record<string, Track<RawValue>>,
  dragState: DragState
): Record<string, Track<RawValue>> => {
  return produce(tracks, draft => {
    dragState.draggedKeypoints.forEach((dragInfo) => {
      const track = draft[dragInfo.trackId];
      if (!track) return;
      
      const point = track.points.find(p => p.id === dragInfo.keypointId);
      if (point) {
        point.stamp = dragInfo.originalStamp + dragInfo.currentOffset;
      }
    });
    
    // Re-sort points after applying offsets
    Object.values(draft).forEach(track => {
      track.points.sort((a, b) => a.stamp - b.stamp);
    });
  });
};
```

### Phase 3: Store Subscription Pattern

```typescript
// Subscribe to track changes and update computed state
api.subscribe(
  (state) => ({
    tracks: state.tracks,
    dragState: state.dragState,
    animatables: state.animatables
  }),
  ({ tracks, dragState, animatables }) => {
    const computedTracks: Record<string, ComputedTrackData> = {};
    
    // Group tracks by common computation needs
    const trackGroups = groupTracksByAnimation(tracks);
    
    trackGroups.forEach(group => {
      const computed = computeTrackData(
        group.trackIds,
        pick(tracks, group.trackIds),
        dragState,
        animatables,
        group.sources
      );
      
      group.trackIds.forEach(trackId => {
        computedTracks[trackId] = computed;
      });
    });
    
    set({ computedTracks });
  },
  { 
    equalityFn: shallow,
    // Debounce for performance during drag
    debounce: dragState?.isDragging ? 16 : 0 
  }
);
```

## Component Simplification

### Before (Current DataRenderer)
```typescript
// Lots of computation in component
const frameData = useMemo(() => computeFrames(tracks, draggingFrames), [tracks, draggingFrames]);
const interps = useMemo(() => computeTransitionSegments(frameData, trackIds), [frameData, trackIds]);
const paddedInterps = useMemo(() => computeFilledInterpGaps(interps), [interps]);
// ... etc
```

### After (Simplified DataRenderer)
```typescript
export const DataRenderer = memo(function DataRenderer({ 
  trackIds,
  sources,
  ...props 
}) {
  // Simply select pre-computed data from store
  const computedData = useAnimationStore(
    useShallow(state => state.computedTracks[trackIds[0]])
  );
  
  const { virtualFrames, paddedTransitions, violations, verticalBounds } = computedData;
  
  return (
    <group>
      <DataPointsRenderer 
        frameData={virtualFrames}
        // No need for onSetDraggingFrames - handled by store
      />
      
      {paddedTransitions.map(segment => (
        <TransitionSegment key={segment.id} {...segment} />
      ))}
      
      <ViolationRenderer violationSet={violations} />
    </group>
  );
});
```

## Interpolator Updates for Immediate Feedback

### Problem
Current interpolators use committed keypoint values, but we need immediate visual feedback during drag.

### Solution
Maintain dual interpolators:
1. **Base Interpolator**: Uses committed keypoint positions
2. **Virtual Interpolator**: Uses preview positions during drag

```typescript
// In store subscription that updates interpolators
const updateInterpolators = () => {
  const state = get();
  const playerStamp = usePlayerStore.getState().player.stamp;
  
  Object.entries(state.computedTracks).forEach(([trackId, computed]) => {
    const lookup = getLookup(namespace, trackId);
    
    // Use virtual interpolator during drag, base interpolator otherwise
    const interpolator = state.dragState?.isDragging 
      ? computed.virtualInterpolator 
      : computed.interpolator;
    
    const value = interpolator(playerStamp);
    const derivative = computeDerivative(interpolator, playerStamp);
    
    state.values.set(lookup, value);
    state.velocities.set(lookup, derivative);
  });
};
```

## Advantages of This Architecture

### 1. Cleaner Separation of Concerns
- Components focus on rendering
- Store handles all computation and state management
- Business logic is centralized and testable

### 2. Performance Benefits
- Computed values are memoized in store
- Shared computations across components
- Reduced re-renders through precise subscriptions
- Debounced updates during drag

### 3. Better Developer Experience
- Simpler components
- Easier to test business logic
- Clear data flow
- Reduced prop drilling

### 4. Enhanced Features
- Easy to implement undo/redo
- Simple to add drag constraints
- Natural place for validation logic
- Straightforward multi-selection handling

## Migration Path

### Step 1: Add Drag State to Store (1-2 days)
- Implement `dragState` structure
- Add drag action methods
- Keep existing component computation temporarily

### Step 2: Implement Virtual Interpolators (1 day)
- Create dual interpolator system
- Update player subscriptions
- Test immediate feedback

### Step 3: Move Computations to Store (2-3 days)
- Implement `computedTracks` structure
- Create subscription patterns
- Add memoization strategies

### Step 4: Simplify Components (1 day)
- Remove computational logic from DataRenderer
- Update DataPoint to use store actions
- Clean up unused props and state

### Step 5: Testing and Optimization (1-2 days)
- Performance profiling
- Edge case testing
- Documentation updates

## Performance Considerations

### Optimization Strategies
1. **Selective Recomputation**: Only recompute affected tracks during drag
2. **Debouncing**: Throttle updates during rapid drag movements
3. **Lazy Evaluation**: Compute interpolators only for visible tracks
4. **Batching**: Group related updates to minimize renders

### Memory Management
```typescript
// Cleanup computed data for removed tracks
api.subscribe(
  state => state.tracks,
  tracks => {
    const currentComputed = get().computedTracks;
    const validTrackIds = Object.keys(tracks);
    
    // Remove computed data for deleted tracks
    const cleaned = pick(currentComputed, validTrackIds);
    if (Object.keys(cleaned).length < Object.keys(currentComputed).length) {
      set({ computedTracks: cleaned });
    }
  }
);
```

## Related Improvements

### Cut/Copy/Paste Integration
The virtual state pattern extends naturally to cut/copy/paste:

```typescript
interface ClipboardState {
  operation: 'cut' | 'copy' | null;
  content: Keypoint[];
  sourceTrackIds: string[];
}

// Preview paste positions before committing
interface PastePreview {
  targetStamp: number;
  targetTrackIds: string[];
  previewFrames: InstancedFrameInfo[];
}
```

### Undo/Redo System
```typescript
interface HistoryEntry {
  timestamp: number;
  description: string;
  before: Partial<AnimationData>;
  after: Partial<AnimationData>;
}

// Drag operations create single history entries
commitDrag: () => {
  const before = captureState(['tracks']);
  applyDragChanges();
  const after = captureState(['tracks']);
  
  addHistoryEntry({
    description: `Move ${dragState.draggedKeypoints.size} keypoints`,
    before,
    after
  });
}
```

## Conclusion

This architecture provides a robust foundation for implementing dragging while addressing broader concerns about component complexity and state management. By moving computations to the store and implementing virtual preview states, we achieve:

1. **Immediate visual feedback** without committing changes
2. **Cleaner components** focused on rendering
3. **Better performance** through centralized computation
4. **Easier testing** of business logic
5. **Natural integration** with other editing operations

The investment in this architecture will pay dividends as the application grows, making future features easier to implement and maintain.