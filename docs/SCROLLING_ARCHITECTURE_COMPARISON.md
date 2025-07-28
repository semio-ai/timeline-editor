# Scrolling Architecture Comparison for Unified Track Rendering

## Overview

This document compares two approaches for handling scrolling in a unified track rendering system: synchronized scrolling with camera movement vs. full-height View that scrolls natively with HTML.

## Approach 1: Camera-Based Scrolling

In this approach, the 3D View has a fixed viewport size, and scrolling is achieved by moving the camera.

```tsx
<div className="grid grid-cols-[298px_1fr] h-screen">
  {/* HTML controls with native scroll */}
  <div className="overflow-y-auto">
    {tracks.map(track => <ControlWidget key={track.id} />)}
  </div>
  
  {/* Fixed-size 3D View */}
  <View className="h-full">
    <OrthographicCamera position={[0, scrollY, 100]} />
    <UnifiedTrackScene /> {/* Full height scene */}
  </View>
</div>
```

### Pros
1. **Performance**
   - Fixed viewport size = consistent GPU workload
   - Natural frustum culling (only visible tracks render)
   - No need to rebuild WebGL context on resize
   - Smooth 60+ FPS scrolling

2. **Memory Efficiency**
   - Canvas size remains constant
   - WebGL buffers don't grow with track count
   - Better for 1000+ tracks

3. **Smooth Interactions**
   - Camera transforms are GPU-accelerated
   - No DOM reflow/repaint
   - Gesture handling remains in 3D space

### Cons
1. **Complex Synchronization**
   - Must sync HTML scroll position with camera
   - Potential for drift between sides
   - Custom scrollbar implementation needed

2. **Non-Native Feel**
   - Scroll physics must be reimplemented
   - Momentum scrolling needs custom code
   - Accessibility concerns with custom scroll

3. **Event Handling Complexity**
   - Mouse position requires viewport transformation
   - Tooltip positioning more complex
   - Selection box calculations need adjustment

## Approach 2: Full-Height Native Scrolling

In this approach, the 3D View is the full height of all tracks and scrolls naturally with the HTML container.

```tsx
<div className="grid grid-cols-[298px_1fr] overflow-y-auto">
  {/* HTML controls */}
  <div>
    {tracks.map(track => <ControlWidget key={track.id} />)}
  </div>
  
  {/* Full-height 3D View */}
  <div style={{ height: totalTracksHeight }}>
    <View className="h-full sticky top-0">
      <OrthographicCamera />
      <UnifiedTrackScene />
    </View>
  </div>
</div>
```

### Pros
1. **Native Behavior**
   - Platform-native scroll physics
   - Accessibility features work automatically
   - Familiar user experience
   - Native scrollbar

2. **Perfect Synchronization**
   - HTML and 3D content scroll together
   - No drift or lag between sides
   - Simpler mental model

3. **Simpler Implementation**
   - No custom scroll handling needed
   - Standard event coordinates
   - Easier tooltip/overlay positioning

4. **Better Integration**
   - Works with browser find (Ctrl+F)
   - Respects system scroll preferences
   - Touch/trackpad gestures work naturally

### Cons
1. **Performance Limitations**
   - Large canvas sizes impact performance
   - WebGL has maximum texture size limits
   - May hit browser canvas size limits (~32k pixels)
   - More memory usage

2. **Rendering Challenges**
   - No automatic frustum culling
   - Must manually implement viewport visibility
   - Potential for rendering unnecessary content

3. **Technical Constraints**
   - Mobile devices may struggle with large canvases
   - Some browsers limit canvas dimensions
   - WebGL context loss more likely

## Hybrid Approach: Viewport-Following View

A third option uses IntersectionObserver to move a fixed-size View with the scroll position:

```tsx
function ViewportFollowingView() {
  const viewRef = useRef<HTMLDivElement>();
  const [viewportOffset, setViewportOffset] = useState(0);
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      const scrollTop = window.scrollY;
      setViewportOffset(scrollTop);
    });
    
    observer.observe(viewRef.current);
  }, []);
  
  return (
    <div className="relative" style={{ height: totalHeight }}>
      <div 
        ref={viewRef}
        className="sticky top-0 h-screen"
        style={{ transform: `translateY(${viewportOffset}px)` }}
      >
        <View>
          <OrthographicCamera position={[0, -viewportOffset, 100]} />
          <UnifiedTrackScene />
        </View>
      </div>
    </div>
  );
}
```

### Pros
- Native scroll with performance benefits
- Fixed viewport size
- Natural synchronization

### Cons
- More complex implementation
- Potential jank during rapid scrolling
- Transform calculations needed

## Recommendations

### For Small to Medium Track Counts (< 100 tracks)
**Use Full-Height Native Scrolling**
- Simpler implementation
- Better user experience
- Native accessibility
- Performance is acceptable

### For Large Track Counts (100-1000 tracks)
**Use Hybrid Viewport-Following**
- Balances performance and UX
- Maintains native scroll feel
- Handles large datasets well

### For Extreme Track Counts (1000+ tracks)
**Use Camera-Based Scrolling**
- Only viable option for performance
- Implement virtual scrolling
- Custom scrollbar UI

## Implementation Guidelines

### Full-Height Implementation
```tsx
function UnifiedTrackView() {
  const totalHeight = useMemo(() => {
    return tracks.reduce((height, track) => {
      return height + (expanded[track.id] ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT);
    }, 0);
  }, [tracks, expanded]);
  
  // Use CSS transforms for high-performance scrolling
  return (
    <div 
      className="will-change-transform"
      style={{ height: totalHeight }}
    >
      <View className="h-screen sticky top-0">
        {/* Render only visible portion */}
        <VisibleTracksOnly />
      </View>
    </div>
  );
}
```

### Viewport Culling for Full-Height
```tsx
function useVisibleTracks() {
  const [visibleRange, setVisibleRange] = useState([0, 50]);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      
      const startTrack = Math.floor(scrollTop / TRACK_HEIGHT);
      const endTrack = Math.ceil((scrollTop + viewportHeight) / TRACK_HEIGHT);
      
      setVisibleRange([startTrack, endTrack]);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return visibleRange;
}
```

## Conclusion

The choice depends on your performance requirements and track count:
- **< 100 tracks**: Full-height native scrolling for best UX
- **100-1000 tracks**: Hybrid approach for balance
- **1000+ tracks**: Camera-based with virtual scrolling

Consider implementing a dynamic approach that switches strategies based on track count for optimal performance across all scenarios.