# Selection System Action Plan

## Immediate Actions (Fix 4 Critical Issues)

### Prerequisites
- [ ] Create backup of `src/actions/click-marker.ts`
- [ ] Create backup of `src/functions/compute-marker-selection.ts`
- [ ] Set up test environment

---

## Day 1: Core Fixes (4-6 hours)

### Task 1: Fix Ctrl-Click Cross-Track Deselection (1 hour)
**File:** `src/actions/click-marker.ts`

**Location:** After instance switching check, before any other logic

**Add this code:**
```typescript
// PRIORITY: Handle ctrl-click first to prevent track interference
if (mod && !shift) {
  const unit = getSelectionUnit(state, markerInfo, sourceRowId);
  const isSelected = unit.some(e => 
    state.selection.some(s => 
      s.markerId === e.markerId && s.sourceRowId === e.sourceRowId
    )
  );
  
  if (isSelected) {
    return {
      selection: state.selection.filter(s => 
        !unit.some(u => u.markerId === s.markerId && u.sourceRowId === s.sourceRowId)
      ),
      activeAnimationInstance: state.activeAnimationInstance,
      referenceMarker: state.selection.length > 0 ? state.referenceMarker : null
    };
  } else {
    return {
      selection: [...state.selection, ...unit],
      activeAnimationInstance: state.activeAnimationInstance,
      referenceMarker: markerToReference(markerInfo, sourceRowId, true)
    };
  }
}
```

### Task 2: Add Selection Unit Helper (30 minutes)
**File:** `src/actions/click-marker.ts` (add at bottom)

```typescript
function getSelectionUnit(
  state: AnimationData,
  markerInfo: InstancedFrameInfo,
  sourceRowId: string
): SelectionEntry[] {
  const unit: SelectionEntry[] = [];
  const sourceRow = state.instancedTrackSources[sourceRowId];
  const depth = sourceRowId.split('/').length;
  
  if (depth === 4) {
    // Attribute: get parent and siblings
    const parentPath = sourceRowId.split('/').slice(0, 3).join('/');
    
    // Add parent
    const parentData = state.computedRowData[parentPath];
    if (parentData) {
      const parentMarker = parentData.virtualFrames.find(f => f.stamp === markerInfo.stamp);
      if (parentMarker) unit.push(markerToSelectionEntry(parentMarker, parentPath));
    }
    
    // Add siblings
    const siblingPaths = Object.keys(state.computedRowData).filter(
      p => p.startsWith(parentPath + '/') && p.split('/').length === 4
    );
    
    for (const path of siblingPaths) {
      const data = state.computedRowData[path];
      const marker = data.virtualFrames.find(f => f.stamp === markerInfo.stamp);
      if (marker) unit.push(markerToSelectionEntry(marker, path));
    }
  } else if (isGroupRow(sourceRow)) {
    // Group: add self and children
    unit.push(markerToSelectionEntry(markerInfo, sourceRowId));
    
    const childPaths = Object.keys(state.computedRowData).filter(
      p => p.startsWith(sourceRowId + '/') && p.split('/').length === 4
    );
    
    for (const path of childPaths) {
      const data = state.computedRowData[path];
      const marker = data.virtualFrames.find(f => f.stamp === markerInfo.stamp);
      if (marker) unit.push(markerToSelectionEntry(marker, path));
    }
  } else {
    // Simple track
    unit.push(markerToSelectionEntry(markerInfo, sourceRowId));
  }
  
  return unit;
}
```

### Task 3: Fix Attribute Parent Selection (1 hour)
**File:** `src/actions/click-marker.ts`

**Location:** After ctrl-click handler, before group handling

```typescript
// Handle attributes (depth 4 in current system)
const pathDepth = sourceRowId.split('/').length;
if (pathDepth === 4 && !shift && !mod) {
  const parentPath = sourceRowId.split('/').slice(0, 3).join('/');
  const parentRow = state.instancedTrackSources[parentPath];
  
  if (parentRow && parentRow.data.length > 1) {
    const unit = getSelectionUnit(state, markerInfo, sourceRowId);
    return {
      selection: unit,
      activeAnimationInstance: state.activeAnimationInstance,
      referenceMarker: markerToReference(markerInfo, sourceRowId, false)
    };
  }
}
```

### Task 4: Fix Group First Click (1.5 hours)
**File:** `src/actions/click-marker.ts`

**Location:** Replace existing group handling

```typescript
if (isGroupRow(sourceRow)) {
  if (!shift && !mod) {
    // ALWAYS get children, no conditions
    const entries: SelectionEntry[] = [];
    entries.push(markerToSelectionEntry(markerInfo, sourceRowId));
    
    // Get all children at this stamp
    const stamp = markerInfo.stamp;
    const childPaths = Object.keys(state.computedRowData).filter(
      p => p.startsWith(sourceRowId + '/') && p.split('/').length === 4
    );
    
    for (const childPath of childPaths) {
      const childData = state.computedRowData[childPath];
      const childMarker = childData.virtualFrames.find(f => f.stamp === stamp);
      if (childMarker) {
        entries.push(markerToSelectionEntry(childMarker, childPath));
      }
    }
    
    return {
      selection: entries.filter(e => e.instanceId === state.activeAnimationInstance),
      activeAnimationInstance: state.activeAnimationInstance,
      referenceMarker: markerToReference(markerInfo, sourceRowId, false)
    };
  }
  // ... handle other modifiers
}
```

### Task 5: Fix Shift-Click in Groups (2 hours)
**File:** `src/actions/click-marker.ts`

**Location:** In group handling section, add shift handler

```typescript
if (isGroupRow(sourceRow)) {
  // ... existing !shift && !mod case ...
  
  if (shift && state.referenceMarker) {
    const refRow = state.instancedTrackSources[state.referenceMarker.sourceRowId];
    
    if (state.referenceMarker.sourceRowId === sourceRowId || 
        (refRow && isGroupRow(refRow) && getParentPath(state.referenceMarker.sourceRowId) === sourceRowId)) {
      
      // Range within group
      const stamps = [state.referenceMarker.stamp, markerInfo.stamp].sort((a, b) => a - b);
      const rangeSelection: SelectionEntry[] = [];
      
      const markersInRange = state.computedRowData[sourceRowId].virtualFrames.filter(
        f => f.stamp >= stamps[0] && f.stamp <= stamps[1]
      );
      
      for (const marker of markersInRange) {
        // Add group marker
        rangeSelection.push(markerToSelectionEntry(marker, sourceRowId));
        
        // Add all children
        const childPaths = Object.keys(state.computedRowData).filter(
          p => p.startsWith(sourceRowId + '/') && p.split('/').length === 4
        );
        
        for (const childPath of childPaths) {
          const childData = state.computedRowData[childPath];
          const childMarker = childData.virtualFrames.find(f => f.stamp === marker.stamp);
          if (childMarker) {
            rangeSelection.push(markerToSelectionEntry(childMarker, childPath));
          }
        }
      }
      
      // Preserve other track selections
      const otherSelections = state.selection.filter(s => 
        !s.sourceRowId.startsWith(sourceRowId)
      );
      
      return {
        selection: [...otherSelections, ...rangeSelection],
        activeAnimationInstance: state.activeAnimationInstance,
        referenceMarker: state.referenceMarker
      };
    }
  }
  
  // ... continue with other cases
}
```

---

## Day 2: Testing & Validation (4 hours)

### Task 1: Create Test File (2 hours)
**File:** `src/tests/selection-fixes.test.ts`

```typescript
describe('Selection Issue Fixes', () => {
  let mockState: AnimationData;
  
  beforeEach(() => {
    mockState = createMockState();
  });
  
  describe('Issue 1: Group First Click', () => {
    it('should select group and all children on first click', () => {
      const result = clickMarkerAction(mockState, 'group-marker', 'ns/inst/position');
      expect(result.selection).toHaveLength(4); // group + 3 children
      expect(result.selection.map(s => s.sourceRowId)).toContain('ns/inst/position');
      expect(result.selection.map(s => s.sourceRowId)).toContain('ns/inst/position/x');
      expect(result.selection.map(s => s.sourceRowId)).toContain('ns/inst/position/y');
      expect(result.selection.map(s => s.sourceRowId)).toContain('ns/inst/position/z');
    });
  });
  
  describe('Issue 2: Shift-Click in Group', () => {
    it('should preserve children when shift-clicking in group', () => {
      // Set up initial selection
      mockState.selection = [/* ... */];
      mockState.referenceMarker = {/* ... */};
      
      const result = clickMarkerAction(mockState, 'marker-2', 'ns/inst/position', true, false);
      
      // Verify children are preserved
      const positionSelections = result.selection.filter(s => 
        s.sourceRowId.startsWith('ns/inst/position')
      );
      expect(positionSelections.length).toBeGreaterThan(4); // Multiple markers with children
    });
  });
  
  describe('Issue 3: Ctrl-Click Cross-Track', () => {
    it('should preserve other track selections when ctrl-clicking', () => {
      // Select in track A
      mockState.selection = [
        { sourceRowId: 'ns/inst/trackA', markerId: 'm1', instanceId: 'inst', stamp: 1000 }
      ];
      
      // Ctrl-click in track B
      let result = clickMarkerAction(mockState, 'm2', 'ns/inst/trackB', false, true);
      expect(result.selection).toHaveLength(2);
      
      // Ctrl-click another in track B
      mockState.selection = result.selection;
      result = clickMarkerAction(mockState, 'm3', 'ns/inst/trackB', false, true);
      
      // Track A selection should still exist
      expect(result.selection.find(s => s.sourceRowId === 'ns/inst/trackA')).toBeDefined();
    });
  });
  
  describe('Issue 4: Attribute Selection', () => {
    it('should select parent and siblings when clicking attribute', () => {
      const result = clickMarkerAction(mockState, 'm1', 'ns/inst/position/x');
      
      expect(result.selection.map(s => s.sourceRowId)).toContain('ns/inst/position');
      expect(result.selection.map(s => s.sourceRowId)).toContain('ns/inst/position/x');
      expect(result.selection.map(s => s.sourceRowId)).toContain('ns/inst/position/y');
      expect(result.selection.map(s => s.sourceRowId)).toContain('ns/inst/position/z');
    });
  });
});
```

### Task 2: Manual Testing (1 hour)
**Test each scenario in the UI:**

1. **Group Selection**
   - [ ] Click on position group → see x, y, z selected
   - [ ] Click on rotation group → see r, p, y selected
   - [ ] Click on color group → see r, g, b selected

2. **Ctrl-Click Multi-Selection**
   - [ ] Select marker in track A
   - [ ] Ctrl-click marker in track B → both selected
   - [ ] Ctrl-click another in track B → toggles without affecting A
   - [ ] Ctrl-click marker in track A → toggles correctly

3. **Shift-Click Range**
   - [ ] Click marker in group
   - [ ] Shift-click another in same group → range with children
   - [ ] Shift-click in different track → adds to selection

4. **Attribute Selection**
   - [ ] Click position/x → position group selected
   - [ ] Click rotation/p → rotation group selected
   - [ ] Click on simple track → only that track selected

### Task 3: Performance Testing (1 hour)
- [ ] Test with 100+ tracks
- [ ] Test with deep nesting (simulated)
- [ ] Measure selection operation time
- [ ] Check for memory leaks

---

## Day 3: Documentation & Deployment (2 hours)

### Task 1: Update Documentation (1 hour)
- [ ] Update selection behavior docs
- [ ] Add examples of fixed behaviors
- [ ] Document known limitations
- [ ] Create migration notes

### Task 2: Code Review Prep (30 minutes)
- [ ] Clean up console.logs
- [ ] Add code comments
- [ ] Format code consistently
- [ ] Create PR description

### Task 3: Deployment (30 minutes)
- [ ] Create feature branch
- [ ] Commit changes with clear messages
- [ ] Create pull request
- [ ] Tag reviewers

---

## Validation Checklist

### Before Marking Complete
- [ ] All 4 issues fixed
- [ ] No regression in existing behavior  
- [ ] Tests passing
- [ ] Manual testing complete
- [ ] Code reviewed
- [ ] Documentation updated

### Success Criteria
✅ Group first click selects all children  
✅ Shift-click in group preserves children  
✅ Ctrl-click doesn't deselect other tracks  
✅ Attribute click selects parent and siblings  

---

## Rollback Plan

If issues arise after deployment:
1. Revert to backed up files
2. Disable feature flag (if implemented)
3. Hot fix critical issues only
4. Re-test comprehensively

---

## Contact for Questions

- Technical issues: (Lead developer)
- Testing help: (QA team)
- Deployment: (DevOps)

---

## Notes

- Keep existing code structure where possible
- Don't optimize prematurely - fix bugs first
- Test each fix in isolation before integration
- Document any deviations from this plan