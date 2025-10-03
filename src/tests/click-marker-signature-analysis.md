# ClickMarker Signature Analysis: Path-based vs Points-based Approach

## Current Approach: Path-based

### Current Signature
```typescript
clickMarker: (markerId: string, sourceRowId: string, shift?: boolean, mod?: boolean) => void
```

### Current Flow
1. Component passes `markerId` and `sourceRowId` (the path components)
2. `clickMarkerAction` looks up fresh data from store using these IDs
3. Tries to determine what points are involved
4. Uses `getSelectionUnit` to find all related markers
5. Filters by instance (which fails for global markers)
6. Stores selection as paths

### Problems with Current Approach

#### 1. Loss of Context
When clicking a global marker with multiple points:
```typescript
// What we clicked (from the component):
{
  markerId: "o1-o1",
  sourceRowId: "global",
  points: [
    { id: "o1", instanceId: "alpha-shared-instance", selectable: true },
    { id: "o1", instanceId: "beta-shared-instance", selectable: false }
  ]
}

// What clickMarker receives:
markerId: "o1-o1"
sourceRowId: "global"
// Lost: Which points were actually selectable, which instance they belong to
```

#### 2. Ambiguity in Instance Determination
- Global markers have no instanceId in their path
- Must re-derive which instance was clicked from the data lookup
- Can't distinguish between clicking selectable vs non-selectable points

#### 3. Redundant Data Lookups
```typescript
// In clickMarkerAction:
const sourceRow = state.instancedTrackSources[sourceRowId];  // Lookup 1
const computedData = state.computedRowData[sourceRowId];      // Lookup 2
const markerInfo = computedData?.virtualFrames.find(f => f.id === markerId); // Lookup 3
```

#### 4. Complex Selection Unit Logic
The `getSelectionUnit` function must reconstruct which points were involved and find all related markers, leading to complex matching logic.

## Proposed Approach: Points-based

### Proposed Signature
```typescript
clickMarker: (
  clickedPoints: SourceRowData[],  // The actual points that were clicked
  markerPath: string,               // For reference marker tracking
  shift?: boolean,
  mod?: boolean
) => void
```

### Proposed Flow
1. Component passes the actual points data that was clicked
2. `clickMarkerAction` uses points to determine:
   - Which instance(s) are involved
   - Which points are selectable
   - What needs to be selected
3. Finds all paths that contain these points
4. Stores selection as paths (unchanged)

### Example Implementation
```typescript
// Component (data-point.tsx)
const handleClick = (e: MouseEvent) => {
  // Pass the actual points that were clicked
  const selectablePoints = data.points.filter(p => p.selectable);
  const markerPath = createMarkerPath(sourceRowId, markerId);
  
  store.clickMarker(
    selectablePoints,  // Only the selectable points
    markerPath,        // For reference tracking
    e.shiftKey,
    e.metaKey
  );
};

// Store action
clickMarker: (clickedPoints, markerPath, shift, mod) => {
  set((state) => {
    // Determine instance from the points themselves
    const clickedInstances = new Set(clickedPoints.map(p => p.instanceId));
    
    // For global markers, we now know exactly which instance was intended
    const targetInstance = clickedInstances.size === 1 
      ? [...clickedInstances][0]
      : state.activeAnimationInstance;
    
    // Find all paths containing these exact points
    const selectionUnit = findPathsWithPoints(state, clickedPoints);
    
    // No ambiguous instance filtering needed!
    return {
      selectionState: updateSelectionState(state, selectionUnit, markerPath),
      activeAnimationInstance: targetInstance
    };
  });
};
```

## Performance Analysis

### Current Approach Performance
- **O(n)** lookups in `clickMarkerAction` to find data
- **O(m * p)** in `getSelectionUnit` where m = markers, p = points per marker
- Complex string parsing and path reconstruction
- Multiple passes through data structures

### Proposed Approach Performance
- **O(1)** - No initial lookups needed (data passed directly)
- **O(m * p)** for finding paths with matching points (similar to current)
- No string parsing for instance detection
- Single pass through data structures

### Memory Impact
- **Current**: Minimal - only passes two strings
- **Proposed**: Slightly higher - passes array of point objects
- **Trade-off**: Minor memory increase for significant clarity and performance gains

## Benefits of Points-based Approach

### 1. Unambiguous Instance Context
```typescript
// We know exactly what was clicked
clickedPoints: [
  { instanceId: "alpha-shared-instance", selectable: true, ... }
]
// No need to guess or derive the instance
```

### 2. Respects Selectable Flag
Only selectable points are passed, eliminating the need to filter later:
```typescript
// Current: Must check selectable during selection
if (point.selectable && point.instanceId === activeInstance) { ... }

// Proposed: Already filtered at click time
const selectablePoints = points.filter(p => p.selectable);
```

### 3. Simplified Global Marker Handling
No special cases needed for global markers:
```typescript
// The points tell us everything we need
const hasAlphaPoints = clickedPoints.some(p => p.instanceId === "alpha-shared-instance");
const hasBetaPoints = clickedPoints.some(p => p.instanceId === "beta-shared-instance");
```

### 4. Better Separation of Concerns
- **UI Layer**: Determines what was clicked (the points)
- **Store Layer**: Determines what to select (the paths)
- **Selection State**: Stores the selection (as paths)

## Implementation Strategy

### Phase 1: Add Points Parameter
```typescript
// Keep backward compatibility
clickMarker: (
  markerIdOrPoints: string | SourceRowData[],
  sourceRowId?: string,
  shiftOrPath?: boolean | string,
  mod?: boolean
) => void
```

### Phase 2: Migrate Components
Update components to pass points instead of IDs:
```typescript
// Old
store.clickMarker(markerId, sourceRowId, shift, mod);

// New
store.clickMarker(selectablePoints, markerPath, shift, mod);
```

### Phase 3: Simplify Selection Logic
Remove complex instance filtering and path reconstruction:
```typescript
function findPathsWithPoints(state: AnimationData, points: SourceRowData[]): string[] {
  const paths: string[] = [];
  const pointSignatures = new Set(points.map(p => createPointSignature(p)));
  
  for (const [rowPath, rowData] of Object.entries(state.computedRowData)) {
    for (const frame of rowData.virtualFrames) {
      if (frame.points?.some(p => pointSignatures.has(createPointSignature(p)))) {
        paths.push(createMarkerPath(rowPath, frame.id));
      }
    }
  }
  
  return paths;
}
```

## Recommendation

**Strongly recommend adopting the points-based approach** for the following reasons:

1. **Eliminates the global marker selection bug entirely** - No ambiguity about instances
2. **More performant** - Fewer lookups and simpler logic
3. **Clearer intent** - The clicked data is explicit, not derived
4. **Better maintainability** - Simpler code with fewer edge cases
5. **Preserves storage efficiency** - Selection state still uses paths

The only downside is slightly more data passed in the click event, which is negligible compared to the benefits.

## Migration Path

1. Update `clickMarker` signature to accept points
2. Update `data-point.tsx` to pass selectable points
3. Simplify `clickMarkerAction` to use points directly
4. Remove complex instance filtering logic
5. Add tests for new behavior
6. Deprecate and remove old signature

This change would make the selection system more robust, performant, and easier to understand.