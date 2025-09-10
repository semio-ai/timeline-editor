# Frame Snapping Behavior for Drag Operations

## Overview

The drag system now implements frame-based snapping by default, with the Alt/Option key allowing free movement. This aligns with the behavior of other timeline controls like the bounds-cart and provides a more intuitive and precise editing experience.

## Default Behavior: Snap to Frames

### How It Works

When dragging markers without any modifier keys:
- Markers automatically snap to the nearest frame boundary
- Frame boundaries are calculated based on the current framerate
- Provides precise frame-aligned positioning for animation keyframes

### Frame Calculation

The snapping uses the animation framerate to determine frame boundaries:
```typescript
const frameTime = 1000 / framerate; // milliseconds per frame
const snappedDelta = Math.round(deltaStamp / frameTime) * frameTime;
```

For example, at 24 fps:
- Frame time = 1000/24 ≈ 41.67ms
- Dragging to 100ms would snap to 83.33ms (2 frames)
- Dragging to 120ms would snap to 125ms (3 frames)

## Alt Key: Free Movement

### Enabling Free Movement

Hold the Alt key (Option on Mac) while dragging to:
- Disable frame snapping
- Allow positioning at any timestamp
- Enable sub-frame precision for special timing needs

### Use Cases for Free Movement

- Creating specific timing effects that don't align with frames
- Fine-tuning transitions between keyframes
- Working with variable framerates or time-based (not frame-based) animations
- Matching external timing references

## Implementation Details

### Key Binding

```typescript
onDrag: ({ movement: [mx], altKey, event }) => {
  // Snap to frames by default (when Alt is NOT pressed)
  // Free movement when Alt key is held
  const shouldSnapToFrames = !altKey;
  
  // Update drag delta with frame snapping based on Alt key
  updateDragDelta(deltaStamp, shouldSnapToFrames);
}
```

### Consistency with Other Controls

The frame snapping behavior matches other timeline controls:

#### Bounds Cart
```typescript
onDrag: (position, altKey) => {
  const newValue = altKey || altPressed 
    ? position 
    : closestFrame(position, frameCount);
  updateBounds(newBounds[0], newBounds[1]);
}
```

#### Playhead Control
Similar snapping logic with Alt key for free movement

## User Experience

### Visual Feedback

1. **During Drag (Snapped)**:
   - Marker jumps between frame positions
   - Clear frame-aligned movement
   - Predictable positioning

2. **During Drag (Free - with Alt)**:
   - Smooth continuous movement
   - Follows mouse precisely
   - Sub-frame positioning visible

### Modifier Key Summary

| Key | Action | Result |
|-----|--------|--------|
| None | Drag | Snap to nearest frame |
| Alt/Option | Drag | Free movement (no snapping) |
| Shift | Click | Range selection (not affected by drag) |
| Ctrl/Cmd | Click | Multi-select (not affected by drag) |

## Benefits

### For Animators

1. **Precision**: Easy to align keyframes to exact frame boundaries
2. **Speed**: No need to manually align to frames
3. **Flexibility**: Alt key provides escape hatch for special cases
4. **Consistency**: Same behavior across all timeline controls

### For the System

1. **Predictable**: Frame-aligned keyframes are easier to interpolate
2. **Clean**: Reduces floating-point precision issues
3. **Compatible**: Works well with frame-based export formats
4. **Performance**: Frame-aligned data can be optimized

## Testing the Feature

### Manual Testing Steps

1. **Test Default Snapping**:
   - Drag a marker without holding any keys
   - Verify it snaps to frame boundaries
   - Check frame alignment at different zoom levels

2. **Test Free Movement**:
   - Hold Alt and drag a marker
   - Verify smooth, continuous movement
   - Confirm sub-frame positioning works

3. **Test Framerate Changes**:
   - Change project framerate
   - Verify snapping adjusts to new frame boundaries
   - Test both 24fps and 30fps (or other rates)

4. **Test Multi-Selection**:
   - Select multiple markers
   - Drag with and without Alt
   - Verify all markers maintain relative positions

### Expected Behavior

- ✅ Default drag snaps to frames
- ✅ Alt+drag allows free movement
- ✅ Snapping respects current framerate
- ✅ Works at all zoom levels
- ✅ Multi-selection maintains relative positions
- ✅ Consistent with other timeline controls

## Configuration

### Framerate Impact

The framerate setting directly affects snapping granularity:

- **24 fps**: ~41.67ms per frame
- **30 fps**: ~33.33ms per frame
- **60 fps**: ~16.67ms per frame

Higher framerates provide finer snapping granularity.

### Future Enhancements

Potential improvements for frame snapping:

1. **Visual Snap Indicators**: Show frame boundaries during drag
2. **Magnetic Snapping**: Stronger snap when very close to frame
3. **Custom Snap Points**: User-defined snap positions
4. **Snap Strength Setting**: Configurable snap threshold
5. **Grid Overlay**: Optional frame grid visualization

## Related Components

- `packages/animation/src/components/three/canvas-sheet/data-point.tsx` - Main implementation
- `packages/animation/src/actions/drag/drag-actions.ts` - Snapping logic
- `packages/animation/src/components/three/canvas-sheet/overlays/bounds-cart.tsx` - Reference implementation
- `packages/utils/src/closest-frame.ts` - Frame calculation utility

## Summary

Frame snapping is now the default behavior for dragging operations, providing a more intuitive and precise editing experience. The Alt key modifier allows for free movement when needed, giving users complete control over keyframe positioning. This implementation maintains consistency with other timeline controls while providing the flexibility needed for various animation workflows.