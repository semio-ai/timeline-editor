# Virtual Dragging Architecture (Updated)

## Executive Summary

This document describes the implemented store-based architecture for dragging with virtual preview positions. The architecture successfully moves computational logic from components to the store, though some features await final integration.

## Implementation Status: December 2024
- ✅ Store-based computation fully implemented
- ✅ Virtual drag state infrastructure complete
- ✅ Computed data in store (as `computedRowData`)
- ⚠️ Drag actions implemented but temporarily disabled
- ⚠️ Selection system implemented but temporarily disabled
- ❌ Dual interpolators pending implementation

## Core Principles

1. **Single Source of Truth**: All state, including temporary drag state, lives in the store
2. **Computed State**: Derived values (frames, interpolations, violations) are computed in the store
3. **Virtual Preview**: Drag operations show preview positions without modifying actual keypoints
4. **Atomic Commits**: Changes are only persisted on drag completion
5. **Immediate Feedback**: Visual updates happen in real-time despite deferred commits

## Known Issues with Current Architecture

### Marker Selection After Drag Bug

**Issue**: After dragging multiple selected markers, the last selected marker cannot be reselected by clicking on it at its new position.

**Root Cause**: 
- DataPoint components receive `data` props that include the marker's stamp (position)
- After dragging, the actual keypoint stamps in the store are updated
- However, the DataPoint component instances still hold the old `data` prop with stale stamp values
- When clicking on a dragged marker, the onClick handler computes fresh frames but the component's `data` prop reference is stale
- This mismatch prevents proper marker identification and selection

**Current Workaround**: Users can:
- Click elsewhere first, then click the marker
- Use keyboard shortcuts for selection
- Select other markers first

**Why This Architecture Solves It**:
The proposed store-based architecture eliminates this issue by:
- Having components always subscribe to computed state from the store
- Eliminating stale prop references through reactive subscriptions
- Ensuring virtual positions are consistently applied across all components
- Managing all selection logic in the store rather than in components

This bug is a perfect example of why moving computation and state management to the store is necessary.

## Architecture Overview

### Implemented Store Structure

```typescript
interface AnimationData {
  // Core state
  tracks: Record<string, Track<RawValue>>;
  selection: InstancedFrameInfo[];
  referenceMarker: { marker: InstancedFrameInfo; sources: Source[] } | null;
  
  // Implemented: Drag state
  dragState: DragState | null;
  
  // Implemented: Computed state (different structure than proposed)
  computedRowData: Record<string, ComputedRowData>;  // Indexed by sourceRowId
  
  // Additional implemented features
  instancedTrackSources: Record<string, SourceRow>;
  sourcesByAnimationInstance: Record<string, Source[]>;
  editorViews: Record<string, View>;
}

// Implemented types
interface DragState {
  isDragging: boolean;
  draggedKeypoints: Map<string, DraggedKeypoint>;
  startPositions: Map<string, number>;
  deltaStamp: number;
}

interface DraggedKeypoint {
  trackId: string;
  keypointId: string;
  originalStamp: number;
  currentOffset: number;
}

interface ComputedRowData {
  virtualFrames: InstancedFrameInfo[];      // ✅ Implemented with drag support
  interpolations: InstancePair[];           // ✅ Implemented
  verticalBounds: { min: number; max: number }; // ✅ Implemented
  violationSet: ViolationSet;              // ✅ Implemented
  // Note: interpolators not yet moved to computed data
}
```

## Implementation Details

### Drag State Management (Implemented but Disabled)

The following actions are fully implemented in `/src/actions/drag/` but temporarily commented out in the store:

```typescript
// Store actions (currently disabled in /src/store.ts)
interface AnimationActions {
  // startDragging: (selection?: InstancedFrameInfo[]) => void;  // ⚠️ Commented
  // updateDragDelta: (deltaStamp: number, snapToFrames: boolean) => void; // ⚠️ Commented
  // commitDrag: () => void;  // ⚠️ Commented
  // cancelDrag: () => void;  // ⚠️ Commented
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

### Computed State in Store (Implemented)

```typescript
// Actual implementation in /src/functions/compute-row-data.ts
export function computeRowData(
  sourceRow: SourceRow,
  tracks: Record<string, Track<RawValue>>,
  violations: Record<string, Violation[]>,
  animatables: Record<string, AnimatableValue>,
  dragState: DragState | null,
): ComputedRowData {
  const trackIds = uniq(sourceRow.data.map((t) => t.trackId));
  const filteredViolations = pick(violations, trackIds);
  const violationSet = computeViolationSet(filteredViolations);
  const relevantTracks = pick(tracks, trackIds);
  
  // ✅ Virtual frames with drag support
  const virtualFrames = computeVirtualFrames(relevantTracks, sourceRow, dragState);
  
  // ✅ Transitions and interpolations
  const explicitInterpolationSegments = computeTransitionSegments(virtualFrames, trackIds);
  const interpolations = computeFilledInterpGaps(explicitInterpolationSegments);
  
  // ✅ Vertical bounds
  const verticalBounds = computeVerticalBounds(relevantTracks, animatables, [sourceRow]);

  return {
    violationSet,
    virtualFrames,
    interpolations,
    verticalBounds: { min: verticalBounds[0], max: verticalBounds[1] },
  };
}

// Virtual frame computation with drag offsets
export function computeVirtualFrames(
  tracks: Record<string, Track<RawValue>>,
  sourceRow: SourceRow,
  dragState: DragState | null,
): InstancedFrameInfo[] {
  if (!dragState?.isDragging) {
    return computeFrames(tracks, sourceRow);
  }
  
  // ✅ Apply virtual drag offsets
  const virtualTracks = applyDragOffsets(tracks, dragState);
  
  // ✅ Compute frames with drag prevention
  const draggedKeypointIds = Array.from(dragState.draggedKeypoints.keys());
  return computeFrames(virtualTracks, sourceRow, draggedKeypointIds);
}

// Actual implementation in /src/functions/apply-drag-offsets.ts
export function applyDragOffsets(
  tracks: Record<string, Track<RawValue>>,
  dragState: DragState
): Record<string, Track<RawValue>> {
  return produce(tracks, (draft) => {
    dragState.draggedKeypoints.forEach((dragInfo) => {
      const track = draft[dragInfo.trackId];
      if (!track) return;

      const point = track.points.find((p) => p.id === dragInfo.keypointId);
      if (point) {
        const newStamp = dragInfo.originalStamp + dragInfo.currentOffset;
        
        // ✅ Input validation
        if (!isFinite(newStamp)) {
          console.warn(`Invalid position for keypoint ${dragInfo.keypointId}:`, newStamp);
          return;
        }
        
        // ✅ Clamp to [0, 1] normalized range
        const clampedStamp = Math.max(0, Math.min(1, newStamp));
        point.stamp = clampedStamp;
      }
    });

    // ✅ Re-sort points to maintain chronological order
    Object.values(draft).forEach((track) => {
      track.points.sort((a, b) => a.stamp - b.stamp);
    });
  });
}
```

### Store Subscription Pattern (Implemented)

```typescript
// Actual implementation in /src/subscriptions/update-computed-row-data.ts
export function updateComputedRowData(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      dragState: state.dragState,
      violations: state.violations,
      tracks: state.tracks,
      instancedTrackSources: state.instancedTrackSources,
      animatables: state.animatables,
    }),
    ({ dragState, violations, tracks, instancedTrackSources, animatables }) => {
      const computedRowData: Record<string, ComputedRowData> = {};

      // ✅ Compute data for each source row
      Object.values(instancedTrackSources).forEach((instancedTrackSource) => {
        const rowComputedData = computeRowData(
          instancedTrackSource,
          tracks,
          violations,
          animatables,
          dragState,
        );
        computedRowData[instancedTrackSource.id] = rowComputedData;
      });

      set({ computedRowData });
    },
    {
      // ✅ Equality checking for performance
      equalityFn: (a, b) => {
        return (
          shallow(a.dragState, b.dragState) &&
          shallow(a.violations, b.violations) &&
          shallow(a.tracks, b.tracks) &&
          shallow(a.instancedTrackSources, b.instancedTrackSources) &&
          shallow(a.animatables, b.animatables)
        );
      },
      // Note: Debouncing not yet implemented
    },
  );
}
```

## Component Updates

### Current DataRenderer (Simplified)
```typescript
// Actual implementation in /src/components/canvas-sheet/data-renderer.tsx
export const DataRenderer = memo(function DataRenderer({
  sourceRowId,
  // ... other props
}) {
  // ✅ Subscribe to computed data from store
  const sourceRow = useAnimationStore(
    useShallow((state: AnimationData) => state.instancedTrackSources[sourceRowId]),
  );
  const computedData = useAnimationStore(
    useShallow((state: AnimationData) => state.computedRowData[sourceRowId]),
  );
  
  return (
    <group>
      {/* ✅ Using virtualFrames from computed data */}
      <DataPointsRenderer
        sourceRow={sourceRow}
        frames={computedData.virtualFrames}
        verticalBounds={computedData.verticalBounds}
        // ... other props
      />
      
      {/* ✅ Using interpolations from computed data */}
      {computedData.interpolations.map((segment, index) => (
        <TransitionSegment
          key={`${segment.start.id}-${segment.end.id}-${index.toString()}`}
          // ... segment props
        />
      ))}
      
      {/* ✅ Using violationSet from computed data */}
      <ViolationRenderer violationSet={computedData.violationSet} />
    </group>
  );
});
```

### Remaining Issue
- DataPoint components still receive frame data as props
- This can cause stale reference issues after drag operations
- Solution: Update DataPoint to subscribe directly to store

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

## Current Status & Next Steps

### Completed ✅
- Store structure with `dragState` and `computedRowData`
- Virtual frame computation with drag support
- Drag offset application with clamping
- Store subscriptions for computed data
- Component simplification (DataRenderer)

### In Progress ⚠️
- Drag actions implemented but disabled
- Selection system implemented but disabled
- Components partially updated

### Next Steps

#### Step 1: Enable Core Functionality (1 day)
- Uncomment drag actions in `/src/actions/drag/index.ts`
- Enable drag actions in store
- Enable `clickMarker` action
- Connect UI event handlers

#### Step 2: Complete Component Integration (1-2 days)
- Update DataPoint to use store actions
- Remove prop-based frame data passing
- Add drag event handlers
- Fix stale reference issues

#### Step 3: Implement Dual Interpolators (1 day)
- Create base and virtual interpolators
- Update player subscriptions
- Test immediate visual feedback

#### Step 4: Testing & Validation (1-2 days)
- Marker reselection after drag
- Multi-selection scenarios
- Performance benchmarks
- Edge case testing

### Documentation
- `docs/implementation-status.md` - Current implementation status
- `docs/migration-checklist.md` - Detailed checklist
- `src/tests/drag-*.test.ts` - Drag functionality tests

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
6. **Resolution of known bugs** like the marker selection after drag issue

The investment in this architecture will pay dividends as the application grows, making future features easier to implement and maintain.

## Critical Issues to Resolve

The following issues MUST be resolved during the Phase 2+ implementation:

1. **Stale Props Issue**: Ensure no component holds stale references to data after store updates
2. **Selection Persistence**: Maintain proper selection state through all drag operations
3. **Component Lifecycle**: Properly manage component updates when virtual state changes
4. **Performance**: Monitor re-render frequency during drag operations

## Related Documentation

- `docs/implementation-status.md` - **NEW: Detailed implementation status report**
- `docs/migration-checklist.md` - Updated checklist for remaining work
- `src/actions/drag/` - Implemented drag actions (currently disabled)
- `src/functions/compute-row-data.ts` - Core computation logic
- `src/functions/compute-virtual-frames.ts` - Virtual frame computation
- `src/functions/apply-drag-offsets.ts` - Drag offset application
- `src/subscriptions/update-computed-row-data.ts` - Store subscription pattern