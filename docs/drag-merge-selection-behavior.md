# Drag Merge Selection Behavior

## Overview

When dragging timeline markers in the animation editor, markers at the same timestamp are automatically merged into a single frame. This document describes how selection is handled when dragged markers merge with existing markers.

## The Problem

When a selected marker is dragged to the same timestamp as an unselected marker, they merge into a single frame containing multiple points. The original issue was that after the drag operation completed, both the originally selected marker AND the unselected marker at that timestamp would become selected, even though the user never intended to select the second marker.

### Example Scenario

1. User has two markers:
   - Marker A at timestamp 0.1 (selected)
   - Marker B at timestamp 0.2 (not selected)
2. User drags Marker A to timestamp 0.2
3. Markers A and B merge into a single frame at 0.2
4. **Problem**: Both A and B are now selected, even though B was never selected by the user

## The Solution

The selection logic after drag has been updated to only select frames where **ALL** points were previously selected. This prevents unintentionally selecting markers that happen to be at the merge destination.

### Selection Rules After Drag

A frame is selected after a drag operation if and only if:
1. It contains at least one previously selected point, AND
2. ALL points in the frame were previously selected

This means:
- ✅ A frame with only previously selected points → Selected
- ❌ A frame with mixed selected/unselected points → Not selected
- ❌ A frame with only unselected points → Not selected

## Expected Behaviors

### Case 1: Dragging to Empty Timestamp
- **Scenario**: Selected marker dragged to timestamp with no existing markers
- **Result**: Marker remains selected at new position

### Case 2: Dragging to Merge with Unselected Marker
- **Scenario**: Selected marker dragged to same timestamp as unselected marker
- **Result**: Merged frame is NOT selected (contains unselected point)
- **Rationale**: Prevents accidentally selecting markers the user didn't intend to select

### Case 3: Multiple Selected Markers to Same Timestamp
- **Scenario**: Multiple selected markers dragged to same timestamp
- **Result**: Merged frame IS selected (all points were selected)

### Case 4: Selected Marker to Timestamp with Multiple Unselected
- **Scenario**: One selected marker dragged to timestamp with multiple unselected markers
- **Result**: Merged frame is NOT selected

### Case 5: Multi-Track Merge
- **Scenario**: Selected markers from different tracks merge at same timestamp
- **Result**: Frame selected only if ALL points across ALL tracks were selected

## Implementation Details

The logic is implemented in `commit-drag.ts`:

```typescript
draft.selection = newFrames.filter((frame) => {
  const selectedPointsInFrame = frame.points.filter((point) =>
    selectedKeypointIds.has(point.id),
  );
  const unselectedPointsInFrame = frame.points.filter(
    (point) => !selectedKeypointIds.has(point.id),
  );

  // Only select if all points were selected (no unselected points)
  return selectedPointsInFrame.length > 0 && unselectedPointsInFrame.length === 0;
});
```

## User Experience Implications

### Advantages
1. **No Accidental Selection**: Users won't accidentally select markers they didn't intend to
2. **Predictable Behavior**: Selection follows user intent
3. **Clean Workflow**: No need to deselect unwanted markers after dragging

### Trade-offs
1. **Selection Lost on Merge**: If dragging to merge with unselected markers, selection is lost
2. **Requires Reselection**: User must manually select the merged frame if desired
3. **Different from Some Tools**: Some animation tools select the entire merged frame

## Alternative Approaches Considered

### 1. Partial Selection (Rejected)
- **Idea**: Keep only the selected points selected within a merged frame
- **Problem**: Frames are atomic units; can't have partially selected frames
- **Technical Limitation**: Selection works at frame level, not point level

### 2. Always Select Merged Frame (Rejected)
- **Idea**: Select any frame containing at least one previously selected point
- **Problem**: Leads to unintended selection of unselected markers
- **User Impact**: Confusing and requires manual deselection

### 3. Prevent Merging During Drag (Not Implemented)
- **Idea**: Don't allow markers to merge during drag operations
- **Problem**: Would require complex UI indicators and constraints
- **User Impact**: Less flexible, prevents intentional merging

## Best Practices for Users

1. **Before Merging**: If you want to merge markers and keep them selected, select all markers at the destination timestamp before dragging
2. **Multi-Selection**: Use Shift+Click or Cmd/Ctrl+Click to select multiple markers before dragging
3. **After Merge**: If selection is lost due to merge, click the merged frame to reselect it

## Technical Considerations

### Frame Identity
- Frames are identified by their constituent point IDs
- When points merge, a new frame is created with multiple points
- The frame's identity is the combination of all its points

### Selection Persistence
- Selection is stored as an array of InstancedFrameInfo objects
- After drag, frames are recomputed from the modified tracks
- Selection is rebuilt by matching point IDs

### Performance
- Selection filtering happens once at drag commit
- No performance impact during drag operation
- Efficient for typical animation workflows

## Future Enhancements

Potential improvements to consider:
1. **Visual Feedback**: Show merge preview during drag with selection implications
2. **Merge Options**: User preference for merge selection behavior
3. **Undo Support**: Ensure undo properly restores pre-merge selection state
4. **Smart Selection**: Option to auto-select entire frame when majority of points were selected