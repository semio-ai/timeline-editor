# Immediate Fixes for Selection Issues

## Overview

This document provides immediate, implementable fixes for the 4 reported selection issues. These fixes work with the current system while preparing for the future where groups can be nested arbitrarily and all tracks are simple types.

## Issue 1: Group First Click Not Selecting Children

### Problem
When the first marker clicked is part of a group, it only selects the group marker itself, not the children markers.

### Root Cause
`handleGroupSelection` returns an empty array when there's no existing selection state, likely because `getGroupChildrenMarkersAtStamp` fails to find children on initial interaction.

### Fix
```typescript
// In click-marker.ts, replace the group selection logic:

if (isGroupRow(sourceRow)) {
  if (!shift && !mod) {
    // Simple click on group - ALWAYS get children, no conditions
    const childrenEntries: SelectionEntry[] = [];
    
    // Add the group marker itself
    childrenEntries.push(markerToSelectionEntry(markerInfo, sourceRowId));
    
    // Get all child markers at this timestamp
    const stamp = markerInfo.stamp;
    
    // For current system: attributes are at depth 4
    const pathSegments = sourceRowId.split('/');
    const isComplexDatatype = pathSegments.length === 3 && sourceRow.data.length > 1;
    
    if (isComplexDatatype) {
      // Get attribute children (position/x, position/y, position/z)
      const attributeFields = ['x', 'y', 'z', 'r', 'g', 'b', 'h', 's', 'l', 'p'];
      
      for (const field of attributeFields) {
        const childPath = `${sourceRowId}/${field}`;
        const childData = state.computedRowData[childPath];
        
        if (childData) {
          const childMarker = childData.virtualFrames.find(f => f.stamp === stamp);
          if (childMarker) {
            childrenEntries.push(markerToSelectionEntry(childMarker, childPath));
          }
        }
      }
    }
    
    return {
      selection: childrenEntries.filter(e => e.instanceId === state.activeAnimationInstance),
      activeAnimationInstance: activeInstance,
      referenceMarker: markerToReference(markerInfo, sourceRowId, false)
    };
  }
}
```

## Issue 2: Shift-Click Within Group Loses Children

### Problem
If a marker in a group is selected, shift-clicking another marker in that row removes the selection state of children.

### Root Cause
Shift-click falls through to regular selection behavior which doesn't maintain group-children relationships during range operations.

### Fix
```typescript
// Add explicit shift-click handling for groups before falling through

if (isGroupRow(sourceRow)) {
  if (shift && state.referenceMarker) {
    const refSourceRow = state.instancedTrackSources[state.referenceMarker.sourceRowId];
    
    // Check if reference is in the same group row
    if (state.referenceMarker.sourceRowId === sourceRowId || 
        (refSourceRow && isGroupRow(refSourceRow) && 
         state.referenceMarker.sourceRowId === sourceRowId)) {
      
      // Create range within group, preserving children
      const rangeSelection: SelectionEntry[] = [];
      const stamps = [state.referenceMarker.stamp, markerInfo.stamp].sort((a, b) => a - b);
      
      // Get all markers in the time range
      const markersInRange = state.computedRowData[sourceRowId].virtualFrames.filter(
        f => f.stamp >= stamps[0] && f.stamp <= stamps[1]
      );
      
      // For each marker in range, add it and its children
      for (const marker of markersInRange) {
        // Add group marker
        rangeSelection.push(markerToSelectionEntry(marker, sourceRowId));
        
        // Add all children at this stamp
        const childPaths = Object.keys(state.computedRowData).filter(
          path => path.startsWith(sourceRowId + '/') && path.split('/').length === 4
        );
        
        for (const childPath of childPaths) {
          const childData = state.computedRowData[childPath];
          const childMarker = childData.virtualFrames.find(f => f.stamp === marker.stamp);
          if (childMarker) {
            rangeSelection.push(markerToSelectionEntry(childMarker, childPath));
          }
        }
      }
      
      // Preserve selections from other tracks
      const otherSelections = state.selection.filter(s => {
        const path = s.sourceRowId;
        return !path.startsWith(sourceRowId);
      });
      
      return {
        selection: [...otherSelections, ...rangeSelection],
        activeAnimationInstance: activeInstance,
        referenceMarker: state.referenceMarker
      };
    }
  }
  // Continue with other modifier combinations...
}
```

## Issue 3: Ctrl-Click Cross-Track Deselection

### Problem
Ctrl-clicking another marker in the same track as the most recently clicked marker incorrectly deselects markers from other tracks.

### Root Cause
The ctrl-click logic is being handled by track-specific code in `computeMarkerSelection` that incorrectly filters by track.

### Fix
```typescript
// Place this BEFORE any other selection logic in clickMarkerAction:

if (mod && !shift) {
  // Ctrl-click should ALWAYS be a simple toggle, regardless of track
  const clickedUnit = getSelectionUnit(state, markerInfo, sourceRowId);
  
  // Check if ANY part of this unit is selected
  const isUnitSelected = clickedUnit.some(entry =>
    state.selection.some(s => 
      s.markerId === entry.markerId && 
      s.sourceRowId === entry.sourceRowId
    )
  );
  
  if (isUnitSelected) {
    // Remove just this unit, preserve everything else
    const newSelection = state.selection.filter(s =>
      !clickedUnit.some(u => 
        u.markerId === s.markerId && 
        u.sourceRowId === s.sourceRowId
      )
    );
    
    return {
      selection: newSelection,
      activeAnimationInstance: activeInstance,
      referenceMarker: newSelection.length > 0 ? state.referenceMarker : null
    };
  } else {
    // Add this unit to existing selection
    return {
      selection: [...state.selection, ...clickedUnit],
      activeAnimationInstance: activeInstance,
      referenceMarker: markerToReference(markerInfo, sourceRowId, true)
    };
  }
}

// Helper function to get selection unit
function getSelectionUnit(
  state: AnimationData,
  markerInfo: InstancedFrameInfo,
  sourceRowId: string
): SelectionEntry[] {
  const unit: SelectionEntry[] = [];
  const sourceRow = state.instancedTrackSources[sourceRowId];
  
  // Check if this is an attribute (depth 4)
  const depth = sourceRowId.split('/').length;
  if (depth === 4) {
    // This is an attribute - need parent and siblings
    const parentPath = sourceRowId.split('/').slice(0, 3).join('/');
    const parentData = state.computedRowData[parentPath];
    
    if (parentData) {
      const parentMarker = parentData.virtualFrames.find(f => f.stamp === markerInfo.stamp);
      if (parentMarker) {
        unit.push(markerToSelectionEntry(parentMarker, parentPath));
      }
    }
    
    // Add all sibling attributes
    const siblingPaths = Object.keys(state.computedRowData).filter(
      path => path.startsWith(parentPath + '/') && path.split('/').length === 4
    );
    
    for (const sibPath of siblingPaths) {
      const sibData = state.computedRowData[sibPath];
      const sibMarker = sibData.virtualFrames.find(f => f.stamp === markerInfo.stamp);
      if (sibMarker) {
        unit.push(markerToSelectionEntry(sibMarker, sibPath));
      }
    }
  } else if (isGroupRow(sourceRow)) {
    // This is a group - add it and children
    unit.push(markerToSelectionEntry(markerInfo, sourceRowId));
    
    const childPaths = Object.keys(state.computedRowData).filter(
      path => path.startsWith(sourceRowId + '/') && path.split('/').length === 4
    );
    
    for (const childPath of childPaths) {
      const childData = state.computedRowData[childPath];
      const childMarker = childData.virtualFrames.find(f => f.stamp === markerInfo.stamp);
      if (childMarker) {
        unit.push(markerToSelectionEntry(childMarker, childPath));
      }
    }
  } else {
    // Simple track - just itself
    unit.push(markerToSelectionEntry(markerInfo, sourceRowId));
  }
  
  return unit;
}
```

## Issue 4: Attribute Row Not Selecting Parent

### Problem
Clicking on an attribute row (e.g., position/x) doesn't select the parent group (position).

### Root Cause
The attribute detection logic doesn't properly identify parent-child relationships from the hierarchical path structure.

### Fix
```typescript
// Add this check at the beginning of clickMarkerAction, before group detection:

const pathDepth = sourceRowId.split('/').length;

// Check if this is an attribute (depth 4 in current system)
if (pathDepth === 4 && !shift && !mod) {
  const parentPath = sourceRowId.split('/').slice(0, 3).join('/');
  const parentSourceRow = state.instancedTrackSources[parentPath];
  
  if (parentSourceRow && parentSourceRow.data.length > 1) {
    // This is an attribute of a complex datatype
    const selectionEntries: SelectionEntry[] = [];
    
    // Add parent group marker
    const parentData = state.computedRowData[parentPath];
    if (parentData) {
      const parentMarker = parentData.virtualFrames.find(f => f.stamp === markerInfo.stamp);
      if (parentMarker) {
        selectionEntries.push(markerToSelectionEntry(parentMarker, parentPath));
      }
    }
    
    // Add all sibling attributes
    const siblingPaths = Object.keys(state.instancedTrackSources).filter(
      path => path.startsWith(parentPath + '/') && path.split('/').length === 4
    );
    
    for (const sibPath of siblingPaths) {
      const sibData = state.computedRowData[sibPath];
      if (sibData) {
        const sibMarker = sibData.virtualFrames.find(f => f.stamp === markerInfo.stamp);
        if (sibMarker) {
          selectionEntries.push(markerToSelectionEntry(sibMarker, sibPath));
        }
      }
    }
    
    return {
      selection: selectionEntries,
      activeAnimationInstance: activeInstance,
      referenceMarker: markerToReference(markerInfo, sourceRowId, false)
    };
  }
}
```

## Complete Integration

To integrate all fixes, restructure `clickMarkerAction` with this priority order:

```typescript
export function clickMarkerAction(
  state: AnimationData,
  markerId: string,
  sourceRowId: string,
  shift?: boolean,
  mod?: boolean,
): Partial<AnimationData> {
  // ... initial setup ...
  
  // 1. Handle instance switching (existing code)
  if (shouldSwitchInstance(clickedInstanceId, state.activeAnimationInstance)) {
    // ... existing instance switch logic ...
  }
  
  // 2. Handle Ctrl-click FIRST (Issue #3 fix)
  if (mod && !shift) {
    // ... ctrl-click toggle logic from Issue 3 fix ...
  }
  
  // 3. Handle attributes (Issue #4 fix)
  const pathDepth = sourceRowId.split('/').length;
  if (pathDepth === 4) {
    // ... attribute selection logic from Issue 4 fix ...
  }
  
  // 4. Handle groups (Issues #1 and #2 fixes)
  if (isGroupRow(sourceRow)) {
    if (!shift && !mod) {
      // ... Issue 1 fix ...
    } else if (shift && state.referenceMarker) {
      // ... Issue 2 fix ...
    }
  }
  
  // 5. Fall through to regular selection
  // ... existing fallback logic ...
}
```

## Testing Checklist

After implementing these fixes, verify:

1. ✅ First click on group selects all children
2. ✅ Shift-click within group maintains children selection
3. ✅ Ctrl-click in different track preserves other track selections
4. ✅ Clicking attribute selects parent and siblings

## Notes

- These fixes work with the current 4-level depth system
- They prepare for the future where groups and tracks can be at any depth
- The key principle: selection units (what gets selected together) are determined by the hierarchical structure
- Complex datatypes (vector3, euler, etc.) are treated as groups with track children