# Browser Testing for Marker Selection Bug

## Overview

This directory contains browser-based tests for reproducing and debugging the marker selection bug in the animation timeline. The bug occurs when the last clicked marker in a multi-select operation cannot be re-selected after being dragged and deselected.

## Bug Description

**Issue**: After performing a multi-select operation (e.g., selecting 3 markers via shift-click), dragging them to a new position, and then deselecting them, the marker that was "last" in the selection cannot be clicked/selected again.

**Symptoms**:
- Other markers from the same selection CAN be re-selected normally
- Only the "last" marker in the original selection is affected
- The bug persists across multiple attempts
- Unit tests pass but the bug occurs in the actual UI

## Running Browser Tests

### Prerequisites

```bash
# Install dependencies if not already done
npm install

# Install Playwright browsers (first time only)
npx playwright install chromium
```

### Run Tests

```bash
# Run browser tests with visible browser (for debugging)
npm run test:browser

# Run specific test file
npm run test:browser marker-selection-bug.browser.test.tsx

# Run with different options
npm run test:browser -- --reporter=verbose
npm run test:browser -- --no-headless  # Keep browser open
```

## Test Structure

### Main Test Files

- `marker-selection-bug.browser.test.tsx` - Reproduces the bug with full AnimationSheet3D component
- `setup.ts` - Browser test utilities and helpers

### Test Flow

1. **Setup**: Creates a full AnimationSheet3D with test data (3 tracks, multiple keypoints)
2. **Multi-select**: Clicks first marker, then shift-clicks third marker for range selection
3. **Drag**: Drags the selected markers to a new position
4. **Clear**: Clicks empty space to deselect all markers
5. **Bug reproduction**: Attempts to click the "last" marker from the selection
6. **Verification**: Checks if the marker can be selected (fails when bug is present)

## Debugging Guide

### Enable Debug Logging

The test includes extensive logging. Key log points:

```javascript
// In DataPoint component (data-point.tsx)
console.log('Click attempt:', {
  markerId: data.id,
  pointIds: data.points.map(p => p.id),
  isSelected,
  gestureState,
  threeIntersection: event?.intersections?.[0]
});
```

### Chrome DevTools Debugging

The browser tests run with DevTools enabled. You can:

1. Set breakpoints in the browser's Sources tab
2. Inspect component state in React DevTools
3. Monitor network and console logs
4. Use the Three.js inspector extension

### Key Areas to Investigate

1. **useGesture State**: Check if gesture state is retained for the last marker
   ```javascript
   // In data-point.tsx
   const bind = useGesture({
     onClick: ({ event, ...gestureState }) => {
       console.log('Gesture state:', gestureState);
       // Check if state differs for the problematic marker
     }
   });
   ```

2. **Component Props**: Verify the `data` prop is updated correctly after drag
   ```javascript
   useEffect(() => {
     console.log(`DataPoint ${data.id} updated:`, {
       stamp: data.stamp,
       points: data.points
     });
   }, [data]);
   ```

3. **Three.js Instances**: Check if the instance is properly registered
   ```javascript
   // In onClick handler
   const intersection = event?.intersections?.[0];
   console.log('Instance hit:', {
     instanceId: intersection?.instanceId,
     object: intersection?.object
   });
   ```

4. **Selection State**: Monitor store selection updates
   ```javascript
   // Add to store
   const originalClickMarker = store.getState().clickMarker;
   store.getState().clickMarker = (...args) => {
     console.log('Selection update:', args);
     return originalClickMarker(...args);
   };
   ```

## Configuration

### Browser Test Config (`vitest.browser.config.ts`)

Key settings:
- `headless: false` - Shows browser window for debugging
- `devtools: true` - Enables Chrome DevTools
- `slowMo: 100` - Slows down actions to see what's happening
- `testTimeout: 30000` - Longer timeout for browser tests

### Modifying Test Behavior

To change test behavior, edit the config:

```typescript
// Make tests run faster (for CI)
headless: true,
slowMo: 0,

// Use different browser
name: 'firefox', // or 'webkit'

// Change viewport size
viewport: { width: 1280, height: 720 }
```

## Hypotheses for the Bug

Based on investigation, the bug might be related to:

1. **React Three Fiber Event System**: Events not propagating correctly after drag
2. **useGesture State Persistence**: Internal state retained for the last dragged element
3. **Instance Reference Issues**: Three.js instance handling after transformation
4. **Stale Closures**: Event handlers closing over stale values
5. **Component Key Issues**: React not properly updating the component

## Next Steps

1. Run the browser test to confirm bug reproduction
2. Add breakpoints in Chrome DevTools at key locations
3. Compare behavior between working markers and the problematic one
4. Check if the issue is specific to the "last" marker or position-based
5. Test with different selection patterns (2 markers, 4 markers, etc.)

## Related Files

- `../../components/three/canvas-sheet/data-point.tsx` - Component with the bug
- `../../actions/drag/` - Drag action implementations
- `../../functions/compute-marker-selection.ts` - Selection logic
- `../../../docs/marker-selection-bug-investigation.md` - Full investigation notes