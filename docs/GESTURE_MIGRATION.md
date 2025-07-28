# Gesture Migration Guide

## Overview

This guide details the migration of gesture controls from the SVG-based animation system to Three.js/React Three Fiber. The goal is to maintain the exact same user experience:
- **Horizontal scroll** → Pan timeline
- **Pinch or Cmd/Ctrl + Vertical scroll** → Zoom timeline
- **No click+drag panning** (differs from typical 3D controls)

## Current SVG Gesture System

### Existing Implementation

The current system uses `@use-gesture/react` with the `useZoomGestures` hook:

```tsx
// Current gesture handling in use-zoom-gestures.ts
useGesture({
  onPinch: ({ offset: [scale], origin }) => {
    // Updates viewport via scale calculations
    const newPosition = clamp(
      zoomScale.current.invert((origin[0] - bounds.left) / bounds.width),
      0, 1
    );
    updatePlayerViewport(newDomain[0], newDomain[1]);
  },
  onWheel: ({ shiftKey, delta, event }) => {
    // Horizontal scroll for panning
    const deltaMovement = shiftKey ? delta[1] : delta[0];
    const movement = deltaMovement / bounds.width;
    updatePlayerViewport(proposedStart, proposedEnd);
  }
}, {
  target: ref,
  pinch: {
    scaleBounds: { min: 1, max: duration / 500 },
    modifierKey: ["metaKey", "ctrlKey"],
  },
  wheel: {
    axis: shiftKeyPressed ? "y" : "x",
  },
  eventOptions: { passive: false }
});
```

## Three.js Gesture Implementation

### Using Custom PanZoomControls

The provided `PanZoomControls` implementation is ideal for our needs:

```tsx
import { PanZoomControls } from './pan-zoom-controls';

function TimelineView3D({ trackRef, width, height }) {
  const controlsRef = useRef<PanZoomControls>();
  
  // Sync with animation store viewport
  const viewport = usePlayerStore(state => state.player.viewport);
  const duration = useAnimationStore(state => state.animations[animationId].duration);
  
  // Calculate zoom from viewport
  useEffect(() => {
    if (controlsRef.current) {
      const zoomLevel = 1 / (viewport[1] - viewport[0]);
      // PanZoomControls handles this internally, but we may need to sync
    }
  }, [viewport]);
  
  return (
    <View track={trackRef}>
      <OrthographicCamera
        makeDefault
        left={-width / 2}
        right={width / 2}
        top={height / 2}
        bottom={-height / 2}
        near={0.1}
        far={1000}
      />
      <PanZoomControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        panSpeed={1.0}
        zoomSpeed={1.0}
        minZoom={0.1}    // 10% of timeline (zoomed out)
        maxZoom={10}     // 1000% zoom (zoomed in)
        onChange={() => {
          // Sync camera frustum back to store
          const camera = controlsRef.current?.object;
          if (camera) {
            const width = camera.right - camera.left;
            const totalWidth = width * (1 / controlsRef.current.minZoom);
            const left = (camera.left + totalWidth / 2) / totalWidth;
            const right = (camera.right + totalWidth / 2) / totalWidth;
            updatePlayerViewport(left, right);
          }
        }}
      />
      <TimelineScene />
    </View>
  );
}
```

### Extending PanZoomControls for Timeline Needs

If the base controls need timeline-specific behavior:

```tsx
class TimelinePanZoomControls extends PanZoomControls {
  constructor(camera: OrthographicCamera, domElement?: HTMLElement) {
    super(camera, domElement);
    
    // Timeline-specific configuration
    this.mouseButtons = {
      LEFT: null,      // Disable click+drag
      MIDDLE: null,
      RIGHT: null
    };
  }
  
  // Override zoom to maintain aspect ratio if needed
  protected zoomCameraHorizontal(zoomFactor: number, center: Vector2) {
    // Call parent implementation
    super.zoomCameraHorizontal(zoomFactor, center);
    
    // Additional timeline-specific logic
    this.dispatchEvent({ type: 'viewportchange', viewport: this.getViewport() });
  }
  
  // Get normalized viewport for store sync
  getViewport(): [number, number] {
    const camera = this.object;
    const totalWidth = this.initialCameraWidth;
    const left = (camera.left + totalWidth / 2) / totalWidth;
    const right = (camera.right + totalWidth / 2) / totalWidth;
    return [left, right];
  }
}
```

## Integration Strategy

### 1. Viewport Synchronization

Create a hook to sync camera state with the animation store:

```tsx
function useCameraViewportSync(controlsRef: RefObject<PanZoomControls>) {
  const updatePlayerViewport = usePlayerStore(state => state.updatePlayerViewport);
  const viewport = usePlayerStore(state => state.player.viewport);
  const { camera } = useThree();
  
  // Sync store → camera on viewport change
  useEffect(() => {
    if (!camera || !(camera instanceof OrthographicCamera)) return;
    
    const totalWidth = /* calculate based on timeline duration */;
    camera.left = viewport[0] * totalWidth - totalWidth / 2;
    camera.right = viewport[1] * totalWidth - totalWidth / 2;
    camera.updateProjectionMatrix();
  }, [viewport, camera]);
  
  // Sync camera → store on control changes
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    
    const handleChange = () => {
      const viewport = controls.getViewport();
      updatePlayerViewport(viewport[0], viewport[1]);
    };
    
    controls.addEventListener('change', handleChange);
    return () => controls.removeEventListener('change', handleChange);
  }, [controlsRef, updatePlayerViewport]);
}
```

### 2. Shared Control State

For synchronized zoom/pan across multiple views:

```tsx
// Shared camera state for all timeline views
const useCameraStore = create((set) => ({
  frustum: { left: -100, right: 100, top: 50, bottom: -50 },
  setFrustum: (frustum) => set({ frustum }),
}));

// In each view
function SynchronizedTimelineView({ trackRef }) {
  const frustum = useCameraStore(state => state.frustum);
  const setFrustum = useCameraStore(state => state.setFrustum);
  
  return (
    <View track={trackRef}>
      <OrthographicCamera
        makeDefault
        {...frustum}
      />
      <PanZoomControls
        onChange={() => {
          const camera = /* get camera */;
          setFrustum({
            left: camera.left,
            right: camera.right,
            top: camera.top,
            bottom: camera.bottom
          });
        }}
      />
    </View>
  );
}
```

## Migration Steps

### Step 1: Replace SVG Container

```tsx
// Before
<svg ref={svgRef} width={width} height={height}>
  {/* SVG content */}
</svg>

// After
<div ref={trackRef} style={{ width, height }}>
  <View track={trackRef}>
    <OrthographicCamera makeDefault />
    <PanZoomControls />
    {/* 3D content */}
  </View>
</div>
```

### Step 2: Remove use-gesture Bindings

```tsx
// Remove old gesture bindings
- useZoomGestures(svgRef, otherHandlers, config);

// Controls are now handled by PanZoomControls component
```

### Step 3: Update Coordinate Systems

```tsx
// SVG coordinates to Three.js world coordinates
function svgToWorld(svgX: number, svgWidth: number, camera: OrthographicCamera) {
  const normalized = svgX / svgWidth; // 0 to 1
  const worldWidth = camera.right - camera.left;
  return camera.left + normalized * worldWidth;
}

// World coordinates to normalized viewport
function worldToViewport(worldX: number, camera: OrthographicCamera) {
  const totalWidth = /* initial camera width */;
  return (worldX + totalWidth / 2) / totalWidth;
}
```

## Testing & Debugging

### Gesture Testing Checklist

- [ ] Horizontal scroll pans timeline smoothly
- [ ] Cmd/Ctrl + vertical scroll zooms to cursor position
- [ ] Pinch gesture zooms to pinch center
- [ ] Zoom constraints work (min/max zoom)
- [ ] Pan constraints work (can't pan beyond timeline bounds)
- [ ] Multi-view synchronization works
- [ ] Store state updates correctly

### Debug Visualization

```tsx
function GestureDebugOverlay() {
  const { camera } = useThree();
  const [debugInfo, setDebugInfo] = useState({});
  
  useFrame(() => {
    if (camera instanceof OrthographicCamera) {
      setDebugInfo({
        left: camera.left.toFixed(2),
        right: camera.right.toFixed(2),
        zoom: camera.zoom.toFixed(2),
        width: (camera.right - camera.left).toFixed(2)
      });
    }
  });
  
  return (
    <Html position={[0, 0, 0]}>
      <div className="debug-overlay">
        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
      </div>
    </Html>
  );
}
```

### Performance Monitoring

```tsx
function GesturePerformanceMonitor() {
  const gestureCount = useRef(0);
  const lastReset = useRef(Date.now());
  
  // Track gesture frequency
  const handleGesture = useCallback(() => {
    gestureCount.current++;
    
    const now = Date.now();
    if (now - lastReset.current > 1000) {
      console.log(`Gestures per second: ${gestureCount.current}`);
      gestureCount.current = 0;
      lastReset.current = now;
    }
  }, []);
  
  return null;
}
```

## Common Issues & Solutions

### Issue 1: Gesture Conflicts
**Problem**: Multiple views responding to the same gesture
**Solution**: Ensure proper event isolation per view

### Issue 2: Coordinate Mismatch
**Problem**: Zoom/pan calculations incorrect due to coordinate system differences
**Solution**: Always convert between screen, SVG, and world coordinates properly

### Issue 3: Performance During Zoom
**Problem**: Lag during pinch zoom with many elements
**Solution**: Implement LOD based on zoom level, use instancing

### Issue 4: Store Sync Loops
**Problem**: Camera and store updates cause infinite loops
**Solution**: Use proper effect dependencies and update guards

## Summary

The gesture migration maintains the exact UX while leveraging Three.js capabilities:
- Custom PanZoomControls provide the required scroll/pinch behavior
- No click+drag panning matches current behavior
- Viewport synchronization keeps animation state consistent
- Performance optimizations available through Three.js