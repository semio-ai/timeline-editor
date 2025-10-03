# Points-Based ClickMarker Implementation Proposal

## Executive Summary

Refactor `clickMarker` to accept the actual point data from the clicked marker instead of just path identifiers. This eliminates ambiguity around instance selection and fixes the global marker selection bug.

## Current vs Proposed Signature

### Current (Path-based)
```typescript
clickMarker: (
  markerId: string, 
  sourceRowId: string, 
  shift?: boolean, 
  mod?: boolean
) => void
```

### Proposed (Points-based)
```typescript
clickMarker: (
  clickedPoints: SourceRowData[],  // Points that were clicked
  markerPath: string,               // Full path for reference tracking
  shift?: boolean,
  mod?: boolean
) => void
```

## Implementation Changes

### 1. Update Store Action Interface

```typescript
// In packages/animation/src/store-types.ts

export interface AnimationActions {
  // ... other actions ...
  
  clickMarker: (
    clickedPoints: SourceRowData[],
    markerPath: string,
    shift?: boolean,
    mod?: boolean
  ) => void;
  
  // For backward compatibility during migration
  clickMarkerLegacy: (
    markerId: string,
    sourceRowId: string,
    shift?: boolean,
    mod?: boolean
  ) => void;
}
```

### 2. Update Click Handler in DataPoint Component

```typescript
// In packages/animation/src/components/canvas-sheet/data-point.tsx

onClick: ({ event, shiftKey, metaKey }) => {
  if (playing || justFinishedDragging.current) return;
  event.stopPropagation();
  
  // Filter to only selectable points
  const selectablePoints = points.filter(p => p.selectable !== false);
  
  // Create the marker path for reference tracking
  const markerPath = createMarkerPath(sourceRowId, markerId);
  
  // Log for debugging
  console.log("Clicking with points:", {
    markerPath,
    selectablePoints,
    allPoints: points,
    shiftKey,
    metaKey
  });
  
  // Call with actual point data
  clickMarker(
    selectablePoints,
    markerPath,
    shiftKey,
    metaKey || event.ctrlKey
  );
}
```

### 3. Refactor clickMarkerAction

```typescript
// In packages/animation/src/actions/click-marker.ts

export function clickMarkerAction(
  state: AnimationData,
  clickedPoints: SourceRowData[],
  markerPath: string,
  shift?: boolean,
  mod?: boolean
): Partial<AnimationData> {
  // Extract instance from clicked points
  const clickedInstances = new Set(
    clickedPoints
      .filter(p => p.instanceId)
      .map(p => p.instanceId)
  );
  
  // Determine target instance
  let targetInstance: string | undefined;
  
  if (clickedInstances.size === 1) {
    // Single instance clicked - use it
    targetInstance = [...clickedInstances][0];
  } else if (clickedInstances.size > 1) {
    // Multiple instances - prefer active, or use first
    targetInstance = state.activeAnimationInstance || [...clickedInstances][0];
  } else {
    // No instance info (shouldn't happen with proper points)
    targetInstance = state.activeAnimationInstance;
  }
  
  // Check if switching instances
  if (state.activeAnimationInstance && 
      targetInstance && 
      targetInstance !== state.activeAnimationInstance) {
    // Instance switch - clear selection and select only new instance's markers
    const selectionPaths = findPathsContainingPoints(
      state, 
      clickedPoints.filter(p => p.instanceId === targetInstance)
    );
    
    return {
      activeAnimationInstance: targetInstance,
      selectionState: updateSelectionState(state, selectionPaths, markerPath)
    };
  }
  
  // Same instance - handle modifier keys
  const currentSelection = state.selectionState || createEmptySelectionState();
  
  // Find all paths that contain ANY of the clicked points
  const selectionUnit = findPathsContainingPoints(state, clickedPoints);
  
  if (mod && !shift) {
    // Toggle selection
    const allSelected = selectionUnit.every(path => 
      currentSelection.pathSet.has(path)
    );
    
    const newPaths = allSelected
      ? removeFromSelection(currentSelection, selectionUnit)
      : addToSelection(currentSelection, selectionUnit);
    
    return {
      selectionState: updateSelectionState(state, newPaths, markerPath)
    };
  }
  
  if (shift && currentSelection.referenceMarker) {
    // Range selection
    const rangePaths = getRangeSelection(
      state, 
      currentSelection.referenceMarker, 
      markerPath,
      targetInstance // Only select within target instance
    );
    
    return {
      selectionState: updateSelectionState(
        state, 
        mod ? addToSelection(currentSelection, rangePaths) : rangePaths,
        currentSelection.referenceMarker
      )
    };
  }
  
  // Simple click - replace selection
  return {
    selectionState: updateSelectionState(state, selectionUnit, markerPath),
    activeAnimationInstance: targetInstance || state.activeAnimationInstance
  };
}
```

### 4. New Helper Function: findPathsContainingPoints

```typescript
// In packages/animation/src/functions/selection-state-manager.ts

/**
 * Find all marker paths that contain the specified points
 */
export function findPathsContainingPoints(
  state: AnimationData,
  targetPoints: SourceRowData[]
): string[] {
  const paths: string[] = [];
  
  // Create point signatures for efficient matching
  const targetSignatures = new Set(
    targetPoints.map(p => createPointSignature(p))
  );
  
  // Search all computed row data
  for (const [rowPath, rowData] of Object.entries(state.computedRowData)) {
    for (const frame of rowData.virtualFrames || []) {
      if (!frame.points || frame.points.length === 0) continue;
      
      // Check if this frame contains ANY of our target points
      const hasTargetPoint = frame.points.some(p => 
        targetSignatures.has(createPointSignature(p))
      );
      
      if (hasTargetPoint) {
        // Check if ALL points in this frame are covered by our targets
        const frameSignatures = frame.points.map(p => createPointSignature(p));
        const allPointsCovered = frameSignatures.every(sig => 
          targetSignatures.has(sig)
        );
        
        // Add to selection if:
        // 1. All points are covered (exact match), OR
        // 2. This is a single-point frame that matches (subset match)
        if (allPointsCovered || frame.points.length === 1) {
          paths.push(createMarkerPath(rowPath, frame.id));
        }
      }
    }
  }
  
  return paths;
}

/**
 * Create a unique signature for a point
 */
function createPointSignature(point: SourceRowData): string {
  return `${point.namespaceId}/${point.instanceId}/${point.trackId}/${point.attribute || ''}#${point.id}`;
}
```

### 5. Update Store Implementation

```typescript
// In packages/animation/src/store.ts

clickMarker: (clickedPoints, markerPath, shift, mod) => {
  set((state: AnimationData) => {
    const result = clickMarkerAction(
      state, 
      clickedPoints, 
      markerPath, 
      shift, 
      mod
    );
    return {
      ...state,
      ...result,
    };
  });
},

// Keep legacy version for migration period
clickMarkerLegacy: (markerId, sourceRowId, shift, mod) => {
  const state = get();
  const rowData = state.computedRowData[sourceRowId];
  const marker = rowData?.virtualFrames.find(f => f.id === markerId);
  
  if (!marker?.points) {
    // Fallback to empty selection
    set({ selectionState: createEmptySelectionState() });
    return;
  }
  
  // Convert to new format
  const selectablePoints = marker.points.filter(p => p.selectable !== false);
  const markerPath = createMarkerPath(sourceRowId, markerId);
  
  state.clickMarker(selectablePoints, markerPath, shift, mod);
},
```

## Benefits of This Implementation

### 1. Fixes Global Marker Selection
Global markers work correctly because we use the actual points to determine selection:
```typescript
// Clicking global marker with mixed instances
clickedPoints: [
  { instanceId: "alpha-shared", selectable: true },
  { instanceId: "beta-shared", selectable: false }
]
// Only the alpha-shared point is passed (filtered by selectable)
// Selection correctly includes both global and alpha track markers
```

### 2. Clearer Instance Switching
Instance determination is unambiguous:
```typescript
// We know exactly which instance(s) were clicked
const clickedInstances = new Set(clickedPoints.map(p => p.instanceId));
// No need to parse paths or guess from marker IDs
```

### 3. Respects Selectable Flag
The component filters points before passing them:
```typescript
const selectablePoints = points.filter(p => p.selectable !== false);
// Only selectable points participate in selection
```

### 4. Simpler Selection Logic
No complex instance filtering needed:
```typescript
// Old: Complex filtering with special cases
const instanceFilteredUnit = selectionUnit.filter((path) => {
  const parsed = parseMarkerPath(path);
  // Complex logic for global markers...
});

// New: Points tell us what to select
const selectionUnit = findPathsContainingPoints(state, clickedPoints);
// No filtering needed - points already contain instance info
```

## Migration Strategy

### Phase 1: Add New Implementation (Week 1)
- Implement new `clickMarker` with points signature
- Keep legacy version as `clickMarkerLegacy`
- Update DataPoint component to use new version
- Add comprehensive tests

### Phase 2: Update Other Components (Week 2)
- Find all other uses of clickMarker
- Update to use points-based approach
- Ensure backward compatibility

### Phase 3: Deprecate Legacy (Week 3)
- Mark legacy version as deprecated
- Add console warnings
- Update documentation

### Phase 4: Remove Legacy (Week 4+)
- Remove legacy implementation
- Clean up related code
- Final testing

## Test Cases

### 1. Global Marker Selection
```typescript
it("should select both global and track markers when clicking global marker", () => {
  const globalPoints = [
    { id: "o1", instanceId: "alpha-shared", selectable: true },
    { id: "o1", instanceId: "beta-shared", selectable: false }
  ];
  
  clickMarker(
    globalPoints.filter(p => p.selectable),
    "global#o1-o1"
  );
  
  // Should select:
  // - global#o1-o1 (the global marker)
  // - namespace-alpha/alpha-shared/opacity#o1 (the track marker)
  // Should NOT select:
  // - namespace-beta/beta-shared/opacity#o1 (not selectable)
});
```

### 2. Instance Switching
```typescript
it("should switch instances when clicking different instance marker", () => {
  state.activeAnimationInstance = "alpha-shared";
  
  const betaPoints = [
    { id: "o1", instanceId: "beta-shared", selectable: true }
  ];
  
  clickMarker(betaPoints, "namespace-beta/beta-shared/opacity#o1");
  
  // Should switch to beta-shared instance
  // Should clear previous selection
  // Should select only beta markers
});
```

### 3. Multi-Point Selection
```typescript
it("should select all markers containing clicked points", () => {
  const vectorPoints = [
    { id: "px1", instanceId: "alpha", trackId: "position", attribute: "x" },
    { id: "px1", instanceId: "alpha", trackId: "position", attribute: "y" },
    { id: "px1", instanceId: "alpha", trackId: "position", attribute: "z" }
  ];
  
  clickMarker(vectorPoints, "namespace-alpha/alpha/position#px1");
  
  // Should select:
  // - The position group marker
  // - All three attribute markers (x, y, z)
  // - Any global markers containing these points
});
```

## Conclusion

The points-based approach provides a cleaner, more performant, and less ambiguous way to handle marker selection. It eliminates the global marker bug entirely and simplifies the codebase significantly.