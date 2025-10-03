# Selection Issue Analysis: Global vs Track Marker Selection

## Issue Description
When clicking a marker in the global timeline view with these parameters:
- markerId: "o1-o1" 
- sourceRowId: "global"
- Points: Contains markers from both namespace-alpha and namespace-beta instances

The equivalent marker in a track view is not selected:
- markerId: "o1"
- sourceRowId: "namespace-alpha/alpha-shared-instance/opacity"
- Points: Contains only the namespace-alpha instance marker

Since these markers represent the same underlying data points, both should be selected together.

## Root Cause Analysis

### 1. Global Marker Structure
The "global" source row is created by `updateConsolidatedSourceRow` subscription as a consolidated view that overlays markers from ALL animation instances. It has a special structure:

```typescript
// Global marker path: "global#o1-o1"
// When parsed:
{
  sourceRowId: "global",
  markerId: "o1-o1",
  instanceId: undefined  // <-- No instance ID because "global" has no "/" separators
}
```

### 2. Track Marker Structure
Track markers follow the standard namespace/instance/track hierarchy:

```typescript
// Track marker path: "namespace-alpha/alpha-shared-instance/opacity#o1"
// When parsed:
{
  sourceRowId: "namespace-alpha/alpha-shared-instance/opacity",
  markerId: "o1", 
  instanceId: "alpha-shared-instance"  // <-- Has instance ID from path structure
}
```

### 3. Selection Unit Logic
The `getSelectionUnit` function correctly identifies that both markers should be selected together:
- When clicking the track marker, it finds both the track marker AND the global marker
- When clicking the global marker, it finds only the global marker (BUG: should find track markers too)

### 4. The Filtering Problem
In `clickMarkerAction`, after getting the selection unit, the code filters markers by instance:

```typescript
const instanceFilteredUnit = selectionUnit.filter((path) => {
  const parsed = parseMarkerPath(path);
  const matches = parsed.instanceId === activeInstance;  // <-- PROBLEM!
  return matches;
});
```

**The Problem**: Global markers have `instanceId: undefined`, so they are ALWAYS filtered out!

## Why Global Markers Exist
Global markers serve an important purpose:
1. They provide a consolidated view of all instances
2. They show overlapping keyframes from different namespaces
3. They use the `selectable` flag to indicate which points belong to the active instance

Example global marker data:
```json
{
  "points": [
    {
      "id": "o1",
      "instanceId": "alpha-shared-instance",
      "selectable": true   // Active instance - can be selected
    },
    {
      "id": "o1", 
      "instanceId": "beta-shared-instance",
      "selectable": false  // Different instance - view only
    }
  ]
}
```

## Proposed Fix

### Option 1: Include Global Markers in Instance Filter (Recommended)
Modify the instance filtering logic to include global markers that contain selectable points from the active instance:

```typescript
const instanceFilteredUnit = selectionUnit.filter((path) => {
  const parsed = parseMarkerPath(path);
  
  // If no instanceId (global marker), check if it contains selectable points
  if (!parsed.instanceId) {
    const rowData = state.computedRowData[parsed.sourceRowId];
    const marker = rowData?.virtualFrames.find(f => f.id === parsed.markerId);
    
    // Include if has at least one selectable point from active instance
    return marker?.points?.some(p => 
      p.selectable && p.instanceId === activeInstance
    ) ?? false;
  }
  
  // Regular instance check for track markers
  return parsed.instanceId === activeInstance;
});
```

### Option 2: Fix getSelectionUnit Bidirectionality
Ensure `getSelectionUnit` properly finds all related markers in both directions:
- When clicking global marker → find all track markers with matching points
- When clicking track marker → find global markers containing that point (already works)

### Option 3: Special Case Global Markers
Treat global markers as a special case that bypasses instance filtering entirely, since they already use the `selectable` flag to control what can be selected.

## Impact Assessment

### Current Behavior
- Clicking track marker selects only the track marker (global marker filtered out)
- Clicking global marker selects nothing (itself filtered out)
- Selection appears broken between views

### After Fix
- Clicking track marker selects both track and global markers
- Clicking global marker selects both global and relevant track markers
- Selection is consistent across all views

## Implementation Notes

1. The fix should be applied in `packages/animation/src/actions/click-marker.ts`
2. Test coverage should be added for:
   - Global to track marker selection
   - Track to global marker selection
   - Multi-instance selection behavior
   - Selection with mixed selectable/non-selectable points

3. Consider adding explicit types for global vs instance-specific markers to make the distinction clearer in the code.

## Related Files
- `packages/animation/src/actions/click-marker.ts` - Contains the filtering bug
- `packages/animation/src/functions/selection-state-manager.ts` - Contains `parseMarkerPath` and `getSelectionUnit`
- `packages/animation/src/subscriptions/update-consolidated-source-row.ts` - Creates global markers
- `packages/animation/src/functions/compute-consolidated-source-row.ts` - Manages selectable flags