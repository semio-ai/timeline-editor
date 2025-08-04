# HUD Gesture Migration Guide

## Overview

This guide outlines the migration of the animation timeline's gesture system from SVG-based rendering to a Three.js-based implementation using HUD layers. The migration addresses z-indexing issues while maintaining existing gesture behaviors and player store patterns.

## Architecture Summary

The new architecture uses multiple HUD layers to achieve proper visual layering:
- **HUD Layer 1**: Top Ruler (highest priority)
- **HUD Layer 2**: Timeline 
- **HUD Layer 3**: Minimap + Bottom Ruler
- **Main Scene**: Track List (behind all HUD elements, scrollable)

Each layer has specialized cameras and gesture handling based on their requirements.

## Revised Phase Approach

The original approach had dependency issues where testing was impossible until the final phase. This revised approach interleaves content creation with implementation to enable incremental validation and early risk identification.

### Key Changes from Original Plan
- **Early Content**: Visual feedback available from Phase 1
- **Risk-First Testing**: Vertical scroll validation in Phase 0
- **Gesture Splitting**: Horizontal gestures separate from vertical
- **Incremental Validation**: Each phase produces testable results

## Phase 0: Vertical Scroll Proof of Concept

**Objective**: Validate that scroll synchronization between DOM (track-list-3d) and 3D canvas works reliably.

**Risk Assessment**: This is the highest-risk integration point. Issues here could force architectural changes.

### 0.1 Modify Track List Region for Scroll Testing

Update `TrackListRegion` to respond to `scrollY` MotionValue:

```tsx
// track-list-region.tsx
export interface TrackListRegionProps {
  visible?: boolean;
  animationId?: string;
  namespaceId?: string;
  instanceSettings?: AnimationInstanceSettings;
  scrollY: MotionValue<number>;
}

export function TrackListRegion({ 
  visible = true, 
  animationId, 
  scrollY 
}: TrackListRegionProps): ReactNode {
  const tracks = useAnimationStore(
    useShallow((state) => Array.from(state.animations[animationId || ""]?.tracks || [])),
  );

  if (!visible) {
    return null;
  }

  return (
    <>
      {animationId &&
        tracks.map((trackId, index) => (
          <TrackBackground 
            key={trackId} 
            trackId={trackId} 
            index={index} 
            scrollY={scrollY}
          />
        ))}
    </>
  );
}

function TrackBackground({ 
  trackId, 
  index, 
  scrollY 
}: { 
  trackId: string; 
  index: number;
  scrollY: MotionValue<number>;
}): ReactNode {
  const color = useColors(trackId);
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.TRACK_LIST);
  const meshRef = useRef<THREE.Mesh>(null);

  if (!bounds) {
    return null;
  }

  const trackHeight = 36;
  const regionHeight = bounds.dimensions.height;
  const regionWidth = bounds.dimensions.width;

  // Base position calculation
  const baseYPosition = regionHeight / 2 - (index + 0.5) * trackHeight;

  // Apply scroll offset
  useEffect(() => {
    const unsubscribe = scrollY.on('change', (scrollValue) => {
      if (meshRef.current) {
        // Convert DOM scroll to 3D world units
        // Positive scroll moves tracks up (negative Y)
        meshRef.current.position.y = baseYPosition + scrollValue;
      }
    });
    return unsubscribe;
  }, [baseYPosition, scrollY]);

  return (
    <Region regionId={DATA_VISUALIZATION_REGIONS.TRACK_LIST}>
      <mesh ref={meshRef} position={[0, baseYPosition, -0.1]}>
        <planeGeometry args={[regionWidth, trackHeight]} />
        <meshBasicMaterial color={color} transparent opacity={1} />
      </mesh>
    </Region>
  );
}
```

### 0.2 Add Temporary Scroll Test Handler

Add to `AnimationSheet3D` for immediate testing:

```tsx
// In InnerSheet3D function
useEffect(() => {
  const handleWheel = (e: WheelEvent) => {
    // Simple test: mouse wheel over canvas updates scrollY
    const currentScroll = scrollY.get();
    scrollY.set(currentScroll + e.deltaY * 0.5);
  };

  const canvas = document.querySelector('canvas');
  canvas?.addEventListener('wheel', handleWheel);
  return () => canvas?.removeEventListener('wheel', handleWheel);
}, [scrollY]);
```

### 0.3 Success Criteria

✅ **Smooth Synchronization**: Mouse wheel immediately moves track backgrounds  
✅ **Correct Direction**: Wheel down moves tracks up, wheel up moves tracks down  
✅ **Performance**: No frame drops during rapid scrolling  
✅ **Visual Alignment**: Track colors remain consistent with expected positioning  

### 0.4 Potential Issues & Solutions

**Performance Problems**
```tsx
// If direct position updates are too expensive
useFrame(() => {
  if (meshRef.current) {
    meshRef.current.position.y = baseYPosition + scrollY.get();
  }
});
```

**Coordinate System Mismatch**
```tsx
// May need different scaling or direction
meshRef.current.position.y = baseYPosition - scrollValue * scaleFactor;
```

**Go/No-Go Decision**: If Phase 0 reveals fundamental issues, consider alternative approaches before proceeding.

## Phase 1: Foundation + Basic Content

**Objective**: Establish layout system with immediate visual feedback for testing.

### 1.1 Update Layout System for HUD Elements

Modify the layout to support HUD layers while maintaining existing grid structure:

```tsx
// animation-sheet-3d.tsx - Updated Canvas structure
<Canvas
  className="w-full h-full"
  orthographic
  camera={{
    position: [0, 0, 100],
    up: [0, 1, 0],
    zoom: 1,
  }}
>
  <LayoutProvider config={DEFAULT_DATA_VISUALIZATION_LAYOUT}>
    {/* Main Scene - Track List (behind everything) */}
    <TrackListRegion
      animationId={currentAnimation}
      namespaceId={namespaceId}
      instanceSettings={instanceSettings}
      scrollY={scrollY}
    />
    
    {/* HUD Layer 1 - Top Ruler */}
    <Hud renderPriority={1}>
      <TopRulerRegion />
    </Hud>
    
    {/* HUD Layer 2 - Timeline */}
    <Hud renderPriority={2}>
      <TimelineRegion />
    </Hud>
    
    {/* HUD Layer 3 - Minimap & Bottom Ruler */}
    <Hud renderPriority={3}>
      <MinimapRegion />
      <BottomRulerRegion />
    </Hud>

    <ambientLight intensity={1} />
  </LayoutProvider>
</Canvas>
```

### 1.2 Add Basic Visual Content

Update region components to include simple content for immediate feedback:

```tsx
// Basic content for each region during development
function TopRulerRegion({
  backgroundColor = "cyan",
  opacity = 1,
  visible = true,
}: TopRulerRegionProps): ReactNode {
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.TOP_RULER);
  
  if (!visible || !bounds) {
    return null;
  }

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
      <meshBasicMaterial color={backgroundColor} transparent opacity={opacity} />
      
      {/* Simple ruler marks for testing */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[i * 50 - 200, 0, 0.1]}>
          <boxGeometry args={[1, 20, 0.1]} />
          <meshBasicMaterial color="black" />
        </mesh>
      ))}
    </mesh>
  );
}
```

### 1.3 Validation Points

- All regions visible in correct positions
- HUD layering working (rulers appear over tracks)
- Layout system properly calculating bounds
- Basic content rendering without errors

## Phase 2: Camera System + Visual Validation

**Objective**: Implement specialized cameras for each region with immediate visual feedback.

### 2.1 Base Camera Synchronization Hook

```tsx
function useCameraSync() {
  const { zoom, pan } = usePlayerStore((state) => ({
    zoom: state.zoom,
    pan: state.pan,
  }));
  
  return { zoom, pan };
}
```

### 2.2 Track Camera (Main Scene)

Handles full zoom/pan for the main track area:

```tsx
interface TrackCameraProps {
  bounds: RegionBounds;
}

function TrackCamera({ bounds }: TrackCameraProps): ReactNode {
  const { zoom, pan } = useCameraSync();
  
  useFrame(({ camera }) => {
    if (camera.type === 'OrthographicCamera') {
      const orthoCamera = camera as THREE.OrthographicCamera;
      
      // Apply zoom
      orthoCamera.zoom = zoom;
      
      // Apply pan within bounds
      orthoCamera.position.x = -pan.x;
      orthoCamera.position.y = pan.y;
      
      // Set camera bounds to region
      const halfWidth = bounds.dimensions.width / 2;
      const halfHeight = bounds.dimensions.height / 2;
      
      orthoCamera.left = -halfWidth;
      orthoCamera.right = halfWidth;
      orthoCamera.top = halfHeight;
      orthoCamera.bottom = -halfHeight;
      
      orthoCamera.updateProjectionMatrix();
    }
  });
  
  return null;
}
```

### 2.3 HUD Zooming Camera (Top Ruler & Timeline)

Synchronized horizontal movement with zoom, but fixed vertical position:

```tsx
interface HUDZoomingCameraProps {
  bounds: RegionBounds;
  layer: number;
}

function HUDZoomingCamera({ bounds, layer }: HUDZoomingCameraProps): ReactNode {
  // This would be implemented within each HUD
  const { zoom, pan } = useCameraSync();
  
  useFrame(({ camera }) => {
    // Apply horizontal pan/zoom, lock vertical
    // Implementation details for HUD camera control
  });
  
  return null;
}
```

### 2.4 Testing with Visual Content

With cameras implemented, test immediately:
- Pan gesture moves ruler marks and track content together
- Zoom affects all synchronized regions appropriately  
- HUD elements stay in correct positions relative to viewport
- No jittering or performance issues

## Phase 3A: Horizontal Gestures First

**Objective**: Implement horizontal pan/zoom gestures for all regions, test thoroughly before adding vertical complexity.

### 3.1 Adapted Canvas Zoom Gestures Hook

```tsx
const useCanvasZoomGestures = (canvasRef: RefObject<HTMLCanvasElement>) => {
  const { zoom, pan, setZoom, setPan } = usePlayerStore();
  
  const gestureHandlers = useGesture({
    onDrag: ({ delta: [dx, dy], pinching }) => {
      if (!pinching) {
        // Horizontal pan only for now
        setPan({
          x: pan.x - dx / zoom,
          y: pan.y, // Keep Y unchanged
        });
      }
    },
    
    onWheel: ({ delta: [, dy], ctrlKey }) => {
      if (ctrlKey) {
        // Zoom
        const zoomFactor = 1 - dy * 0.01;
        setZoom(Math.max(0.1, Math.min(5, zoom * zoomFactor)));
      } else {
        // Horizontal scroll for now
        setPan({
          x: pan.x + dy * 0.5 / zoom,
          y: pan.y,
        });
      }
    },
    
    onPinch: ({ offset: [scale] }) => {
      setZoom(Math.max(0.1, Math.min(5, scale)));
    },
  });
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const cleanup = gestureHandlers(canvas);
    return cleanup;
  }, [gestureHandlers]);
};
```

### 3.2 Testing Horizontal Gestures

- Mouse drag pans content horizontally
- Ctrl+wheel zooms in/out
- Shift+wheel scrolls horizontally  
- Pinch gestures work on touch devices
- All regions stay synchronized

## Phase 3B: Vertical Scroll (Tracks Only) 

**Objective**: Add vertical scrolling for tracks region and synchronize with DOM track list.

### 3.1 Track-Specific Vertical Scroll Handler

```tsx
const useTrackVerticalScroll = (scrollY: MotionValue<number>) => {
  return useGesture({
    onWheel: ({ delta: [, dy], ctrlKey, shiftKey }) => {
      if (!ctrlKey && !shiftKey) {
        // Vertical scroll for tracks
        const currentScroll = scrollY.get();
        scrollY.set(currentScroll + dy * 0.5);
      }
    },
  });
};
```

### 3.2 Integrate with DOM Track List

Ensure `TrackList3D` component synchronizes its scroll position with the `scrollY` MotionValue:

```tsx
function TrackList3D({ scrollY, ...otherProps }: TrackList3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Sync MotionValue changes to DOM scroll
  useEffect(() => {
    const unsubscribe = scrollY.on('change', (value) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = value;
      }
    });
    return unsubscribe;
  }, [scrollY]);
  
  // Sync DOM scroll to MotionValue
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    scrollY.set(e.currentTarget.scrollTop);
  };
  
  return (
    <div ref={containerRef} onScroll={handleScroll}>
      {/* Track list content */}
    </div>
  );
}
```

### 3.3 Testing Vertical Synchronization

- Mouse wheel over canvas scrolls tracks vertically
- DOM track list and 3D tracks stay in sync
- Horizontal gestures still work correctly
- No conflicts between gesture types

## Phase 4: Enhanced Content + Full Gesture Integration

**Objective**: Add realistic timeline content and polish gesture behaviors.

### 4.1 Enhanced Region Content

Replace basic colored rectangles with realistic timeline content:

```tsx
function TopRulerRegion(): ReactNode {
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.TOP_RULER);
  const { zoom, pan } = useCameraSync();
  
  if (!bounds) return null;
  
  // Generate time markers based on zoom level
  const timeScale = zoom * 10; // Adjust based on time units
  const startTime = Math.floor(pan.x / timeScale) * timeScale;
  const endTime = startTime + bounds.dimensions.width;
  
  const markers = [];
  for (let time = startTime; time <= endTime; time += timeScale) {
    const x = time - pan.x;
    markers.push(
      <group key={time} position={[x, 0, 0]}>
        <mesh position={[0, -bounds.dimensions.height / 4, 0.1]}>
          <boxGeometry args={[1, bounds.dimensions.height / 2, 0.1]} />
          <meshBasicMaterial color="black" />
        </mesh>
        {/* Time label would go here */}
      </group>
    );
  }
  
  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
      <meshBasicMaterial color="cyan" transparent opacity={0.8} />
      {markers}
    </mesh>
  );
}
```

### 4.2 Timeline Content

```tsx
function TimelineRegion(): ReactNode {
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.TIMELINE);
  const { zoom, pan } = useCameraSync();
  
  if (!bounds) return null;
  
  // Render keyframes, transitions, and timeline elements
  // Based on current animation data and view parameters
  
  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
      <meshBasicMaterial color="orange" transparent opacity={0.8} />
      {/* Timeline content based on animation data */}
    </mesh>
  );
}
```

### 4.3 Minimap Implementation

```tsx
function MinimapRegion(): ReactNode {
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.MINIMAP);
  const { zoom, pan, duration } = usePlayerStore();
  
  if (!bounds) return null;
  
  // Show overview of entire timeline
  const minimapScale = bounds.dimensions.width / duration;
  const viewportIndicator = {
    x: pan.x * minimapScale,
    width: bounds.dimensions.width / zoom,
  };
  
  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
      <meshBasicMaterial color="red" transparent opacity={0.8} />
      
      {/* Viewport indicator */}
      <mesh position={[viewportIndicator.x, 0, 0.1]}>
        <boxGeometry args={[viewportIndicator.width, bounds.dimensions.height, 0.1]} />
        <meshBasicMaterial color="white" transparent opacity={0.3} />
      </mesh>
    </mesh>
  );
}
```

### 4.4 Fine-tune Gesture Behaviors

```tsx
// Final gesture implementation with all regions working
const useCanvasGestures = (canvasRef: RefObject<HTMLCanvasElement>, scrollY: MotionValue<number>) => {
  const { zoom, pan, setZoom, setPan } = usePlayerStore();
  
  const gestureHandlers = useGesture({
    onDrag: ({ delta: [dx, dy], pinching, event }) => {
      if (!pinching) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const regionId = determineRegionFromMousePosition(event, rect);
        
        if (regionId === DATA_VISUALIZATION_REGIONS.TRACK_LIST) {
          // Handle both horizontal and vertical drag for tracks
          setPan({
            x: pan.x - dx / zoom,
            y: pan.y,
          });
          
          const currentScroll = scrollY.get();
          scrollY.set(currentScroll - dy);
        } else {
          // Other regions: horizontal only
          setPan({
            x: pan.x - dx / zoom,
            y: pan.y,
          });
        }
      }
    },
    
    onWheel: ({ delta: [, dy], ctrlKey, shiftKey, event }) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const regionId = determineRegionFromMousePosition(event, rect);
      
      if (ctrlKey) {
        // Zoom (all regions except minimap)
        if (regionId !== DATA_VISUALIZATION_REGIONS.MINIMAP) {
          const zoomFactor = 1 - dy * 0.01;
          setZoom(Math.max(0.1, Math.min(5, zoom * zoomFactor)));
        }
      } else if (shiftKey) {
        // Horizontal scroll (all regions)
        setPan({
          x: pan.x + dy * 0.5 / zoom,
          y: pan.y,
        });
      } else {
        // Default scroll behavior
        if (regionId === DATA_VISUALIZATION_REGIONS.TRACK_LIST) {
          // Vertical scroll for tracks
          const currentScroll = scrollY.get();
          scrollY.set(currentScroll + dy * 0.5);
        } else {
          // Horizontal scroll for other regions
          setPan({
            x: pan.x + dy * 0.5 / zoom,
            y: pan.y,
          });
        }
      }
    },
  });
  
  return gestureHandlers;
};

function determineRegionFromMousePosition(event: MouseEvent, canvasRect: DOMRect): string {
  // Convert mouse coordinates to region ID
  // Implementation depends on layout bounds
  const relativeY = (event.clientY - canvasRect.top) / canvasRect.height;
  
  // Based on layout configuration
  if (relativeY < 0.2) return DATA_VISUALIZATION_REGIONS.TOP_RULER;
  if (relativeY < 0.6) return DATA_VISUALIZATION_REGIONS.TRACK_LIST;
  if (relativeY < 0.75) return DATA_VISUALIZATION_REGIONS.TIMELINE;
  if (relativeY < 0.9) return DATA_VISUALIZATION_REGIONS.MINIMAP;
  return DATA_VISUALIZATION_REGIONS.BOTTOM_RULER;
}
```

## Testing Strategy

### Phase 0 Testing
- **Scroll Sync**: Verify DOM and 3D track positions stay synchronized
- **Performance**: Measure frame rates during rapid scrolling
- **Edge Cases**: Test scroll boundaries and extreme values

### Phase 1 Testing  
- **Layout**: All regions appear in correct positions
- **HUD Layers**: Proper z-ordering with rulers over tracks
- **Responsive**: Layout adapts to container size changes

### Phase 2 Testing
- **Camera Sync**: All regions respond to pan/zoom consistently
- **Bounds**: Cameras respect region boundaries
- **Performance**: Smooth camera updates without jitter

### Phase 3A Testing
- **Horizontal Pan**: Drag gestures move content horizontally
- **Zoom**: Ctrl+wheel and pinch gestures zoom appropriately
- **Scroll**: Shift+wheel scrolls horizontally

### Phase 3B Testing
- **Vertical Scroll**: Wheel over tracks scrolls vertically
- **DOM Sync**: Track list DOM and 3D content stay aligned
- **Gesture Isolation**: Vertical scroll doesn't affect other regions

### Phase 4 Testing
- **Content Rendering**: Realistic timeline content displays correctly
- **Gesture Polish**: All gesture combinations work as expected
- **Region Behaviors**: Each region responds appropriately to gestures
- **Performance**: Complex content maintains smooth interactions

## Migration Notes

### Dependencies
- `@react-three/fiber` - Core Three.js integration
- `@react-three/drei` - HUD component and utilities  
- `@use-gesture/react` - Gesture handling
- `motion` - Animation values for scroll synchronization
- `zustand` - Player store integration

### Player Store Integration
The implementation maintains existing patterns:
- Pan/zoom state stored in player store
- Gesture handlers update store values
- Components subscribe to store changes
- MotionValues used for smooth DOM-3D synchronization

### Performance Considerations
- Use `useFrame` for expensive updates
- Throttle gesture handlers if needed
- Consider object pooling for large numbers of timeline elements
- Profile scroll synchronization performance

### Future Enhancements
- Migrate from normalized (0-1) time units to real time values
- Add gesture momentum and spring animations
- Implement selection and multi-touch gestures
- Add accessibility features for gesture alternatives