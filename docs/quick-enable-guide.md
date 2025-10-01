# Quick Enable Guide: Drag & Selection

## Immediate Changes Required (30 minutes)

This guide provides the exact changes needed to enable drag and selection functionality that's already implemented but currently disabled.

## Step 1: Enable Drag Action Exports

**File:** `/packages/animation/src/actions/drag/index.ts`

```typescript
// CHANGE FROM:
// export { startDragging } from "./start-dragging";
// export { updateDragDelta } from "./update-drag-delta";
// export { commitDrag } from "./commit-drag";
// export { cancelDrag } from "./cancel-drag";

// CHANGE TO:
export { startDragging } from "./start-dragging";
export { updateDragDelta } from "./update-drag-delta";
export { commitDrag } from "./commit-drag";
export { cancelDrag } from "./cancel-drag";
```

## Step 2: Import Drag Actions in Store

**File:** `/packages/animation/src/store.ts` (around line 32)

```typescript
// CHANGE FROM:
// import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "./actions/drag";

// CHANGE TO:
import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "./actions/drag";
```

## Step 3: Add Selection Import

**File:** `/packages/animation/src/store.ts` (add to imports section)

```typescript
import { computeMarkerSelection } from "./functions/compute-marker-selection";
```

## Step 4: Enable clickMarker Action

**File:** `/packages/animation/src/store.ts` (around line 442)

```typescript
// CHANGE FROM:
clickMarker: (
  markerInfo: InstancedFrameInfo,
  sources: Source[],
  allMarkerInfo: InstancedFrameInfo[],
  shift?: boolean,
  mod?: boolean,
) => {
  // set((state: AnimationData) => {
  // const result = computeMarkerSelection(
  //   markerInfo,
  //   sources,
  //   allMarkerInfo,
  //   state.selection,
  //   state.referenceMarker,
  //   shift,
  //   mod,
  // );
  // return {
  //   selection: result.selection,
  //   referenceMarker: result.reference,
  // };
  // });
},

// CHANGE TO:
clickMarker: (
  markerInfo: InstancedFrameInfo,
  sources: Source[],
  allMarkerInfo: InstancedFrameInfo[],
  shift?: boolean,
  mod?: boolean,
) => {
  set((state: AnimationData) => {
    const result = computeMarkerSelection(
      markerInfo,
      sources,
      allMarkerInfo,
      state.selection,
      state.referenceMarker,
      shift,
      mod,
    );
    return {
      selection: result.selection,
      referenceMarker: result.reference,
    };
  });
},
```

## Step 5: Add Drag Actions to Store Return

**File:** `/packages/animation/src/store.ts` (in AnimationSlice return, after line ~500)

```typescript
// Add these lines to the return statement of AnimationSlice:
startDragging,
updateDragDelta,
commitDrag,
cancelDrag,
```

## Step 6: Verify Build

```bash
# Check for TypeScript errors
npm run type-check

# Build the package
npm run build

# If successful, run tests
npm test -- drag
```

## Expected Outcomes

After these changes:
- ✅ Store will have drag actions available
- ✅ Store will have selection action available
- ✅ Existing tests should pass
- ✅ No build errors

## Next Steps (After Verification)

1. **Connect UI Events** - Wire up mouse events to call drag actions
2. **Update DataPoint** - Connect click handler to selection action
3. **Test Interactions** - Verify drag and selection work in UI

## Troubleshooting

### If TypeScript Errors Occur

Check that all types are properly imported:
```typescript
import type { DragState, InstancedFrameInfo, Source } from "./types";
```

### If Build Fails

1. Check for circular dependencies
2. Verify all imports are correct
3. Run `npm run clean` and rebuild

### If Tests Fail

1. Check that drag state is properly initialized as `null`
2. Verify computed data updates when drag state changes
3. Check subscription equality functions

## Testing Commands

```bash
# Test drag functionality
npm test -- src/tests/drag-core.test.ts

# Test selection logic  
npm test -- compute-marker-selection

# Run all animation tests
npm test -- packages/animation
```

## Quick Validation Script

Create a test file to verify everything works:

```typescript
// test-drag-enable.ts
import { useAnimationStore } from './src/store';

const store = useAnimationStore.getState();

// Check drag actions exist
console.log('startDragging:', typeof store.startDragging); // should be 'function'
console.log('updateDragDelta:', typeof store.updateDragDelta); // should be 'function'
console.log('commitDrag:', typeof store.commitDrag); // should be 'function'
console.log('cancelDrag:', typeof store.cancelDrag); // should be 'function'
console.log('clickMarker:', typeof store.clickMarker); // should be 'function'

// Check drag state
console.log('dragState:', store.dragState); // should be null initially
```

## Summary

Total changes required:
- **5 uncomment operations** (4 exports, 1 action body)
- **2 import additions** (drag actions, selection function)
- **4 action additions** to store return

Estimated time: **15-30 minutes**

After these changes, the drag and selection system will be enabled and ready for UI integration.