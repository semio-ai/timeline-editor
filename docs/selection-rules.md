# Selection Rules and Animation Instance Constraints

## Overview

This document defines the selection behavior in the animation system, with particular focus on how animation instances create boundaries for multi-selection operations.

## Core Concepts

### Animation Instance
- Each animation can have multiple instances (e.g., different objects using the same animation)
- An instance is identified by `instanceId` in the `SourceRowData`
- Only one instance can be "active" for selection at a time

### Selection Boundary
- Multi-selection is **only allowed within the same animation instance**
- Crossing instance boundaries automatically switches context and clears incompatible selections

## Selection Behaviors

### 1. Single Click (No Modifiers)
**Action**: Click on a marker without any modifier keys

**Behavior**:
- If marker is in the **same instance** as `activeAnimationInstance`:
  - Clear current selection
  - Select clicked marker
  - Set clicked marker as reference
  
- If marker is in a **different instance**:
  - Set `activeAnimationInstance` to marker's instance
  - Clear entire selection
  - Select only the clicked marker
  - Set clicked marker as reference

```typescript
// Implementation pattern
if (clickedInstanceId !== state.activeAnimationInstance) {
  // Switch context
  state.activeAnimationInstance = clickedInstanceId;
  state.selection = [clickedMarker];
  state.referenceMarker = clickedMarker;
} else {
  // Normal single selection within same instance
  state.selection = [clickedMarker];
  state.referenceMarker = clickedMarker;
}
```

### 2. Ctrl/Cmd-Click (Toggle Selection)
**Action**: Click with Ctrl (PC) or Cmd (Mac) held

**Behavior**:
- If marker is in the **same instance**:
  - Toggle marker's selection state
  - If adding, set as reference marker
  - If removing and was reference, clear reference
  
- If marker is in a **different instance**:
  - Switch to new instance (same as single click)
  - Clear selection
  - Select only clicked marker
  - **Note**: Does NOT toggle, switches context instead

```typescript
// Implementation pattern
if (clickedInstanceId !== state.activeAnimationInstance) {
  // Different instance - switch context (no toggle)
  state.activeAnimationInstance = clickedInstanceId;
  state.selection = [clickedMarker];
  state.referenceMarker = clickedMarker;
} else {
  // Same instance - toggle behavior
  if (isSelected(clickedMarker)) {
    state.selection = removeFromSelection(clickedMarker);
    if (isReference(clickedMarker)) {
      state.referenceMarker = null;
    }
  } else {
    state.selection = [...state.selection, clickedMarker];
    state.referenceMarker = clickedMarker;
  }
}
```

### 3. Shift-Click (Range Selection)
**Action**: Click with Shift held

**Behavior**:
- If **no reference marker** exists:
  - Behave like Ctrl-click (add if not selected)
  
- If reference marker exists and clicked marker is in **same instance**:
  - If markers share the same track (based on track IDs):
    - Select all markers between reference and clicked (inclusive)
    - Do NOT update reference marker
  - If markers are in different tracks:
    - Add clicked marker to selection (like Ctrl-click)
    - Update reference to clicked marker
    
- If reference marker exists but clicked marker is in **different instance**:
  - Switch context (same as single click)
  - Clear selection
  - Select only clicked marker

```typescript
// Implementation pattern
if (!state.referenceMarker) {
  // No reference - act like ctrl-click
  handleCtrlClick();
} else if (clickedInstanceId !== referenceInstanceId) {
  // Different instance - switch context
  state.activeAnimationInstance = clickedInstanceId;
  state.selection = [clickedMarker];
  state.referenceMarker = clickedMarker;
} else if (markersShareTrack(reference, clicked)) {
  // Same instance, same track - range select
  const range = getMarkersBetween(reference, clicked);
  state.selection = mergeWithSelection(range);
  // Do NOT update reference
} else {
  // Same instance, different track - add selection
  state.selection = [...state.selection, clickedMarker];
  state.referenceMarker = clickedMarker;
}
```

### 4. Drag Selection
**Action**: Dragging selected markers

**Constraints**:
- Can only drag markers from the **same animation instance**
- If selection contains markers from multiple instances (shouldn't happen), filter to active instance
- Drag preview shows only for markers in active instance

```typescript
// Drag initiation
startDragging: () => {
  const state = get();
  // Filter to only markers in active instance
  const validSelection = state.selection.filter(
    s => s.instanceId === state.activeAnimationInstance
  );
  
  if (validSelection.length === 0) return;
  
  // Proceed with drag using only valid selection
  initializeDrag(validSelection);
}
```

## Data Structure

### Selection Entry
```typescript
interface SelectionEntry {
  markerId: string;        // Unique marker identifier
  sourceRowId: string;     // Source row for efficient lookup
  instanceId: string;      // Animation instance boundary
  stamp?: number;         // Cached timestamp
  trackIds?: string[];    // Cached track IDs for range selection
}
```

### Reference Marker
```typescript
interface ReferenceMarker {
  markerId: string;
  sourceRowId: string;
  instanceId: string;      // Instance context for range selection
  isAddMode?: boolean;    // Whether shift-selection adds or replaces
}
```

### Animation State
```typescript
interface AnimationData {
  selection: SelectionEntry[];
  referenceMarker: ReferenceMarker | null;
  activeAnimationInstance?: string;  // Current selection context
  // ... other state
}
```

## Instance ID Flow

The instance ID is embedded in the data hierarchy:

```
InstancedFrameInfo
├── id: string
├── stamp: number
└── points: SourceRowData[]
    └── instanceId: string  // <-- Instance boundary information
```

This means:
- Every marker inherently knows its animation instance
- No additional lookups needed to determine instance boundaries
- Instance validation is O(1) operation

## Selection Validation Rules

### Valid Selection States
1. **Empty**: No selection, no reference, no active instance
2. **Single**: One marker selected, same marker as reference, active instance set
3. **Multi (Same Track)**: Multiple markers in same track and instance
4. **Multi (Different Tracks)**: Multiple markers in same instance but different tracks
5. **Active Instance**: Selection only contains markers from `activeAnimationInstance`

### Invalid States (Should Never Occur)
1. Selection contains markers from different instances
2. Reference marker is not in selection
3. Reference marker has different instance than active instance
4. Active instance is set but selection is from different instance

### Validation Helper
```typescript
function validateSelection(state: AnimationData): boolean {
  // All selection entries must be from same instance
  const instances = new Set(state.selection.map(s => s.instanceId));
  if (instances.size > 1) return false;
  
  // If active instance set, selection must match
  if (state.activeAnimationInstance) {
    if (!state.selection.every(s => s.instanceId === state.activeAnimationInstance)) {
      return false;
    }
  }
  
  // Reference marker must be in selection and match instance
  if (state.referenceMarker) {
    const refInSelection = state.selection.some(
      s => s.markerId === state.referenceMarker.markerId
    );
    if (!refInSelection) return false;
    
    if (state.referenceMarker.instanceId !== state.activeAnimationInstance) {
      return false;
    }
  }
  
  return true;
}
```

## Implementation Checklist

- [ ] Add `instanceId` to `SelectionEntry` interface
- [ ] Add `instanceId` to `ReferenceMarker` interface  
- [ ] Add `activeAnimationInstance` to store state
- [ ] Update `clickMarker` to handle instance switching
- [ ] Update `computeMarkerSelection` to respect instance boundaries
- [ ] Add instance validation to `startDragging`
- [ ] Update selection rendering to highlight active instance
- [ ] Add visual indicator for active animation instance
- [ ] Test instance switching behavior
- [ ] Test multi-selection within same instance
- [ ] Verify selection clears when switching instances

## Visual Feedback

### Selection Appearance
- **Active Instance Markers**: Full opacity, normal selection highlight
- **Inactive Instance Markers**: Reduced opacity, no selection possible
- **Instance Switch Preview**: Brief highlight when hovering over different instance

### UI Indicators
- Show active instance name in toolbar/header
- Different background tint for active instance rows
- Badge or icon showing instance context
- Tooltip explaining why selection is limited to current instance

## Edge Cases

### Case 1: Deleting Active Instance
- Clear selection
- Clear reference marker
- Clear `activeAnimationInstance`

### Case 2: Loading New Animation
- Preserve `activeAnimationInstance` if it exists in new data
- Otherwise, clear selection state

### Case 3: Undo/Redo Across Instance Switch
- Store instance switch as undoable action
- Restore both selection and active instance together

## Testing Scenarios

### Basic Selection Tests
1. Click marker in instance A → selection contains only that marker
2. Click marker in instance B → switches to B, clears A selection
3. Ctrl-click in same instance → toggles selection
4. Ctrl-click in different instance → switches instance (no toggle)

### Range Selection Tests
1. Shift-click in same track, same instance → range selection works
2. Shift-click in different track, same instance → adds to selection
3. Shift-click in different instance → switches instance

### Drag Tests
1. Drag selection within instance → all selected markers move
2. Start drag with mixed instances (shouldn't happen) → filters to active
3. Drag to position causing instance overlap → handles gracefully

## Conclusion

The animation instance boundary is a fundamental constraint that ensures selection operations remain meaningful within their animation context. By embedding instance information in the data structure and enforcing boundaries at the action level, we create a robust and predictable selection system that prevents invalid states while maintaining intuitive user interactions.