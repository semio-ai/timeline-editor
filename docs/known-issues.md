# Known Issues and Limitations

## Critical Issues

### 1. Marker Selection After Drag Bug 🐛

**Status**: Active | **Priority**: High | **Target Fix**: Phase 2+ Refactoring

#### Description
After dragging multiple selected markers, the last selected marker in the multi-selection cannot be reselected by clicking on it at its new position.

#### Reproduction Steps
1. Select marker A1 in a track
2. Add marker A2 to selection (Shift-click or Ctrl-click)
3. Drag both markers to a new position
4. Click empty space to deselect all
5. Try to click on marker A2 at its new position
6. **Result**: Marker A2 cannot be selected
7. **Expected**: Marker A2 should be selectable

#### Technical Details
- **Root Cause**: DataPoint components retain stale `data` props after drag operations
- **Affected Components**: 
  - `src/components/three/canvas-sheet/data-point.tsx`
  - `src/components/three/canvas-sheet/data-renderer.tsx`
- **Test Cases**:
  - `src/tests/bug-fixes/marker-reselection-after-drag.test.ts`
  - `src/tests/browser/marker-drag-selection-issue.browser.test.tsx`

#### Workarounds
1. Click elsewhere first, then click the desired marker
2. Use keyboard navigation to select markers
3. Select a different marker first, then the desired one
4. Use Ctrl-click instead of regular click

#### Permanent Fix
This issue will be resolved in Phase 2+ refactoring when components subscribe directly to computed store state. See `docs/dragging-architecture-proposal.md` for details.

---

## Moderate Issues

### 2. Component Prop Drilling

**Status**: Active | **Priority**: Medium | **Target Fix**: Phase 2+

#### Description
Frame data is passed through multiple component layers as props, leading to stale references and unnecessary re-renders.

#### Impact
- Performance degradation with large datasets
- Complex prop management
- Difficult to maintain and debug

#### Affected Areas
- DataRenderer → DataPointsRenderer → DataPoint component chain
- All components receiving `frameData` as props

---

### 3. Drag Performance with Large Selections

**Status**: Active | **Priority**: Medium | **Target Fix**: Phase 2.1

#### Description
When dragging a large number of markers (50+), there may be noticeable lag in the preview update.

#### Technical Details
- Virtual frame computation happens on every drag update
- No debouncing for rapid mouse movements
- All tracks recompute even if not affected

#### Workarounds
- Drag smaller selections
- Disable preview during drag (if option available)
- Use keyboard shortcuts for precise movements

---

## Minor Issues

### 4. Frame Snapping Precision

**Status**: Active | **Priority**: Low | **Target Fix**: TBD

#### Description
When Alt is not pressed, frame snapping may occasionally snap to an unexpected frame boundary.

#### Reproduction
1. Set framerate to 30fps
2. Drag a marker slowly
3. Observe snapping behavior near frame boundaries

#### Workarounds
- Hold Alt for free movement
- Use arrow keys for precise frame-by-frame movement

---

### 5. Selection Box Visual Feedback

**Status**: Active | **Priority**: Low | **Target Fix**: TBD

#### Description
The selection box for multi-selected markers doesn't always update immediately during drag operations.

#### Impact
- Visual inconsistency
- May confuse users about what's selected

---

## Performance Considerations

### Memory Usage

**Status**: Monitoring | **Priority**: Low

- Computed frames are not garbage collected aggressively
- Large animations (>1000 keypoints) may use significant memory
- Virtual state during drag adds temporary memory overhead

### Re-render Frequency

**Status**: Active | **Priority**: Medium

- Components re-render on every store update
- No selective subscription to specific track changes
- Will be addressed in Phase 2+ with granular subscriptions

---

## Browser-Specific Issues

### Chrome/Chromium
- No known browser-specific issues

### Firefox
- Potential performance degradation with WebGL rendering of many markers
- Canvas interaction may feel slightly less responsive

### Safari
- WebGL performance varies by macOS version
- Touch events on iPad may not properly trigger drag operations

---

## Accessibility Issues

### Keyboard Navigation

**Status**: Partial Support | **Priority**: Medium

- Not all drag operations can be performed with keyboard
- Tab navigation doesn't follow visual layout
- Screen readers may not announce marker positions correctly

---

## API Limitations

### Store Actions

1. **Batch Operations**: No native support for batching multiple keypoint updates
2. **Undo Granularity**: Undo/redo operates on entire operations, not individual changes
3. **Async Operations**: Store updates are synchronous, may block UI for large operations

### Component Props

1. **Type Safety**: Some props use `any` type due to generic value constraints
2. **Validation**: Limited runtime validation of prop values
3. **Documentation**: Not all props are fully documented in interfaces

---

## Planned Improvements

### Phase 2 (Store-Based Computation)
- Fix marker selection after drag bug
- Eliminate prop drilling
- Improve performance with computed state
- Add granular subscriptions

### Phase 3 (Extended Features)
- Batch operation support
- Improved undo/redo granularity
- Async store operations
- Enhanced keyboard navigation

### Phase 4 (Optimization)
- Memory usage optimization
- Render performance improvements
- WebGL optimization for large datasets
- Browser-specific optimizations

---

## Reporting New Issues

To report a new issue:

1. Check if it's already listed in this document
2. Create a test case if possible
3. Document reproduction steps
4. Add to appropriate section based on severity
5. Update status and priority
6. Link to any related code or tests

### Severity Guidelines

- **Critical**: Breaks core functionality, no workaround
- **High**: Significant impact, workaround exists but is inconvenient
- **Medium**: Noticeable issue, reasonable workaround available
- **Low**: Minor issue, cosmetic, or edge case

---

## Issue Resolution Process

1. **Identification**: Issue discovered and documented
2. **Verification**: Reproducible test case created
3. **Prioritization**: Assigned priority and target phase
4. **Implementation**: Fix developed in feature branch
5. **Testing**: Automated tests verify fix
6. **Review**: Code review and approval
7. **Release**: Deployed with release notes
8. **Closure**: Issue marked as resolved, documentation updated

---

*Last Updated: [Current Date]*
*Next Review: [Phase 2 Start Date]*