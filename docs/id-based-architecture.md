# ID-Based Architecture for Drag & Selection

## Executive Summary

This document outlines a refactoring of the drag and selection systems to use ID-based references instead of passing full data objects. This approach eliminates stale data issues entirely by ensuring all logic operates on fresh data looked up from the store using stable IDs.

## The Problem: Stale Data References

### Current Issue
```typescript
// Current problematic pattern
clickMarker: (
  markerInfo: InstancedFrameInfo,  // Full data object - can be stale
  sources: Source[],                // Full data array - can be stale
  allMarkerInfo: InstancedFrameInfo[], // Full data array - can be stale
  shift?: boolean,
  mod?: boolean,
) => { /* ... */ }
```

When components pass full data objects to store actions:
1. The data is captured at render time
2. If the store updates (e.g., after a drag), the component still holds old references
3. Actions operate on stale data, causing bugs like inability to select recently dragged markers

## The Solution: ID-Based References

### New Pattern
```typescript
// ID-based approach - always fresh
clickMarker: (
  markerId: string,      // Just an ID
  sourceRowId: string,   // Just an ID
  shift?: boolean,
  mod?: boolean,
) => {
  // Look up fresh data inside the store
  const state = get();
  const sourceRow = state.instancedTrackSources[sourceRowId];
  const computedData = state.computedRowData[sourceRowId];
  const markerInfo = computedData.virtualFrames.find(f => f.id === markerId);
  
  if (!markerInfo) return;
  
  // Extract instance ID from the marker's points (SourceRowData)
  const clickedInstanceId = markerInfo.points[0]?.instanceId;
  
  // Check if we need to switch animation instances
  if (clickedInstanceId && state.activeAnimationInstance !== clickedInstanceId) {
    // Different instance - clear selection and switch context
    return {
      selection: [{
        markerId: markerInfo.id,
        sourceRowId: sourceRowId,
        instanceId: clickedInstanceId,
        stamp: markerInfo.stamp,
      }],
      referenceMarker: {
        markerId: markerInfo.id,
        sourceRowId: sourceRowId,
        instanceId: clickedInstanceId,
      },
      activeAnimationInstance: clickedInstanceId,
    };
  }
  
  // Same instance - allow multi-selection
  const result = computeMarkerSelection(
    markerInfo,
    sourceRow,
    computedData.virtualFrames,
    state.selection,
    state.referenceMarker,
    shift,
    mod,
  );
  
  return {
    selection: result.selection,
    referenceMarker: result.reference,
  };
}
```

## Architecture Changes Required

### 1. Store Actions Refactoring

#### Selection Action
```typescript
interface AnimationActions {
  // OLD: Receives full objects
  clickMarker: (
    markerInfo: InstancedFrameInfo,
    sources: Source[],
    allMarkerInfo: InstancedFrameInfo[],
    shift?: boolean,
    mod?: boolean,
  ) => void;
  
  // NEW: Receives only IDs
  clickMarker: (
    markerId: string,
    sourceRowId: string,
    shift?: boolean,
    mod?: boolean,
  ) => void;
}
```

#### Drag Actions
```typescript
interface AnimationActions {
  // OLD: Receives selection array
  startDragging: (selection?: InstancedFrameInfo[]) => void;
  
  // NEW: Uses current selection from store or receives IDs
  startDragging: (markerIds?: string[]) => void;
  
  // No changes needed for these - already ID-based internally
  updateDragDelta: (deltaStamp: number, snapToFrames: boolean) => void;
  commitDrag: () => void;
  cancelDrag: () => void;
}
```

### 2. Selection System Update

```typescript
// Updated selection storage to use IDs
interface AnimationData {
  // OLD: Stores full frame objects
  selection: InstancedFrameInfo[];
  
  // NEW: Stores marker IDs with source and instance context
  selection: SelectionEntry[];
  
  // Reference marker also becomes ID-based with instance
  referenceMarker: {
    markerId: string;
    sourceRowId: string;
    instanceId: string;  // Animation instance this belongs to
    isAddMode?: boolean;
  } | null;
  
  // Track which animation instance is active for selection
  activeAnimationInstance?: string;
}

interface SelectionEntry {
  markerId: string;
  sourceRowId: string;
  instanceId: string;  // Animation instance for selection boundary
  // Cache frequently needed data to avoid constant lookups
  stamp?: number;  // Optional cached value
  trackIds?: string[]; // Optional cached track IDs
}
```

### 3. Helper Functions

```typescript
// Helper to get fresh marker data
function getMarkerById(
  state: AnimationData,
  markerId: string,
  sourceRowId: string
): InstancedFrameInfo | undefined {
  const computedData = state.computedRowData[sourceRowId];
  if (!computedData) return undefined;
  
  return computedData.virtualFrames.find(f => f.id === markerId);
}

// Helper to get instance ID from marker
function getMarkerInstanceId(marker: InstancedFrameInfo): string | undefined {
  // Instance ID is stored in SourceRowData of each point
  return marker.points[0]?.instanceId;
}

// Helper to check if markers are in same instance
function markersInSameInstance(
  marker1: InstancedFrameInfo,
  marker2: InstancedFrameInfo
): boolean {
  const instance1 = getMarkerInstanceId(marker1);
  const instance2 = getMarkerInstanceId(marker2);
  return instance1 === instance2;
}

// Helper to filter selection by animation instance
function getSelectionForInstance(
  state: AnimationData,
  instanceId: string
): SelectionEntry[] {
  return state.selection.filter(entry => entry.instanceId === instanceId);
}

// Helper to get all markers for a source row
function getMarkersForSourceRow(
  state: AnimationData,
  sourceRowId: string
): InstancedFrameInfo[] {
  const computedData = state.computedRowData[sourceRowId];
  return computedData?.virtualFrames || [];
}

// Helper to convert selection IDs to frame objects when needed
function getSelectionFrames(state: AnimationData): InstancedFrameInfo[] {
  return state.selection
    .map(entry => getMarkerById(state, entry.markerId, entry.sourceRowId))
    .filter((frame): frame is InstancedFrameInfo => frame !== undefined);
}
```

### 4. Component Updates

```typescript
// DataPoint component simplified
export const DataPoint = memo(function DataPoint({
  markerId,
  sourceRowId,
  // ... visual props only
}) {
  const store = useAnimationStore();
  
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    const { shiftKey, metaKey, ctrlKey } = e.nativeEvent;
    
    // Just pass IDs - no data lookup needed in component
    store.clickMarker(
      markerId,
      sourceRowId,
      shiftKey,
      metaKey || ctrlKey
    );
  }, [markerId, sourceRowId]);
  
  // Subscribe to just what's needed for rendering
  const isSelected = useAnimationStore(
    useShallow(state => 
      state.selection.some(s => s.markerId === markerId)
    )
  );
  
  const visualData = useAnimationStore(
    useShallow(state => {
      const computed = state.computedRowData[sourceRowId];
      return computed?.virtualFrames.find(f => f.id === markerId);
    })
  );
  
  // Render based on fresh data
  return <Instance /* ... */ />;
});
```

### 5. Drag Implementation Updates

```typescript
function startDragging(state: AnimationData, markerIds?: string[]): void {
  // If no IDs provided, use current selection
  const idsToUse = markerIds || state.selection.map(s => s.markerId);
  
  if (idsToUse.length === 0) return;
  
  const draggedKeypoints = new Map<string, DraggedKeypoint>();
  const startPositions = new Map<string, number>();
  
  // Look up fresh data for each marker ID
  idsToUse.forEach(markerId => {
    // Find the marker across all source rows
    for (const [sourceRowId, computedData] of Object.entries(state.computedRowData)) {
      const frame = computedData.virtualFrames.find(f => f.id === markerId);
      if (frame) {
        frame.points.forEach(point => {
          draggedKeypoints.set(point.id, {
            trackId: point.trackId,
            keypointId: point.id,
            originalStamp: frame.stamp,
            currentOffset: 0,
          });
          startPositions.set(point.id, frame.stamp);
        });
        break; // Found the marker
      }
    }
  });
  
  state.dragState = {
    isDragging: true,
    draggedKeypoints,
    startPositions,
    deltaStamp: 0,
  };
}
```

## Benefits of ID-Based Architecture

### 1. Eliminates Stale Data
- Components never hold data references
- All operations use fresh data from store
- No sync issues between renders and store updates

### 2. Simplified Components
- Components only need to know IDs
- No complex prop drilling of data objects
- Cleaner separation of concerns

### 3. Better Performance
- Smaller props (just strings instead of objects)
- More efficient React reconciliation
- Precise subscriptions using IDs

### 5. Improved Testability
- Actions can be tested with just IDs
- No need to construct complex data objects
- Easier to mock and verify

### 6. Enables Advanced Features
- Undo/redo just stores ID references
- Collaborative editing only syncs IDs
- Efficient serialization for persistence

### 7. Animation Instance Boundaries
- Selection automatically respects instance boundaries
- Switching instances clears incompatible selections
- Multi-selection only works within same instance
- Clear visual feedback about selection context

## Migration Strategy

### Phase 1: Update Store Actions (2 hours)
1. Refactor `clickMarker` to use IDs and handle instance switching
2. Update `startDragging` to use IDs and respect instance boundaries
3. Add helper functions for ID lookups and instance checking
4. Update selection state structure with instance tracking
5. Add `activeAnimationInstance` to store state

### Phase 2: Update Components (2 hours)
1. Modify DataPoint to pass only IDs
2. Update selection rendering to use ID lookups
3. Remove data prop drilling
4. Add ID-based subscriptions

### Phase 3: Testing & Validation (2 hours)
1. Verify selection after drag works
2. Test multi-selection scenarios
3. Performance profiling
4. Edge case testing

## Implementation Checklist

- [ ] Refactor `clickMarker` action signature
- [ ] Update `startDragging` action signature
- [ ] Convert selection storage to ID-based with instance tracking
- [ ] Add ID lookup helper functions
- [ ] Add instance boundary validation functions
- [ ] Update DataPoint component
- [ ] Add activeAnimationInstance state management
- [ ] Update DataPointsRenderer component
- [ ] Remove data prop drilling
- [ ] Update tests to use ID-based approach
- [ ] Verify no stale data issues remain
- [ ] Document API changes

## Example Usage After Migration

```typescript
// Component usage - clean and simple
<DataPoint
  markerId="frame-123"
  sourceRowId="row-456"
  // Just visual props
  theme={theme}
  height={36}
/>

// Store action usage - always fresh with instance handling
store.clickMarker("frame-123", "row-456", false, true);
// Automatically switches activeAnimationInstance if needed

// Selection check - efficient and instance-aware
const isSelected = store.selection.some(s => 
  s.markerId === "frame-123" && 
  s.instanceId === store.activeAnimationInstance
);

// Get selection for current instance only
const currentInstanceSelection = store.selection.filter(
  s => s.instanceId === store.activeAnimationInstance
);

// Drag initiation - uses selection from current instance
store.startDragging(); // Uses current instance selection
store.startDragging(["frame-123", "frame-456"]); // Validates same instance
```

## Selection Rules with Animation Instances

### Core Selection Constraints

1. **Single Instance Selection**: Multi-selection is only allowed within the same animation instance
2. **Instance Switching**: Clicking a marker in a different instance:
   - Sets `activeAnimationInstance` to the new instance
   - Clears existing selection
   - Selects only the clicked marker
3. **Shift-Click Range**: Only works within the same instance as the reference marker
4. **Ctrl-Click Toggle**: Can work across instances but switches active instance
5. **Drag Operations**: Only drag markers from the same instance together

### Instance Information Flow

The instance ID flows through the system via:
```
InstancedFrameInfo 
  → points: SourceRowData[] 
    → instanceId: string
```

This means every marker inherently knows its animation instance, making boundary enforcement natural and efficient.

## Conclusion

The ID-based architecture provides a robust solution to the stale data problem while simplifying the codebase and enabling advanced features. By using stable IDs as references and looking up fresh data within store actions, we ensure data consistency without complex synchronization logic.

The animation instance boundaries add an important constraint that prevents invalid multi-selections across different animation contexts. This aligns with the hierarchical organization of animations and ensures operations remain meaningful within their animation scope.

This approach aligns with React best practices, improves performance, and creates a cleaner separation between UI components and business logic. The migration is straightforward and can be completed incrementally with minimal risk.