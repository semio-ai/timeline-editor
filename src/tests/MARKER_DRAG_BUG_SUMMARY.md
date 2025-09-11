# Marker Drag Selection Bug - Test Summary

## Bug Description

There is a confirmed issue where markers cannot be reselected after being part of a multi-select drag operation.

### Reproduction Steps

1. **Select marker A1** - Click on a marker in a track
2. **Add marker A2 to selection** - Shift-click or Ctrl-click another marker in the same track
3. **Drag the selected markers** - Move both markers to a new position
4. **Clear selection** - Click on empty space to deselect all markers
5. **Attempt to select marker A2** - Click on marker A2 at its new position

### Expected Behavior
- Marker A2 should be selectable after the drag operation
- All markers should maintain independent selectability regardless of previous multi-select operations

### Actual Behavior (Bug)
- Marker A2 cannot be selected after being the last marker in a multi-select drag
- The first marker (A1) and other markers remain selectable
- The issue appears to be specific to the last marker added to a multi-selection

## Tests Created

### 1. Browser Test: `marker-drag-selection-issue.browser.test.tsx`

**Purpose**: Reproduce the bug in a full browser environment with actual UI interaction

**Key Features**:
- Simulates real mouse events on the canvas
- Tests the complete interaction flow
- Verifies that the bug is specific to the last selected marker
- Currently configured to expect the bug (test passes when bug is confirmed)

**Status**: Test passes by confirming the bug exists. Once the bug is fixed, the test expectations can be inverted to ensure the fix remains stable.

### 2. Unit Test: `marker-selection-drag-bug.test.ts` (Attempted)

**Purpose**: Test the selection logic at the store level

**Challenges**:
- Store API differs from expected interface
- Selection functions are not directly accessible as initially assumed
- Would need refactoring to properly test store state management

### 3. Expected Behavior Test: `marker-selection-after-drag-expected.test.ts`

**Purpose**: Document the expected behavior clearly for future reference

**Key Points**:
- All markers should remain independently selectable after drag
- Selection order should not affect post-drag selectability
- No persistent state should prevent future marker selection

## Technical Analysis

### Potential Root Causes

1. **Selection State Persistence**: Some internal state related to the last selected marker may not be properly cleared after drag operations

2. **Reference Marker Issues**: The `referenceMarker` state might not be properly reset, affecting subsequent selection attempts

3. **Drag State Cleanup**: The drag operation might leave behind state that interferes with selection

### Affected Code Areas

Based on the codebase analysis:
- `packages/animation/src/store.ts` - Contains `handleMarkerClick` function
- `packages/animation/src/functions/compute-marker-selection.ts` - Core selection logic
- `packages/animation/src/actions/drag.ts` - Drag operation handling

## Next Steps for Bug Fix

1. **Debug the `handleMarkerClick` function** to see why it fails for the last selected marker after drag

2. **Check the `clearSelection` implementation** to ensure all selection-related state is properly reset

3. **Verify drag cleanup** in `commitDrag` or `cancelDrag` functions

4. **Examine the `computeMarkerSelection` function** for any edge cases with previously selected markers

## Test Execution

### Running the Browser Test
```bash
cd packages/animation
npm run test:browser -- marker-drag-selection-issue
```

### Expected Output
- Currently: Test passes by confirming the bug exists
- After fix: Test should be updated to expect successful selection

## Notes

- The bug is consistently reproducible
- It affects user workflow when working with multiple markers
- The issue is isolated to the last marker in a multi-selection, not a general selection problem
- Browser tests show the issue occurs in the actual UI, not just in unit tests