# Points-Based Selection Implementation Summary

## Overview
Successfully refactored the `clickMarker` action from a path-based approach to a points-based approach, fixing the global marker selection bug and creating a cleaner, more performant implementation.

## The Problem
When clicking markers in the global timeline view, equivalent markers in track views were not being selected. This was caused by:
1. Global markers have `undefined` as their `instanceId` (path: "global#marker-id")
2. The instance filtering logic filtered out any marker where `instanceId !== activeInstance`
3. This meant global markers were always excluded from selection

## The Solution
Instead of passing marker IDs and reconstructing the data, we now pass the actual point data that was clicked:

### Old Signature (Path-based)
```typescript
clickMarker: (markerId: string, sourceRowId: string, shift?: boolean, mod?: boolean) => void
```

### New Signature (Points-based)
```typescript
clickMarker: (
  clickedPoints: (SourceRowData & { id: string })[],
  markerPath: string,
  shift?: boolean,
  mod?: boolean
) => void
```

## Implementation Changes

### 1. Store Types (`store-types.ts`)
- Updated `AnimationActions` interface to use the new points-based signature
- Added `SourceRowData` import

### 2. Click Marker Action (`actions/click-marker.ts`)
- Refactored to work with actual point data instead of IDs
- Removed complex instance filtering logic
- Added `findPathsContainingPoints` function that uses point signatures for matching
- Fixed `createPointSignature` to use the point's `id` field for precise matching

### 3. Store Implementation (`store.ts`)
- Updated `clickMarker` implementation to match new signature
- Simplified logic - no more data lookups needed

### 4. DataPoint Component (`components/canvas-sheet/data-point.tsx`)
- Filters points for `selectable !== false` before passing to `clickMarker`
- Creates marker path for reference tracking
- Passes actual point data instead of just IDs

## Key Benefits

### 1. **Eliminates Global Marker Bug**
Global markers now work correctly because:
- The points explicitly contain instance information
- No ambiguous instance filtering based on paths
- Selection is based on actual data, not path structure

### 2. **Improved Performance**
- **Before**: Multiple store lookups to reconstruct point data from IDs
- **After**: Direct use of already-available point data
- Eliminates redundant data retrieval

### 3. **Clearer Intent**
- The clicked data is explicit in the function call
- No need to derive or guess what was actually clicked
- Instance determination is unambiguous

### 4. **Simpler Code**
- Removed complex instance filtering logic
- Removed special cases for global markers
- More straightforward selection unit calculation

### 5. **Respects Selectable Flag**
- Component pre-filters points based on `selectable` flag
- Only selectable points participate in selection
- Cleaner separation of concerns

## Test Results
All tests pass with the new implementation:
- ✅ Global marker selection correctly selects both global and track markers
- ✅ Track marker selection correctly selects both track and global markers  
- ✅ Instance switching works correctly
- ✅ Selection is precise - only specific markers with matching points are selected

## Example: How It Works Now

### When clicking a global marker:
```javascript
// Component passes:
clickedPoints: [
  { id: "o1", instanceId: "alpha-shared", selectable: true, ... }
  // Non-selectable points are already filtered out
]
markerPath: "global#o1-o1"

// Action finds all markers containing these points:
// - global#o1-o1 (the clicked global marker)
// - namespace-alpha/alpha-shared-instance/opacity#o1 (the matching track marker)
```

### When clicking a track marker:
```javascript
// Component passes:
clickedPoints: [
  { id: "o1", instanceId: "alpha-shared", selectable: true, ... }
]
markerPath: "namespace-alpha/alpha-shared-instance/opacity#o1"

// Action finds all markers containing these points:
// - namespace-alpha/alpha-shared-instance/opacity#o1 (the clicked track marker)
// - global#o1-o1 (the global marker that contains this point)
```

## Point Signature Matching
The system uses point signatures for efficient matching:
```typescript
function createPointSignature(point: SourceRowData & { id?: string }): string {
  const pointId = "id" in point && point.id ? point.id : point.animatableId;
  return `${point.namespaceId}/${point.instanceId}/${point.trackId}/${point.attribute || ""}#${pointId}`;
}
```

This creates unique identifiers like:
- `namespace-alpha/alpha-shared-instance/opacity/#o1`

These signatures enable fast lookups to find all markers containing specific points.

## Conclusion
The points-based approach is superior in every way:
- **More performant** - Fewer lookups and simpler logic
- **More correct** - Fixes the global marker selection bug
- **More maintainable** - Clearer intent and simpler code
- **More robust** - No ambiguity about what was clicked

This refactoring demonstrates how passing the actual data (points) instead of identifiers (paths) can lead to cleaner, more efficient code that better represents the user's intent.