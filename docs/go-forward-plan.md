# Go-Forward Action Plan: Enabling Drag & Selection

## Executive Summary

The store-based computation architecture is **complete and working**. Drag and selection functionality is **fully implemented but disabled**. This plan outlines the steps to enable and integrate these features with an **ID-based refactoring** to eliminate stale data issues.

**Estimated Time to Full Functionality: 4-6 days** (includes ID-based refactoring)

## Current State Assessment

### What's Working ✅
- Store-based computation pipeline
- Virtual frame calculations with drag support
- Computed row data updates reactively
- Component subscriptions to store
- Drag offset calculations with clamping

### What's Disabled ⚠️
- Drag actions (`startDragging`, `updateDragDelta`, `commitDrag`, `cancelDrag`)
- Selection action (`clickMarker`)
- UI event handlers for drag/selection

### What's Missing ❌
- Dual interpolator system
- Direct store subscriptions in DataPoint
- Performance debouncing during drag

## Day 1: ID-Based Refactoring (6-8 hours)

### Morning Session (3-4 hours)
1. **Refactor Store Actions for ID-Based References with Instance Constraints**
   ```typescript
   // In store-types.ts, update action signatures
   interface AnimationActions {
     // Change from full objects to IDs
     clickMarker: (
       markerId: string,
       sourceRowId: string,
       shift?: boolean,
       mod?: boolean,
     ) => void;
     
     startDragging: (markerIds?: string[]) => void;
   }
   ```

2. **Update Selection State Structure**
   ```typescript
   // In store-types.ts
   interface SelectionEntry {
     markerId: string;
     sourceRowId: string;
     instanceId: string;  // Animation instance boundary
     stamp?: number; // Optional cache
   }
   
   interface AnimationData {
     selection: SelectionEntry[];
     referenceMarker: {
       markerId: string;
       sourceRowId: string;
       instanceId: string;  // Instance for range selection
       isAddMode?: boolean;
     } | null;
     activeAnimationInstance?: string;  // Current selection context
   }
   ```

3. **Add Helper Functions**
   ```typescript
   // Create new file: /src/functions/marker-helpers.ts
   export function getMarkerById(
     state: AnimationData,
     markerId: string,
     sourceRowId: string
   ): InstancedFrameInfo | undefined {
     const computedData = state.computedRowData[sourceRowId];
     return computedData?.virtualFrames.find(f => f.id === markerId);
   }
   
   export function getSelectionFrames(state: AnimationData): InstancedFrameInfo[] {
     return state.selection
       .map(entry => getMarkerById(state, entry.markerId, entry.sourceRowId))
       .filter((frame): frame is InstancedFrameInfo => frame !== undefined);
   }
   ```

### Afternoon Session (3-4 hours)
4. **Update clickMarker Implementation with Instance Switching**
   ```typescript
   clickMarker: (markerId, sourceRowId, shift?, mod?) => {
     set((state: AnimationData) => {
       const sourceRow = state.instancedTrackSources[sourceRowId];
       const computedData = state.computedRowData[sourceRowId];
       const markerInfo = computedData.virtualFrames.find(f => f.id === markerId);
       
       if (!markerInfo || !sourceRow) return state;
       
       // Extract instance ID from marker's points (SourceRowData)
       const clickedInstanceId = markerInfo.points[0]?.instanceId;
       
       // Check if switching animation instances
       if (clickedInstanceId && state.activeAnimationInstance !== clickedInstanceId) {
         // Different instance - clear selection and switch
         return {
           ...state,
           activeAnimationInstance: clickedInstanceId,
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
         };
       }
       
       // Same instance - allow normal selection behavior
       const result = computeMarkerSelection(
         markerInfo,
         sourceRow,
         computedData.virtualFrames,
         getSelectionFrames(state), // Convert IDs to frames
         state.referenceMarker,
         shift,
         mod,
       );
       
       // Convert result back to ID-based format with instance
       return {
         ...state,
         selection: result.selection.map(frame => ({
           markerId: frame.id,
           sourceRowId: sourceRowId,
           instanceId: clickedInstanceId,
           stamp: frame.stamp,
         })),
         referenceMarker: result.reference ? {
           markerId: result.reference.marker.id,
           sourceRowId: sourceRowId,
           instanceId: clickedInstanceId,
           isAddMode: result.reference.isAddMode,
         } : null,
       };
     });
   },
   ```

5. **Update startDragging for ID-Based with Instance Validation**
   ```typescript
   startDragging: (markerIds?: string[]) => {
     const state = get();
     
     // Filter selection to only active instance
     const validSelection = state.selection.filter(
       s => s.instanceId === state.activeAnimationInstance
     );
     
     const idsToUse = markerIds || validSelection.map(s => s.markerId);
     
     // Rest of implementation using ID lookups
   }
   ```

## Day 2: Enable Core Actions (4-6 hours)

### Morning Session (2-3 hours)
1. **Enable Drag Actions**
   ```typescript
   // In /src/actions/drag/index.ts
   // Uncomment all exports:
   export { startDragging } from "./start-dragging";
   export { updateDragDelta } from "./update-drag-delta";
   export { commitDrag } from "./commit-drag";
   export { cancelDrag } from "./cancel-drag";
   ```

2. **Update Store Imports**
   ```typescript
   // In /src/store.ts line ~32
   // Change from:
   // import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "./actions/drag";
   // To:
   import { startDragging, updateDragDelta, commitDrag, cancelDrag } from "./actions/drag";
   ```

3. **Add Drag Actions to Store**
   ```typescript
   // In AnimationSlice, add after line ~500:
   startDragging,
   updateDragDelta,
   commitDrag,
   cancelDrag,
   ```

### Afternoon Session (2-3 hours)
4. **Enable Selection Action**
   ```typescript
   // In /src/store.ts ~line 442
   // Uncomment the clickMarker implementation
   clickMarker: (markerInfo, sources, allMarkerInfo, shift?, mod?) => {
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

5. **Import Selection Function**
   ```typescript
   // Add to imports in /src/store.ts
   import { computeMarkerSelection } from "./functions/compute-marker-selection";
   ```

6. **Test Basic Store Actions**
   - Run existing drag tests
   - Verify store updates correctly
   - Check for any immediate errors

## Day 3: Wire UI Events (6-8 hours)

### Canvas Event Handlers
1. **Add Mouse Event Capture**
   ```typescript
   // In appropriate canvas component
   const handleMouseDown = (e: MouseEvent) => {
     if (selection.length > 0) {
       store.startDragging(selection);
       e.preventDefault();
     }
   };
   
   const handleMouseMove = (e: MouseEvent) => {
     if (store.dragState?.isDragging) {
       const deltaStamp = calculateDeltaFromMouse(e);
       store.updateDragDelta(deltaStamp, e.shiftKey);
     }
   };
   
   const handleMouseUp = () => {
     if (store.dragState?.isDragging) {
       store.commitDrag();
     }
   };
   ```

2. **Update DataPoint Component**
   ```typescript
   // In /src/components/canvas-sheet/data-point.tsx
   // Update to use ID-based approach
   export const DataPoint = memo(function DataPoint({
     markerId,
     sourceRowId,
     // ... visual props only
   }) {
     const store = useAnimationStore();
     
     const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
       const { shiftKey, metaKey, ctrlKey } = e.nativeEvent;
       
       // Just pass IDs - no data lookup needed
       store.clickMarker(
         markerId,
         sourceRowId,
         shiftKey,
         metaKey || ctrlKey
       );
     }, [markerId, sourceRowId]);
     
     // Subscribe to selection state (instance-aware)
     const isSelected = useAnimationStore(
       useShallow(state => 
         state.selection.some(s => 
           s.markerId === markerId && 
           s.instanceId === state.activeAnimationInstance
         )
       )
     );
     
     // ... render logic
   });
   ```

3. **Add Escape Key Handler**
   ```typescript
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Escape' && store.dragState?.isDragging) {
         store.cancelDrag();
       }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, []);
   ```

## Day 4: Component Integration (6-8 hours)

### Finalize Component Updates
1. **Update DataPointsRenderer**
   ```typescript
   // Pass marker IDs instead of full frame data
   export const DataPointsRenderer = memo(function DataPointsRenderer({
     sourceRow,
     // Remove frames prop
     ...otherProps
   }) {
     // Get frames from store
     const frames = useAnimationStore(
       useShallow(state => state.computedRowData[sourceRow.id]?.virtualFrames || [])
     );
     
     return (
       <Instances>
         {frames.map((frame) => (
           <DataPoint
             key={frame.id}
             markerId={frame.id}
             sourceRowId={sourceRow.id}
             {...otherProps}
           />
         ))}
       </Instances>
     );
   });
   ```

2. **Test Selection After Drag**
   - Verify marker can be selected after dragging
   - Ensure no stale reference issues
   - Test multi-selection scenarios

## Day 5: Interpolators & Polish (4-6 hours)

### Implement Dual Interpolators
1. **Add to Computed Data**
   ```typescript
   interface ComputedRowData {
     // ... existing fields
     baseInterpolator: (stamp: number) => RawValue | undefined;
     virtualInterpolator: (stamp: number) => RawValue | undefined;
   }
   ```

2. **Update Player Subscriptions**
   ```typescript
   // Use virtual interpolator during drag
   const interpolator = dragState?.isDragging 
     ? computed.virtualInterpolator 
     : computed.baseInterpolator;
   ```

3. **Add Performance Optimizations**
   - Implement 16ms debouncing during drag
   - Add frame rate limiting for smooth dragging
   - Profile and optimize hot paths

## Day 6: Testing & Bug Fixes (4-6 hours)

### Comprehensive Testing
1. **Unit Tests**
   - Run all drag-*.test.ts files
   - Fix any failing tests
   - Add tests for edge cases discovered
   - Test animation instance switching
   - Test multi-selection within same instance
   - Verify selection clears when switching instances

2. **Integration Tests**
   - Test drag with 1, 10, 100+ keypoints
   - Test across multiple tracks
   - Test near boundaries (0 and 1)
   - Test rapid dragging

3. **Bug Fixes**
   - Fix marker reselection issue
   - Ensure selection persistence
   - Handle edge cases

### Documentation
1. Update user documentation
2. Add inline code comments
3. Update API documentation
4. Create demo/example

## Success Criteria

### Minimum Viable
- [ ] ID-based actions eliminate stale data
- [ ] Animation instance boundaries enforced
- [ ] Can drag single keypoint
- [ ] Can drag multiple selected keypoints within same instance
- [ ] Can select markers after drag
- [ ] Visual feedback during drag
- [ ] Can cancel drag with Escape
- [ ] Instance switching clears incompatible selections

### Full Implementation
- [ ] No stale reference bugs (verified)
- [ ] Smooth drag performance
- [ ] Shift-click range selection works within same instance
- [ ] Ctrl-click toggle selection works (switches instance if different)
- [ ] Multi-selection respects instance boundaries
- [ ] Active animation instance properly tracked
- [ ] Immediate interpolation updates
- [ ] Clean component/store separation

## Risk Mitigation

### Potential Issues & Solutions

1. **Performance During Drag**
   - Solution: Implement debouncing
   - Fallback: Reduce update frequency

2. **Stale References in Components**
   - Solution: Direct store subscriptions
   - Fallback: Force re-render on drag end

3. **Selection State Corruption**
   - Solution: Validate selection in store
   - Fallback: Clear selection on error

## Quick Start Commands

```bash
# Run tests
npm test -- drag

# Check for type errors
npm run type-check

# Build and verify
npm run build

# Run in dev mode with hot reload
npm run dev
```

## Validation Checklist

After each day, verify:
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Tests pass
- [ ] Basic functionality works
- [ ] Performance acceptable

## Notes for Implementation

1. **Start Small**: Enable one action at a time and test
2. **Use DevTools**: Monitor store updates in Redux DevTools
3. **Test Often**: Run tests after each major change
4. **Document Issues**: Keep notes on any unexpected behavior
5. **Commit Frequently**: Make small, reversible commits

## Emergency Rollback

If critical issues arise:
1. Revert to backup branch
2. Re-comment drag/selection actions
3. Document the specific issue
4. Create minimal reproduction
5. Plan targeted fix

## Support Resources

- Existing drag tests: `/src/tests/drag-*.test.ts`
- Selection logic: `/src/functions/compute-marker-selection.ts`
- Virtual frame computation: `/src/functions/compute-virtual-frames.ts`
- Store subscriptions: `/src/subscriptions/update-computed-row-data.ts`

## Timeline Summary

| Day | Focus | Deliverable |
|-----|-------|-------------|
| 1 | ID Refactoring | ID-based architecture |
| 2 | Enable Actions | Store actions working |
| 3 | Wire UI | Basic drag functionality |
| 4 | Components | Selection working |
| 5 | Polish | Smooth interactions |
| 6 | Testing | Production ready |

**Total: 4-6 working days** depending on issues encountered.

The additional day for ID-based refactoring will eliminate the stale data problem entirely, making the system more robust and maintainable.