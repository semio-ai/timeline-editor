# Selection Fix: Global Markers Incorrectly Showing as Selected

## Issue Description
When clicking on a track marker (e.g., scale track marker), unrelated global timeline markers were incorrectly appearing as selected. This created a confusing visual state where markers that had no relation to the clicked point appeared to be part of the selection.

## Example Scenario
1. User clicks on scale marker "s0" in the alpha-shared-instance
2. Expected: Only the scale marker and its corresponding global marker should appear selected
3. Actual (before fix): Multiple unrelated global markers appeared selected, including markers containing only points from different animation instances

## Root Cause
The bug was in the `isSelected` logic in `packages/animation/src/components/canvas-sheet/data-point.tsx`.

### The Problematic Logic Flow:
1. The function filtered marker points to get only selectable ones:
   ```typescript
   const selectablePoints = markerData.points.filter((p) => p.selectable !== false);
   ```

2. It then looped through selectable points to check if each was selected

3. **BUG**: If there were NO selectable points (empty array), the loop wouldn't execute, and the function would reach the end and return `true`, incorrectly marking the marker as selected

### Why This Happened:
Global markers can contain points from multiple animation instances. When an instance is not active, its points are marked as `selectable: false`. If a global marker contains ONLY points from inactive instances, it has 0 selectable points.

Example of affected markers:
- `tx0-tx0-tx0-tx0-tx0-tx0-w1`: 7 total points, 0 selectable (all from inactive instances)
- `b2`, `w3`, `b3`: 1 point each, 0 selectable (from inactive instances)

## The Fix
Added a check to return `false` when there are no selectable points:

```typescript
// In data-point.tsx, line ~85
const selectablePoints = markerData.points.filter((p) => p.selectable !== false);

// If there are no selectable points, the marker cannot be selected
if (selectablePoints.length === 0) {
  return false;
}

for (const point of selectablePoints) {
  // ... existing logic
}
```

## Test Coverage
Added comprehensive tests in `selection-visual.test.ts`:
1. **Test for scale marker selection**: Verifies that clicking a scale marker only selects the appropriate global markers
2. **Test for unrelated marker rejection**: Ensures global markers without the clicked point don't show as selected
3. **Helper function update**: Updated the test helper `checkIfMarkerShouldAppearSelected` to match the fixed logic

## Verification
After the fix:
- ✅ Clicking on scale marker "s0" only selects the marker itself and the global marker "h0-i1-s0-s0" that contains it
- ✅ Global markers with 0 selectable points correctly show as unselected
- ✅ All selection visual tests pass
- ✅ Selection behavior is now consistent and predictable

## Impact
This fix ensures that:
1. Visual selection feedback accurately represents the actual selection state
2. Users won't see unrelated markers highlighted when making selections
3. The selection logic correctly handles multi-instance scenarios
4. Markers from inactive instances don't interfere with selection visualization