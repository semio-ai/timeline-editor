# Three.js Utilities

This directory contains high-performance Three.js components for 3D animation visualization.

## MotionCubicBezierFill

A high-performance cubic Bezier fill component that creates filled areas below animated curves using Motion values.

### Overview

`MotionCubicBezierFill` creates a filled area that extends from a cubic Bezier curve down to a specified baseline. It's designed to work in perfect synchronization with `MotionCubicBezierLine` to provide complete curve visualization with both line and fill elements.

### Key Features

- **Motion Value Integration**: Seamlessly integrates with Motion's animation system
- **High Performance**: Uses custom BufferGeometry with triangle strips for efficient GPU rendering
- **Perfect Synchronization**: Shares motion values with line components for frame-perfect alignment
- **Flexible Baseline**: Configurable baseline position for various visualization needs
- **Event Handling**: Supports pointer events for interactive applications

### Performance Characteristics

The implementation prioritizes performance through several key design decisions:

1. **Triangle Strip Topology**: Uses efficient triangle strips to minimize vertex count
2. **Single Draw Call**: Each fill is rendered as a single mesh to reduce GPU state changes
3. **Geometry Recreation**: Recreates geometry on motion value changes rather than updating vertices in-place
4. **Motion Value Events**: Uses Motion's efficient change detection system

### Usage

#### Basic Example

```tsx
import { useMotionValue } from "motion/react";
import { MotionCubicBezierFill } from "@semio/timeline-editor";

function MyComponent() {
  const startX = useMotionValue(0);
  const startY = useMotionValue(50);
  const endX = useMotionValue(100);
  const endY = useMotionValue(50);
  const cp1X = useMotionValue(25);
  const cp1Y = useMotionValue(75);
  const cp2X = useMotionValue(75);
  const cp2Y = useMotionValue(25);

  return (
    <MotionCubicBezierFill
      start={{ x: startX, y: startY }}
      end={{ x: endX, y: endY }}
      controlPoint1={{ x: cp1X, y: cp1Y }}
      controlPoint2={{ x: cp2X, y: cp2Y }}
      baseline={0}
      color="#ff0000"
      opacity={0.5}
      segments={50}
    />
  );
}
```

#### With Line Component

```tsx
import { MotionCubicBezierLine, MotionCubicBezierFill } from "@semio/timeline-editor";

function CurveWithFill() {
  // Shared motion values
  const motionValues = {
    start: { x: useMotionValue(0), y: useMotionValue(30) },
    end: { x: useMotionValue(100), y: useMotionValue(70) },
    controlPoint1: { x: useMotionValue(25), y: useMotionValue(60) },
    controlPoint2: { x: useMotionValue(75), y: useMotionValue(40) },
  };

  return (
    <>
      {/* Fill (rendered behind) */}
      <MotionCubicBezierFill
        {...motionValues}
        baseline={0}
        color="#4ecdc4"
        opacity={0.5}
        z={1}
      />
      
      {/* Line (rendered on top) */}
      <MotionCubicBezierLine
        {...motionValues}
        color="#4ecdc4"
        lineWidth={2}
        z={2}
      />
    </>
  );
}
```

### Integration with TransitionSegment

The component is integrated into `TransitionSegment` to provide fill visualization for Preview and Transition render modes:

```tsx
// In TransitionSegment component
{(trackRender === TrackRender.Preview || trackRender === TrackRender.Transition) &&
  !isBuffer && (
    <MotionCubicBezierFill
      start={{ x: startX, y: startYMotion }}
      end={{ x: endX, y: endYMotion }}
      controlPoint1={{ x: controlPoint1X, y: controlPoint1Y }}
      controlPoint2={{ x: controlPoint2X, y: controlPoint2Y }}
      baseline={-height * 0.4}
      baselineExtension={height * 0.1}
      color={color}
      opacity={0.5}
      segments={50}
      z={1}
    />
  )}
```

### API Reference

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `start` | `{x: MotionValue<number>, y: MotionValue<number>}` | Required | Start point motion values |
| `end` | `{x: MotionValue<number>, y: MotionValue<number>}` | Required | End point motion values |
| `controlPoint1` | `{x: MotionValue<number>, y: MotionValue<number>}` | Required | First control point motion values |
| `controlPoint2` | `{x: MotionValue<number>, y: MotionValue<number>}` | Required | Second control point motion values |
| `baseline` | `number` | `0` | Y coordinate for the bottom of the fill |
| `baselineExtension` | `number` | `0` | Additional extension below baseline for complete coverage |
| `z` | `number` | `0` | Z coordinate for the fill mesh |
| `color` | `string` | `"#ffffff"` | Fill color |
| `opacity` | `number` | `0.5` | Fill opacity |
| `transparent` | `boolean` | `true` | Enable transparency |
| `segments` | `number` | `20` | Number of curve segments (higher = smoother) |
| `onPointerOver` | `(event: any) => void` | `undefined` | Pointer over event handler |
| `onPointerOut` | `(event: any) => void` | `undefined` | Pointer out event handler |
| `onClick` | `(event: any) => void` | `undefined` | Click event handler |

### Baseline Configuration

The fill component supports precise control over the bottom boundary of the filled area:

- **`baseline`**: Sets the primary Y coordinate where the fill ends
- **`baselineExtension`**: Adds additional space below the baseline for complete visual coverage

This is particularly useful in padded coordinate systems where curves may extend beyond their nominal bounds. For example, in TransitionSegment, curves are positioned within a buffered range, and the baseline extension ensures the fill covers the entire visual area without gaps.

```tsx
// Ensure complete coverage in padded systems
<MotionCubicBezierFill
  baseline={-height * 0.4}        // Bottom of visual range
  baselineExtension={height * 0.1} // Extra coverage for safety
  // ... other props
/>
```

### Implementation Notes

#### Geometry Creation

The component creates a BufferGeometry with vertices arranged in a triangle strip pattern:

1. **Curve Points**: Sample the cubic Bezier curve at specified segment intervals
2. **Baseline Points**: Create corresponding points at the baseline Y coordinate
3. **Triangle Strip**: Connect curve and baseline points to form a filled area
4. **Indices**: Use triangle strip indices for efficient GPU rendering

#### Motion Value Handling

- Uses `useMotionValueEvent` to listen for changes in all motion values
- Triggers component re-render using `useReducer` pattern
- Recalculates geometry on every motion value change for simplicity and reliability

#### Memory Management

- Geometry and materials are recreated on each render
- Relies on Three.js's garbage collection for cleanup
- Consider implementing object pooling for high-frequency scenarios

### Performance Considerations

#### Recommended Practices

1. **Segment Count**: Use appropriate segment count (20-50 for most cases)
2. **Z-Layering**: Use z values to control rendering order (fill behind line)
3. **Color Consistency**: Share colors between fill and line components
4. **Motion Value Sharing**: Reuse motion values between related components

#### Optimization Opportunities

For applications with many animated fills, consider:

1. **Instanced Rendering**: Use Three.js InstancedMesh for identical fills
2. **Vertex Buffer Updates**: Implement in-place vertex updates for better memory usage
3. **Level of Detail**: Reduce segment count for distant or less important fills
4. **Culling**: Skip rendering fills outside the viewport

### Storybook Examples

See the following Storybook stories for interactive examples:

- `animation/MotionCubicBezierFill` - Individual component examples
- `animation/MotionCubicBezierCombined` - Line and fill combinations
- `animation/TransitionSegment Integration` - Real-world usage examples

### Testing

The component is tested through:

1. **Storybook Stories**: Visual testing and interaction verification
2. **Integration Tests**: Usage within TransitionSegment component
3. **Performance Monitoring**: Frame rate impact assessment

### Future Enhancements

Potential improvements for future versions:

1. **Vertex Buffer Updates**: Implement efficient vertex updates for better performance
2. **Texture Support**: Add support for gradient or pattern fills
3. **Multiple Baselines**: Support for variable baseline positions
4. **Instancing**: Built-in support for rendering many similar fills efficiently