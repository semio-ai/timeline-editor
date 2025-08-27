# TickBackground Examples

The `TickBackground` component provides a high-performance, shader-based tick rendering system that can display major, minor, and sub-minor ticks with smooth fade transitions based on zoom level.

## Basic Usage

```tsx
import { TickBackground } from "./overlays/tick-background";

// Simple tick background with default settings
<TickBackground height={36} theme={Theme.Light} />
```

## Component Integration

### Timeline Renderer
```tsx
export const TimelineRenderer = memo(function TimelineRenderer({
  theme = Theme.Light,
  // ... other props
}: TimelineRendererProps) {
  return (
    <>
      {/* Tick background behind other elements */}
      <TickBackground 
        height={36} 
        theme={theme} 
        position={[0.5, 0, -0.2]} 
        majorInterval={1.0}    // 1 second major ticks
        minorInterval={0.1}    // 0.1 second minor ticks
        subMinorInterval={0.02} // ~50fps sub-minor ticks
      />
      <HoverMarker height={36} theme={theme} />
      <PlayheadMarker height={36} theme={theme} />
      {/* ... other overlays */}
    </>
  );
});
```

### Track List
```tsx
export const TrackList = memo(function TrackList({
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  // ... other props
}: TrackListProps) {
  return (
    <>
      {/* Track content */}
      <group ref={groupRef}>
        {/* ... track renderers */}
      </group>

      {/* Overlays including tick background */}
      <group position={[0, trackAreaCenterY, 0]}>
        <TickBackground 
          height={availableHeight} 
          theme={theme} 
          position={[0.5, 0, -0.2]}
          // Denser ticks for detailed track view
          majorInterval={0.5}     // Every 0.5 seconds
          minorInterval={0.1}     // Every 0.1 seconds  
          subMinorInterval={0.02} // Every ~2 frames
        />
        {/* ... other overlays */}
      </group>
    </>
  );
});
```

### Minimap Display
```tsx
export const MinimapDisplay = memo(function MinimapDisplay({
  theme = Theme.Light,
  // ... other props
}: MinimapDisplayProps) {
  return (
    <group>
      <TickBackground 
        height={height} 
        theme={theme} 
        position={[0.5, 0, -0.2]}
        // Sparser ticks for overview
        majorInterval={5.0}     // Every 5 seconds
        minorInterval={1.0}     // Every 1 second
        subMinorInterval={0.2}  // Every 0.2 seconds
        opacity={0.6}          // Subtle for overview
      />
      {/* ... minimap content */}
    </group>
  );
});
```

## Customization Options

### Theme Variants
```tsx
// Light theme (default)
<TickBackground height={36} theme={Theme.Light} />

// Dark theme
<TickBackground height={36} theme={Theme.Dark} />
```

### Tick Intervals
```tsx
// Video editing timeline (30fps)
<TickBackground
  height={36}
  majorInterval={1.0}        // 1 second
  minorInterval={1.0/30}     // 1 frame at 30fps
  subMinorInterval={1.0/120} // Sub-frame precision
/>

// Audio timeline (high precision)
<TickBackground
  height={36}
  majorInterval={1.0}         // 1 second
  minorInterval={0.1}         // 100ms
  subMinorInterval={0.01}     // 10ms
/>

// Animation keyframes
<TickBackground
  height={36}
  majorInterval={1.0}         // 1 second
  minorInterval={0.25}        // Quarter notes
  subMinorInterval={1.0/16}   // Sixteenth notes
/>
```

### Tick Heights
```tsx
// Custom tick visibility
<TickBackground
  height={36}
  majorHeight={1.0}      // Full height major ticks
  minorHeight={0.7}      // 70% height minor ticks
  subMinorHeight={0.4}   // 40% height sub-minor ticks
/>

// Minimal ticks
<TickBackground
  height={36}
  majorHeight={0.6}      // Shorter major ticks
  minorHeight={0.3}      // Even shorter minor ticks
  subMinorHeight={0.15}  // Barely visible sub-minor
/>
```

### Visual Customization
```tsx
// Subtle background ticks
<TickBackground
  height={36}
  theme={Theme.Light}
  opacity={0.3}           // Very subtle
  tickWidth={0.001}       // Thinner lines
/>

// Prominent ticks
<TickBackground
  height={36}
  theme={Theme.Dark}
  opacity={1.0}           // Full opacity
  tickWidth={0.005}       // Thicker lines
/>
```

### Positioning
```tsx
// Behind data but in front of background
<TickBackground 
  position={[0.5, 0, -0.1]}  // Slightly behind
/>

// Far background
<TickBackground 
  position={[0.5, 0, -0.5]}  // Deep background
/>

// Custom horizontal offset
<TickBackground 
  position={[0.6, 0, -0.2]}  // Offset to right
/>
```

## Zoom Behavior

The tick system automatically shows/hides tick levels based on zoom:

- **Major ticks**: Always visible when zoom > 0.1x
- **Minor ticks**: Fade in when zoom > 0.5x 
- **Sub-minor ticks**: Fade in when zoom > 2.0x

This creates smooth transitions as users zoom in and out.

## Performance Considerations

### Advantages
- **Single draw call**: All ticks rendered in one shader pass
- **Procedural generation**: No memory overhead for tick arrays
- **Zoom-adaptive**: Automatically adjusts detail level
- **Smooth transitions**: Hardware-accelerated fade animations

### Best Practices
- Use appropriate tick intervals for your use case
- Position behind other content with negative Z values
- Adjust opacity for subtle background presence
- Consider height ratios for visual hierarchy

## Integration with Existing Systems

The `TickBackground` automatically integrates with:

- **useInvariantScale()**: Responds to zoom level changes
- **Camera frustum**: Automatically fits viewport
- **Theme system**: Adapts colors to light/dark modes
- **Three.js materials**: Standard shader material lifecycle

## Common Patterns

### Conditional Rendering
```tsx
// Only show ticks in certain render modes
{trackRender === TrackRender.Key && (
  <TickBackground 
    height={availableHeight} 
    theme={theme}
    position={[0.5, 0, -0.2]}
  />
)}
```

### Dynamic Configuration
```tsx
// Adjust tick density based on content
const tickConfig = useMemo(() => {
  const baseInterval = duration > 60 ? 5.0 : 1.0; // Sparser for long content
  return {
    majorInterval: baseInterval,
    minorInterval: baseInterval / 5,
    subMinorInterval: baseInterval / 25,
  };
}, [duration]);

<TickBackground 
  height={36} 
  theme={theme}
  {...tickConfig}
/>
```

### Multiple Tick Layers
```tsx
// Combine different tick systems
<>
  {/* Main time ticks */}
  <TickBackground 
    height={36} 
    theme={theme}
    position={[0.5, 0, -0.3]}
    majorInterval={1.0}
    minorInterval={0.1}
  />
  
  {/* Beat markers for music */}
  <TickBackground 
    height={36} 
    theme={theme}
    position={[0.5, 0, -0.2]}
    majorInterval={60.0/120} // 120 BPM quarter notes
    minorInterval={60.0/480} // Sixteenth notes
    opacity={0.5}
  />
</>
```
