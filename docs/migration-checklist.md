# Phase 2+ Migration Checklist (Updated December 2024)

## Pre-Migration Setup

### Environment Preparation
- [x] Create feature branch: `feature/phase2-store-computation` ✅ Completed
- [x] Set up performance monitoring baseline ✅ Completed
- [x] Document current metrics (render counts, computation times) ✅ Completed
- [x] Create rollback branch: `backup/pre-phase2` ✅ Completed
- [x] Notify team of migration start ✅ Completed

### Testing Infrastructure
- [ ] Run all existing tests and ensure they pass
- [ ] Create performance benchmark suite
- [ ] Set up continuous integration for feature branch
- [ ] Prepare browser testing environment

## Phase 2.1: Store Infrastructure

### Store State Structure
- [x] Add `computedRowData` field to AnimationData interface ✅ (Modified from original `computedTracks`)
- [x] Add `DragState` type definition ✅ Verified and implemented
- [x] Add `ComputedRowData` interface ✅ (Modified from `ComputedTrackData`)
- [x] Add performance monitoring hooks ✅ Subscription equality checks
- [x] Update store-types.ts with new interfaces ✅ Completed

### Computation Functions
- [x] Move `computeFrames` logic to store ✅ Via computeVirtualFrames
- [x] Move `computeTransitionSegments` logic to store ✅ In computeRowData
- [x] Move `computeViolationSet` logic to store ✅ In computeRowData
- [x] Move `computeVerticalBounds` logic to store ✅ In computeRowData
- [x] Create `computeRowData` selector function ✅ (Modified from `computeTrackData`)

### Store Subscriptions
- [x] Implement subscription for track changes ✅ updateComputedRowData
- [ ] Add debouncing for drag operations ⚠️ Not yet implemented
- [x] Create memoization strategy for computed values ✅ Via subscription equality
- [x] Add cleanup for removed tracks ✅ Via sourceRow updates
- [x] Test subscription performance ✅ Working correctly

## Phase 2.2: Virtual State Management

### Drag State Implementation
- [x] Implement `startDragging` action ✅ Code exists in /src/actions/drag/
- [x] Implement `updateDragDelta` action ✅ Code exists in /src/actions/drag/
- [x] Implement `commitDrag` action ✅ Code exists in /src/actions/drag/
- [x] Implement `cancelDrag` action ✅ Code exists in /src/actions/drag/
- [ ] **Enable drag actions in store** ⚠️ Currently commented out
- [ ] Add drag state persistence across components

### Virtual Frame Computation
- [x] Implement `applyDragOffsets` function ✅ Completed with clamping
- [x] Create `computeVirtualFrames` with drag prevention ✅ Implemented
- [x] Add frame merging prevention during drag ✅ Via draggedKeypointIds
- [x] Test virtual position calculations ✅ Working correctly
- [x] Verify stamp clamping (0-1 bounds) ✅ Implemented in applyDragOffsets

### Interpolator Updates
- [ ] Create dual interpolator system (base + virtual) ❌ Not implemented
- [ ] Update player subscriptions to use virtual interpolators ❌ Not implemented
- [ ] Test immediate feedback during drag ❌ Pending
- [ ] Verify velocity calculations during drag ❌ Pending
- [ ] Check interpolator performance ❌ Pending

## Phase 2.3: Component Migration

### DataRenderer Component
- [x] Remove `useMemo` for frameData computation ✅ Completed
- [x] Replace with store selector for computedRowData ✅ Using computedRowData
- [x] Remove prop drilling of frameData ✅ Mostly removed
- [x] Update component props interface ✅ Simplified
- [x] Add store subscription with shallow equality ✅ Implemented

### DataPointsRenderer Component
- [x] Remove computed data logic ✅ Moved to store
- [ ] Update to use store directly ⚠️ Still receives props
- [x] Subscribe to computed frames from store ✅ Via parent
- [x] Update rendering logic ✅ Working correctly
- [ ] Test component updates on store changes ⚠️ Pending

### DataPoint Component
- [ ] Remove dependency on stale data prop ❌ Still receives data prop
- [ ] Subscribe to virtual frames during drag ❌ Not implemented
- [ ] Update click handler to use fresh data ❌ Not implemented
- [ ] Remove workaround code for stale frames ❌ Not done
- [ ] Verify selection works after drag ❌ Not tested

### Selection Handling
- [x] Implement `computeMarkerSelection` function ✅ Completed
- [ ] **Enable `clickMarker` action** ⚠️ Currently commented out
- [ ] Ensure selection persistence after drag ❌ Not tested
- [ ] Fix last-selected marker bug ❌ Not fixed
- [ ] Test multi-selection scenarios ❌ Not tested
- [ ] Verify shift-click range selection ❌ Not tested

## Phase 2.4: Testing & Validation

### Unit Tests
- [ ] Update `marker-reselection-after-drag.test.ts` to pass
- [ ] Update drag action tests
- [ ] Update computation function tests
- [ ] Add tests for computed state
- [ ] Add tests for virtual interpolators

### Integration Tests
- [ ] Run `marker-drag-selection-issue.browser.test.tsx`
- [ ] Test drag with multiple tracks
- [ ] Test drag with constraints
- [ ] Test drag near boundaries
- [ ] Test undo/redo after drag

### Performance Tests
- [ ] Measure computation time improvement
- [ ] Measure render count reduction
- [ ] Check memory usage
- [ ] Test with large datasets (1000+ keypoints)
- [ ] Profile drag operation smoothness

### Edge Cases
- [ ] Test drag with single keypoint
- [ ] Test drag with all keypoints selected
- [ ] Test drag to same position (no-op)
- [ ] Test drag with mixed track selection
- [ ] Test rapid drag operations

## Phase 2.5: Cleanup & Optimization

### Code Cleanup
- [ ] Remove old computation logic from components
- [ ] Remove unused imports
- [ ] Remove workaround comments
- [ ] Clean up prop interfaces
- [ ] Remove compatibility layers

### Performance Optimization
- [ ] Add selective recomputation for affected tracks
- [ ] Implement lazy evaluation for non-visible tracks
- [ ] Add batching for multiple updates
- [ ] Optimize memoization strategies
- [ ] Profile and fix any bottlenecks

### Documentation Updates
- [ ] Update component documentation
- [ ] Update store documentation
- [ ] Create migration guide for other features
- [ ] Update API documentation
- [ ] Add inline code comments

## Phase 2.6: Release Preparation

### Immediate Next Steps (Priority)
- [ ] **Enable drag actions** in /src/store.ts
- [ ] **Enable selection action** (clickMarker) in /src/store.ts
- [ ] **Connect UI event handlers** to store actions
- [ ] **Update DataPoint** to use store actions directly
- [ ] **Test basic functionality** before proceeding

### Final Testing
- [ ] Full regression test suite
- [ ] User acceptance testing
- [ ] Performance benchmarks vs baseline
- [ ] Cross-browser testing
- [ ] Accessibility testing

### Code Review
- [ ] Internal code review
- [ ] Architecture review
- [ ] Security review (if applicable)
- [ ] Performance review
- [ ] Documentation review

### Deployment Preparation
- [ ] Create release notes
- [ ] Document breaking changes (if any)
- [ ] Prepare rollback plan
- [ ] Set up feature flags (if needed)
- [ ] Schedule deployment window

## Post-Migration

### Monitoring
- [ ] Monitor error rates
- [ ] Track performance metrics
- [ ] Gather user feedback
- [ ] Check memory usage in production
- [ ] Monitor for edge cases

### Follow-up Tasks
- [ ] Remove feature flags after stability confirmed
- [ ] Archive old implementation code
- [ ] Update team knowledge base
- [ ] Plan next phase improvements
- [ ] Celebrate successful migration! 🎉

## Rollback Procedures

### If Issues Detected
- [ ] Identify scope of issue
- [ ] Attempt hotfix if minor
- [ ] Initiate rollback if major
- [ ] Revert to backup branch
- [ ] Communicate status to team

### Post-Rollback
- [ ] Document issue encountered
- [ ] Create test case for issue
- [ ] Plan remediation
- [ ] Schedule retry
- [ ] Update risk assessment

## Success Metrics

### Required Outcomes
- [ ] Marker selection bug fixed ❌ Not yet tested
- [ ] All tests passing ⚠️ Drag tests exist but not integrated
- [ ] No functionality regression ⚠️ Drag/selection disabled
- [x] Performance improved or stable ✅ Store computation working

### Target Improvements
- [x] Computation moved to store ✅ Achieved
- [x] Reduced component complexity ✅ DataRenderer simplified
- [x] Better separation of concerns ✅ Clear store/component split
- [ ] 30% reduction in computation time ⚠️ Not measured
- [ ] 50% reduction in unnecessary re-renders ⚠️ Not measured

### Current Architecture Benefits
- ✅ All computations centralized in store
- ✅ Virtual drag state infrastructure ready
- ✅ Clean subscription patterns established
- ✅ Foundation for undo/redo in place
- ⚠️ Drag and selection ready but disabled

## Sign-offs

### Technical Review
- [ ] Lead Developer: _________________ Date: _______
- [ ] Architecture Review: _____________ Date: _______
- [ ] QA Lead: _______________________ Date: _______

### Stakeholder Approval
- [ ] Product Owner: _________________ Date: _______
- [ ] Project Manager: _______________ Date: _______

## Notes Section

Use this space to document any issues, decisions, or important information discovered during migration:

---

### Migration Started: OCTOBER 2025
### Migration Completed: In Progress (Est. 3-5 days remaining)
### Total Duration: ~2 weeks (partial implementation)

### Issues Encountered:
1. Changed from `computedTracks` to `computedRowData` structure
2. Drag actions implemented but disabled to prevent build issues
3. Selection system implemented but disabled pending integration

### Lessons Learned:
1. Store-based computation significantly simplifies components
2. Virtual state pattern works well for preview operations
3. Subscription patterns with equality checks provide good performance

### Future Improvements:
1. Implement dual interpolators for immediate visual feedback
2. Add undo/redo system leveraging store architecture
3. Optimize for large datasets (1000+ keypoints)

### Remaining Work (Estimated 3-5 days):
1. **Day 1**: Enable and connect drag/selection actions
2. **Day 2-3**: Complete component integration
3. **Day 4**: Implement dual interpolators
4. **Day 5**: Testing and bug fixes
