# Phase 2+ Migration Checklist

## Pre-Migration Setup

### Environment Preparation
- [ ] Create feature branch: `feature/phase2-store-computation`
- [ ] Set up performance monitoring baseline
- [ ] Document current metrics (render counts, computation times)
- [ ] Create rollback branch: `backup/pre-phase2`
- [ ] Notify team of migration start

### Testing Infrastructure
- [ ] Run all existing tests and ensure they pass
- [ ] Create performance benchmark suite
- [ ] Set up continuous integration for feature branch
- [ ] Prepare browser testing environment

## Phase 2.1: Store Infrastructure

### Store State Structure
- [ ] Add `computedTracks` field to AnimationData interface
- [ ] Add `DragState` type definition (already exists - verify)
- [ ] Add `ComputedTrackData` interface
- [ ] Add performance monitoring hooks
- [ ] Update store-types.ts with new interfaces

### Computation Functions
- [ ] Move `computeFrames` logic to store
- [ ] Move `computeTransitionSegments` logic to store
- [ ] Move `computeViolationSet` logic to store
- [ ] Move `computeVerticalBounds` logic to store
- [ ] Create `computeTrackData` selector function

### Store Subscriptions
- [ ] Implement subscription for track changes
- [ ] Add debouncing for drag operations
- [ ] Create memoization strategy for computed values
- [ ] Add cleanup for removed tracks
- [ ] Test subscription performance

## Phase 2.2: Virtual State Management

### Drag State Implementation
- [ ] Verify `startDragging` action works correctly
- [ ] Verify `updateDragDelta` applies offsets properly
- [ ] Verify `commitDrag` updates selection correctly
- [ ] Verify `cancelDrag` reverts changes
- [ ] Add drag state persistence across components

### Virtual Frame Computation
- [ ] Implement `applyDragOffsets` function
- [ ] Create `computeVirtualFrames` with drag prevention
- [ ] Add frame merging prevention during drag
- [ ] Test virtual position calculations
- [ ] Verify stamp clamping (0-1 bounds)

### Interpolator Updates
- [ ] Create dual interpolator system (base + virtual)
- [ ] Update player subscriptions to use virtual interpolators
- [ ] Test immediate feedback during drag
- [ ] Verify velocity calculations during drag
- [ ] Check interpolator performance

## Phase 2.3: Component Migration

### DataRenderer Component
- [ ] Remove `useMemo` for frameData computation
- [ ] Replace with store selector for computedTracks
- [ ] Remove prop drilling of frameData
- [ ] Update component props interface
- [ ] Add store subscription with shallow equality

### DataPointsRenderer Component
- [ ] Remove frameData prop
- [ ] Add trackId prop instead
- [ ] Subscribe to computed frames from store
- [ ] Update rendering logic
- [ ] Test component updates on store changes

### DataPoint Component
- [ ] Remove dependency on stale data prop
- [ ] Subscribe to virtual frames during drag
- [ ] Update click handler to use fresh data
- [ ] Remove workaround code for stale frames
- [ ] Verify selection works after drag

### Selection Handling
- [ ] Update `clickMarker` to use computed frames
- [ ] Ensure selection persistence after drag
- [ ] Fix last-selected marker bug
- [ ] Test multi-selection scenarios
- [ ] Verify shift-click range selection

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
- [ ] Marker selection bug fixed
- [ ] All tests passing
- [ ] No functionality regression
- [ ] Performance improved or stable

### Target Improvements
- [ ] 30% reduction in computation time
- [ ] 50% reduction in unnecessary re-renders
- [ ] Improved code maintainability score
- [ ] Reduced component complexity
- [ ] Better separation of concerns

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

### Migration Started: _____________
### Migration Completed: ___________
### Total Duration: _______________

### Issues Encountered:
1. 
2. 
3. 

### Lessons Learned:
1. 
2. 
3. 

### Future Improvements:
1. 
2. 
3.