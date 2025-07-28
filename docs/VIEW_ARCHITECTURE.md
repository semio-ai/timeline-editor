# View-Based Architecture for Animation Sheet

## Overview

The migration to Three.js uses drei's View component to enable multiple synchronized 3D contexts within a single Canvas. This approach allows us to maintain the existing grid layout while rendering all 3D content through a unified WebGL context.

## Core Concepts

### Single Canvas, Multiple Views

```tsx
// One canvas to rule them all
<Canvas frameloop="always" className="animation-canvas">
  <View.Port />
</Canvas>

// Multiple tracking divs with Views
<div ref={trackViewRef} className="track-area">
  <View track={trackViewRef}>
    {/* 3D scene content */}
  </View>
</div>
```

### View Component Structure

Each View creates an isolated rendering context with its own:
- Scene
- Camera
- Viewport bounds
- Event handling

## Animation Sheet View Architecture

### Layout Structure

```
AnimationSheet3D
├── Canvas (absolute positioned, pointer-events: none)
│   └── View.Port
├── Grid Container (CSS Grid)
│   ├── Controls Section
│   ├── Ruler View (top)
│   ├── TrackList Container
│   │   └── TrackRow Views (dynamic)
│   ├── Timeline View
│   ├── Minimap View
│   └── Ruler View (bottom)
```

### Implementation Pattern

```tsx
export function AnimationSheet3D() {
  // View refs for each section
  const rulerTopRef = useRef();
  const rulerBottomRef = useRef();
  const timelineRef = useRef();
  const minimapRef = useRef();
  const trackRefs = useRef(new Map());

  return (
    <div className="animation-sheet-container">
      {/* Single Canvas for all 3D rendering */}
      <Canvas
        frameloop="always" // Continuous rendering for smooth animations
        className="absolute inset-0 pointer-events-none"
        gl={{
          antialias: false,
          alpha: true,
          preserveDrawingBuffer: true
        }}
      >
        <View.Port />
      </Canvas>

      {/* Grid layout with tracking divs */}
      <div className="grid grid-cols-[298px_1fr] grid-rows-[32px_1fr_36px_36px_36px]">
        {/* Top Ruler */}
        <div ref={rulerTopRef} className="col-start-2">
          <RulerView3D side="top" trackRef={rulerTopRef} />
        </div>

        {/* Track List */}
        <div className="col-span-2">
          <TrackList3D trackRefs={trackRefs} />
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className="col-start-2">
          <TimelineView3D trackRef={timelineRef} />
        </div>

        {/* Minimap */}
        <div ref={minimapRef} className="col-start-2">
          <MinimapView3D trackRef={minimapRef} />
        </div>

        {/* Bottom Ruler */}
        <div ref={rulerBottomRef} className="col-start-2">
          <RulerView3D side="bottom" trackRef={rulerBottomRef} />
        </div>
      </div>
    </div>
  );
}
```

## View Components

### Base View Pattern

```tsx
interface View3DProps {
  trackRef: RefObject<HTMLDivElement>;
  width?: number;
  height?: number;
}

function BaseView3D({ trackRef, width, height, children }: View3DProps) {
  const viewportTransform = useViewportTransform();

  return (
    <View track={trackRef} className="w-full h-full">
      <OrthographicCamera
        makeDefault
        position={[0, 0, 100]}
        near={0.1}
        far={1000}
        zoom={calculateZoom(width, height)}
      />
      <ambientLight intensity={1} />
      {/* Use transform groups for cleaner architecture */}
      <group name="viewport-root">
        <group
          name="viewport-transform"
          scale={[viewportTransform.scale, 1, 1]}
          position={[viewportTransform.offset, 0, 0]}
        >
          {children}
        </group>
      </group>
    </View>
  );
}
```

### Track Row Views

Track rows require special handling as they're dynamically created:

```tsx
function TrackList3D({ trackRefs }) {
  const tracks = useAnimationStore(state => state.tracks);

  // Manage refs for dynamic tracks
  useEffect(() => {
    tracks.forEach(track => {
      if (!trackRefs.current.has(track.id)) {
        trackRefs.current.set(track.id, createRef());
      }
    });

    // Clean up removed tracks
    Array.from(trackRefs.current.keys()).forEach(id => {
      if (!tracks.find(t => t.id === id)) {
        trackRefs.current.delete(id);
      }
    });
  }, [tracks]);

  return (
    <ScrollArea className="track-list-container">
      {tracks.map((track, index) => {
        const ref = trackRefs.current.get(track.id);
        return (
          <div key={track.id} className="track-row grid grid-cols-[298px_1fr]">
            <ControlWidget trackId={track.id} />
            <div ref={ref} className="track-visualizer">
              <TrackView3D trackRef={ref} trackId={track.id} index={index} />
            </div>
          </div>
        );
      })}
    </ScrollArea>
  );
}
```

### Synchronized Camera System

Views can share camera state for synchronized zoom/pan:

```tsx
// Shared camera state
const useCameraStore = create((set) => ({
  zoom: 1,
  position: [0, 0],
  setZoom: (zoom) => set({ zoom }),
  setPosition: (position) => set({ position })
}));

// In each View
function SynchronizedView({ trackRef, children }) {
  const { zoom, position } = useCameraStore();
  const { camera } = useThree();

  useEffect(() => {
    camera.zoom = zoom;
    camera.position.x = position[0];
    camera.position.y = position[1];
    camera.updateProjectionMatrix();
  }, [zoom, position, camera]);

  return (
    <View track={trackRef}>
      {/* Camera is automatically synchronized */}
      {children}
    </View>
  );
}
```

## Gesture Handling

### Custom Pan/Zoom Controls

Given the specific gesture requirements (horizontal scroll for pan, pinch/mod+scroll for zoom), we have two main approaches. Note that with the transform-based architecture (see [TRANSFORM_ARCHITECTURE.md](./TRANSFORM_ARCHITECTURE.md)), gesture handling becomes simpler as we only need to update viewport transforms rather than individual element positions:

#### Option 1: Custom Controls (Recommended)

Using the provided PanZoomControls as a starting point, create timeline-specific controls:

```tsx
import { PanZoomControls } from './pan-zoom-controls';

function TimelineControls({ enablePan = true, enableZoom = true }) {
  const controlsRef = useRef();

  return (
    <PanZoomControls
      ref={controlsRef}
      enablePan={enablePan}
      enableZoom={enableZoom}
      panSpeed={1.0}
      zoomSpeed={1.0}
      minZoom={0.1}  // 10% of timeline
      maxZoom={10}   // 1000% zoom
      mouseButtons={{
        LEFT: null,      // No click+drag pan
        MIDDLE: null,    // No middle button
        RIGHT: null      // No right button
      }}
    />
  );
}
```

Benefits:
- Full control over gesture behavior
- Consistent with current UX
- Can optimize for timeline-specific needs
- Already handles horizontal-only zoom

#### Option 2: Adapt Existing Gesture Handlers

Integrate the current `useZoomGestures` hook with Three.js camera:

```tsx
function AdaptedGestureView({ trackRef }) {
  const { camera, size } = useThree();
  const viewportRef = useRef();

  // Adapt existing gesture handler
  const onWheel = useCallback(({ shiftKey, delta, event }) => {
    if ((event.ctrlKey || event.metaKey) && delta[1] !== 0) {
      // Zoom via mod+vertical scroll
      const zoomFactor = delta[1] > 0 ? 0.9 : 1.1;

      // Update camera frustum
      const currentWidth = camera.right - camera.left;
      const newWidth = currentWidth * zoomFactor;
      const center = (camera.left + camera.right) / 2;

      camera.left = center - newWidth / 2;
      camera.right = center + newWidth / 2;
      camera.updateProjectionMatrix();
    } else if (delta[0] !== 0) {
      // Pan via horizontal scroll
      const panDelta = delta[0] * 0.1;
      camera.left += panDelta;
      camera.right += panDelta;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useGesture({
    onWheel,
    onPinch: ({ offset: [scale], origin }) => {
      // Handle pinch zoom
      const zoomFactor = 1 / scale;
      // Similar camera update logic
    }
  }, {
    target: viewportRef,
    eventOptions: { passive: false }
  });

  return (
    <div ref={viewportRef}>
      <View track={trackRef}>
        {/* No built-in controls */}
      </View>
    </div>
  );
}
```

### Recommendation

Use **Custom Controls** (Option 1) for better maintainability and performance:

1. The PanZoomControls already implement the desired behavior
2. Better integration with Three.js event system
3. Cleaner separation of concerns
4. Easier to debug and optimize

## Event Handling

### Pointer Events

Views handle their own pointer events, but we need to manage event propagation:

```tsx
function InteractiveView({ trackRef, onInteraction }) {
  const handlePointerDown = useCallback((event) => {
    // View-specific interaction
    event.stopPropagation();
    onInteraction(event);
  }, [onInteraction]);

  return (
    <View track={trackRef}>
      <mesh onPointerDown={handlePointerDown}>
        {/* Interactive content */}
      </mesh>
    </View>
  );
}
```

### Gesture Integration

```tsx
function GestureEnabledView({ trackRef }) {
  const viewBounds = useRef();
  const { gl } = useThree();

  // Measure the tracking div
  const [measureRef, bounds] = useMeasure();

  // Apply gestures to the specific view area
  useGesture({
    onWheel: ({ delta, event }) => {
      // Check if event is within this view
      const rect = viewBounds.current.getBoundingClientRect();
      if (isEventInBounds(event, rect)) {
        // Handle wheel for this view only
      }
    }
  }, {
    target: trackRef,
    eventOptions: { passive: false }
  });

  return (
    <div ref={measureRef} className="w-full h-full">
      <View track={trackRef} ref={viewBounds}>
        {/* View content */}
      </View>
    </div>
  );
}
```

## Performance Optimization

### Continuous Rendering Optimization

With `frameloop="always"`, optimization focuses on reducing work per frame rather than controlling when frames occur. The transform-based architecture enables efficient group-level operations:

```tsx
function OptimizedView({ trackRef, children }) {
  const [isInViewport, setIsInViewport] = useState(true);
  const viewportInfo = useViewportInfo();

  // Use Intersection Observer to cull invisible views
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInViewport(entry.isIntersecting),
      { threshold: 0 }
    );

    if (trackRef.current) {
      observer.observe(trackRef.current);
    }

    return () => observer.disconnect();
  }, [trackRef]);

  return (
    <View track={trackRef}>
      {isInViewport && (
        <VisibilityGroup bounds={viewportInfo.bounds}>
          {children}
        </VisibilityGroup>
      )}
    </View>
  );
}
```

### Level of Detail

Using group-based LOD from the transform architecture:

```tsx
function LODView({ trackRef, children }) {
  const { camera } = useThree();
  const [detailLevel, setDetailLevel] = useState('high');

  useFrame(() => {
    // Adjust detail based on zoom level
    const zoom = camera.zoom;
    if (zoom < 0.5) setDetailLevel('low');
    else if (zoom < 2) setDetailLevel('medium');
    else setDetailLevel('high');
  });

  return (
    <View track={trackRef}>
      <LODTrackContent detailLevel={detailLevel}>
        {children}
      </LODTrackContent>
    </View>
  );
}
```

### View Virtualization

For many tracks, implement virtualization:

```tsx
function VirtualizedTrackList({ trackRefs }) {
  const tracks = useAnimationStore(state => state.tracks);
  const [visibleRange, setVisibleRange] = useState([0, 10]);

  const visibleTracks = tracks.slice(visibleRange[0], visibleRange[1]);

  return (
    <VirtualScroll
      items={tracks}
      onVisibleRangeChange={setVisibleRange}
      itemHeight={36}
    >
      {visibleTracks.map((track, index) => {
        const ref = trackRefs.current.get(track.id);
        return (
          <div key={track.id} ref={ref} className="track-row">
            <TrackView3D trackRef={ref} trackId={track.id} />
          </div>
        );
      })}
    </VirtualScroll>
  );
}
```

## Shared Resources

### Material Pool

```tsx
const materialPool = new Map();

export function getPooledMaterial(type, props) {
  const key = `${type}-${JSON.stringify(props)}`;

  if (!materialPool.has(key)) {
    const material = createMaterial(type, props);
    materialPool.set(key, material);
  }

  return materialPool.get(key);
}
```

### Geometry Instances

```tsx
// Shared geometries across views - now using normalized sizes
const geometryCache = {
  keyframe: new THREE.OctahedronGeometry(1, 0), // Unit size, scaled by transform
  tick: new THREE.PlaneGeometry(1, 1),
  line: new THREE.BufferGeometry()
};

export function useSharedGeometry(type) {
  return geometryCache[type];
}
```

## Integration with Existing Systems

### Animation Store

```tsx
function ViewWithStoreSync({ trackRef, trackId }) {
  const track = useAnimationStore(state => state.tracks[trackId]);
  const frames = useAnimationStore(state => state.frames[trackId]);

  return (
    <View track={trackRef}>
      <TrackScene track={track} frames={frames} />
    </View>
  );
}
```

### Player State

```tsx
function ViewWithPlayback({ trackRef }) {
  const currentTime = usePlayerStore(state => state.currentTime);
  const playbackState = usePlayerStore(state => state.playbackState);

  return (
    <View track={trackRef}>
      <PlayheadIndicator time={currentTime} />
      <PlaybackVisualizer state={playbackState} />
    </View>
  );
}
```

## Best Practices

1. **One Canvas**: Always use a single Canvas with View.Port
2. **Frameloop**: Use `frameloop="always"` for smooth animations
3. **Transform Architecture**: Use group transforms instead of per-element calculations (see [TRANSFORM_ARCHITECTURE.md](./TRANSFORM_ARCHITECTURE.md))
4. **Gesture Controls**: Use custom controls for consistent UX
5. **Ref Management**: Properly manage refs for dynamic views
6. **Event Isolation**: Ensure events are properly scoped to views
7. **Shared State**: Use stores for synchronized state across views
8. **Performance**: Implement group-based LOD and viewport culling
9. **Memory**: Share geometries and materials across views
10. **Screen-Space Elements**: Use ScreenSizer for zoom-invariant UI elements
11. **Responsiveness**: Views automatically handle resize

## Debugging

### View Boundaries

```tsx
function DebugView({ trackRef, children }) {
  return (
    <View track={trackRef}>
      <Box args={[100, 100, 1]} position={[0, 0, -1]}>
        <meshBasicMaterial color="red" wireframe />
      </Box>
      {children}
    </View>
  );
}
```

### Performance Monitor

```tsx
function ViewWithStats({ trackRef, children }) {
  const stats = useRef();

  useFrame(() => {
    stats.current?.update();
  });

  return (
    <View track={trackRef}>
      <Stats ref={stats} showPanel={0} />
      {children}
    </View>
  );
}
```
