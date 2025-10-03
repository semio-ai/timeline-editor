# Selection System Implementation Guide

## Executive Summary

This document outlines the implementation plan for fixing critical selection issues in the animation timeline system and preparing for future support of arbitrary group nesting. The solution transforms selection from a collection of special cases into a unified hierarchical model based on the fundamental distinction between **groups** (organizational containers) and **tracks** (data containers).

## Current Issues

### 1. Group First Click Not Selecting Children ❌
**Problem**: Initial click on group marker only selects the group itself, not its children.  
**Impact**: Inconsistent selection behavior confuses users.

### 2. Shift-Click Within Group Loses Children ❌  
**Problem**: Range selection within a group loses child selection state.  
**Impact**: Breaks expected range selection behavior for grouped elements.

### 3. Ctrl-Click Cross-Track Deselection ❌
**Problem**: Ctrl-clicking in the same track incorrectly deselects markers from other tracks.  
**Impact**: Makes multi-track selection impossible.

### 4. Attribute Row Missing Parent Selection ❌
**Problem**: Clicking an attribute (e.g., position/x) doesn't select its parent group.  
**Impact**: Incomplete selection of logical units.

## Architecture Understanding

### Current System (Temporary)
```
namespace/instance/position       # Complex datatype (pseudo-group)
namespace/instance/position/x     # Attribute field (pseudo-track)  
namespace/instance/position/y     # Attribute field (pseudo-track)
namespace/instance/position/z     # Attribute field (pseudo-track)
```

### Future System (Target)
```
namespace/instance/character/arm/position       # Group
namespace/instance/character/arm/position/x     # Track (number)
namespace/instance/character/arm/position/y     # Track (number)
namespace/instance/character/arm/position/z     # Track (number)
```

### Key Principles
1. **Groups** are organizational containers (can contain groups or tracks)
2. **Tracks** are data containers with keypoints (always leaf nodes, always simple types)
3. **No complex datatype tracks** - vector3, euler, rgb become groups containing simple tracks
4. **Selection units** are determined by hierarchical structure

## Implementation Plan

### Phase 1: Immediate Fixes (2 days)

#### Day 1: Core Selection Logic
**Files to modify:**
- `src/actions/click-marker.ts`
- `src/functions/marker-helpers.ts`

**Tasks:**
1. Fix Issue #3 (Ctrl-Click) - Add early return for ctrl-click that bypasses track-specific logic
2. Fix Issue #4 (Attributes) - Add depth-based detection for attributes at depth 4
3. Fix Issue #1 (Group Children) - Ensure groups always return complete child selection

**Implementation:**
```typescript
// Priority order in clickMarkerAction:
1. Handle instance switching
2. Handle ctrl-click (EARLY RETURN)
3. Handle attributes (depth 4 special case)  
4. Handle groups
5. Fall through to regular selection
```

#### Day 2: Range Selection
**Files to modify:**
- `src/functions/compute-marker-selection.ts`

**Tasks:**
1. Fix Issue #2 (Shift-Click) - Add explicit shift-click handling for groups
2. Implement range selection that preserves hierarchical relationships
3. Add tests for all fixed behaviors

### Phase 2: Hierarchical Utilities (2 days)

#### Day 3: Path Utilities
**New files:**
- `src/functions/entity-type-utils.ts`
- `src/functions/hierarchical-path-utils.ts`

**Implementation:**
```typescript
interface PathEntity {
  path: string;
  type: EntityType; // Group | Track | Field(legacy)
  isLeaf: boolean;
  canContainKeypoints: boolean;
}

// Core functions needed:
- classifyEntity(state, path): PathEntity
- getDirectChildren(state, path): string[]
- getAllDescendantTracks(state, groupPath): string[]
- isComponentGroup(state, path): boolean
- getSelectionUnit(state, path): string[]
```

#### Day 4: Integration & Testing
**Files to update:**
- `src/tests/selection-logic.test.ts`
- Add new test file: `src/tests/hierarchical-selection.test.ts`

**Test cases:**
```typescript
describe('Selection Fixes', () => {
  test('Group first click selects all children');
  test('Shift-click in group preserves children');
  test('Ctrl-click preserves other track selections');
  test('Attribute click selects parent and siblings');
});
```

### Phase 3: Migration Path (3 days)

#### Day 5: Refactor to Unified Handler
**New file:**
- `src/actions/unified-click-handler.ts`

**Refactor `clickMarkerAction` to use entity classification:**
```typescript
function unifiedClickHandler(state, markerId, sourceRowId, shift?, mod?) {
  const entity = classifyEntity(state, sourceRowId);
  
  switch(entity.type) {
    case EntityType.Group:
      return handleGroupSelection(state, markerId, sourceRowId, shift, mod);
    case EntityType.Track:
      return handleTrackSelection(state, markerId, sourceRowId, shift, mod);
    case EntityType.Field: // Legacy attributes
      return handleFieldSelection(state, markerId, sourceRowId, shift, mod);
  }
}
```

#### Day 6: Component Updates
**Files to update:**
- `src/components/canvas-sheet/data-point.tsx`
- `src/components/canvas-sheet/data-renderer.tsx`

**Remove prop drilling, use store lookups:**
```typescript
// Instead of passing frameData as props
const markerData = useAnimationStore(state => 
  getMarkerById(state, markerId, sourceRowId)
);
```

#### Day 7: Documentation & Release
**Documentation:**
- Update this README with final implementation
- Create migration guide for future group support
- Document new selection behavior

## Code Examples

### Fix #1: Group Always Selects Children
```typescript
if (isGroupRow(sourceRow)) {
  if (!shift && !mod) {
    const entries = [markerToSelectionEntry(markerInfo, sourceRowId)];
    
    // Always get children, no conditions
    const childPaths = Object.keys(state.computedRowData)
      .filter(p => p.startsWith(sourceRowId + '/'));
    
    for (const childPath of childPaths) {
      const childData = state.computedRowData[childPath];
      const childMarker = childData.virtualFrames.find(
        f => f.stamp === markerInfo.stamp
      );
      if (childMarker) {
        entries.push(markerToSelectionEntry(childMarker, childPath));
      }
    }
    
    return { selection: entries };
  }
}
```

### Fix #3: Ctrl-Click Simple Toggle
```typescript
if (mod && !shift) {
  const unit = getSelectionUnit(state, markerInfo, sourceRowId);
  const isSelected = unit.some(e => 
    state.selection.some(s => 
      s.markerId === e.markerId && s.sourceRowId === e.sourceRowId
    )
  );
  
  if (isSelected) {
    // Remove only this unit
    return {
      selection: state.selection.filter(s => 
        !unit.some(u => 
          u.markerId === s.markerId && u.sourceRowId === s.sourceRowId
        )
      )
    };
  } else {
    // Add to existing selection
    return {
      selection: [...state.selection, ...unit]
    };
  }
}
```

### Fix #4: Attribute Selects Parent
```typescript
const depth = sourceRowId.split('/').length;
if (depth === 4 && !shift && !mod) {
  const parentPath = sourceRowId.split('/').slice(0, 3).join('/');
  const entries = [];
  
  // Add parent
  const parentData = state.computedRowData[parentPath];
  if (parentData) {
    const parentMarker = parentData.virtualFrames.find(
      f => f.stamp === markerInfo.stamp
    );
    if (parentMarker) {
      entries.push(markerToSelectionEntry(parentMarker, parentPath));
    }
  }
  
  // Add all siblings
  const siblingPaths = Object.keys(state.computedRowData)
    .filter(p => p.startsWith(parentPath + '/') && p.split('/').length === 4);
  
  // ... add sibling markers
  
  return { selection: entries };
}
```

## Testing Strategy

### Unit Tests
```typescript
// Test selection units
expect(getSelectionUnit(state, 'ns/inst/position/x')).toEqual([
  'ns/inst/position',
  'ns/inst/position/x',
  'ns/inst/position/y',
  'ns/inst/position/z'
]);

// Test entity classification
expect(classifyEntity(state, 'ns/inst/position')).toEqual({
  type: EntityType.Group,
  isLeaf: false,
  canContainKeypoints: false
});
```

### Integration Tests
- Create animation with groups and tracks
- Test all 4 selection scenarios
- Verify selection state consistency
- Test with multiple animation instances

### Manual Testing Checklist
- [ ] Click group → all children selected
- [ ] Ctrl-click track A, then track B → both selected
- [ ] Ctrl-click in track B again → toggles without affecting A
- [ ] Click position/x → position group and all components selected
- [ ] Shift-click range in group → children preserved
- [ ] Selection crosses animation instance → boundary respected

## Success Metrics

### Immediate Success (Phase 1)
- All 4 reported issues fixed
- No regression in existing behavior
- Tests passing

### Medium-term Success (Phase 2)
- Hierarchical utilities implemented
- Entity classification working
- Path-based selection operational

### Long-term Success (Phase 3)
- Unified selection handler deployed
- Ready for arbitrary group nesting
- No special cases for attributes

## Risk Mitigation

### Performance Risks
- **Risk**: Recursive tree traversal may be slow for deep hierarchies
- **Mitigation**: Cache entity classification results, limit depth

### Compatibility Risks
- **Risk**: Breaking existing selection behavior
- **Mitigation**: Keep legacy code paths during transition, feature flag new behavior

### Data Structure Risks
- **Risk**: Inconsistent source row structures
- **Mitigation**: Add validation, handle edge cases gracefully

## Future Considerations

### When Groups Support Arrives
1. Remove depth-based attribute detection
2. Remove Field entity type
3. Use metadata for component group detection
4. Support arbitrary nesting depth

### API Evolution
```typescript
// Future: Metadata-driven behavior
interface SourceRowMetadata {
  entityType: 'group' | 'track';
  componentGroup?: boolean; // Select children as unit
  selectBehavior?: 'individual' | 'unit' | 'hierarchical';
}
```

## Resources

### Key Files
- `/src/actions/click-marker.ts` - Main selection action
- `/src/functions/compute-marker-selection.ts` - Selection logic
- `/src/functions/marker-helpers.ts` - Helper utilities
- `/src/store.ts` - Animation store with selection state

### Documentation
- `selection-system-solution.md` - Detailed problem analysis
- `hierarchical-selection-final-architecture.md` - Target architecture
- `selection-issues-immediate-fix.md` - Quick fixes for current issues

### Related PRs
- (Link to implementation PR when created)
- (Link to test PR when created)

## Contact

For questions about this implementation:
- Technical Lead: (Contact info)
- Project Manager: (Contact info)

## Appendix: Decision Log

### Why Groups vs Tracks?
- Provides clear semantic distinction
- Eliminates ambiguity about data location
- Simplifies selection rules
- Enables arbitrary nesting

### Why Fix Order Matters
1. Ctrl-click fix must come first (prevents interference)
2. Attribute detection before group handling
3. Group handling before fallback logic

### Why Not Complete Rewrite?
- Too risky for production system
- Gradual migration preserves stability
- Allows testing at each phase
- Maintains backward compatibility