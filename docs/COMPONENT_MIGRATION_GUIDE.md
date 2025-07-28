# Component Migration Guide: SVG to Three.js

## Table of Contents

1. [TrackVisualizer Migration](#trackvisualizer-migration)
2. [TrackBackground Migration](#trackbackground-migration)
3. [DataDisplay Migration](#datadisplay-migration)
4. [Interactive Components](#interactive-components)
5. [Shared Utilities](#shared-utilities)
6. [State Management](#state-management)

## TrackVisualizer Migration

### Current Implementation (SVG)

```tsx
// Current SVG approach
<svg width={width} height={height}>
  <g transform={`translate(${TIMELINE_PADDING}, 0)`}>
    <TrackBackground />
    <DataDisplay />
  </g>
</svg>
```

### New Implementation (Three.js)

```tsx
// New Three.js approach
<View ref={viewRef} className="track-visualizer">
  <Scene>
    <OrthographicCamera 
      makeDefault
      position={[0, 0, 10]}
      zoom={calculateZoom(width, height)}
    />
    <PanZoomControls 
      enablePan={true}
      enableZoom={true}
      minZoom={0.1}
      maxZoom={10}
    />
    <TrackBackground3D />
    <DataDisplay3D />
  </Scene>
</View>
```

### Key Changes

1. **Coordinate System**: SVG uses top-left origin, Three.js uses center origin
2. **Transformations**: Replace SVG transforms with Three.js object positioning
3. **Viewport**: Use camera zoom/position instead of viewBox

## TrackBackground Migration

### Grid and Ticks

#### SVG Implementation
```tsx
// Current tick rendering
<motion.line
  x1={x}
  x2={x}
  y1={0}
  y2={tickHeight}
  strokeWidth={isMajor ? majorTickSpring : minorTickSpring}
/>
```

#### Three.js Implementation
```tsx
// New tick rendering with shader (see RENDERING_OPTIMIZATION.md)
// Uses a single plane with custom shader for optimal performance
function TickSystem({ width, height }) {
  return (
    <mesh position={[0, 0, -1]}>
      <planeGeometry args={[width, height]} />
      <tickGridMaterial
        uFramerate={framerate}
        uDuration={duration}
        transparent
      />
    </mesh>
  );
}

// Shader provides:
// - LOD based on zoom level
// - Smooth opacity transitions
// - Single draw call for all ticks
// See RENDERING_OPTIMIZATION.md for full shader implementation
```

### Patterns and Masks

#### SVG Pattern
```xml
<pattern id="diagonalStripePattern" patternUnits="userSpaceOnUse">
  <rect fill="gray" />
  <line stroke="white" />
</pattern>
```

#### Three.js Shader Pattern
```glsl
// Vertex shader
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment shader
varying vec2 vUv;
uniform float stripeWidth;
uniform vec3 color1;
uniform vec3 color2;

void main() {
  float stripe = mod(vUv.x + vUv.y, stripeWidth * 2.0) / stripeWidth;
  vec3 color = mix(color1, color2, step(1.0, stripe));
  gl_FragColor = vec4(color, 1.0);
}
```

## DataDisplay Migration

### Keyframe Rendering

#### Current SVG Approach
```tsx
<FrameMarker
  key={frameInstance.id}
  data={frameInstance}
  onDragStart={() => setDraggingFrames(ids)}
/>
```

#### Three.js Implementation
```tsx
function KeyframeSystem({ frames }) {
  const { scene, camera, gl } = useThree();
  const meshRef = useRef();
  
  // Raycasting for interaction
  const handlePointerDown = useCallback((event) => {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    
    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      // Handle frame selection/dragging
    }
  }, [camera]);

  // Using the instanced pattern from RENDERING_OPTIMIZATION.md
    return (
      <Instances limit={10000} range={frames.length}>
        {/* Shared geometry - diamond shape for keyframes */}
        <octahedronGeometry args={[8, 0]} />
        <meshBasicMaterial toneMapped={false} />
      
        {/* Individual keyframe instances with screen-space scaling */}
        {frames.map((frame) => (
          <Keyframe
            key={frame.id}
            id={frame.id}
            stamp={frame.stamp}
            value={frame.value}
            color={frame.color}
          />
        ))}
      </Instances>
    );

  // Each Keyframe component handles:
  // - Screen-space scaling for consistent visual size
  // - LOD adjustments based on zoom
  // - Interaction through userData
  // See RENDERING_OPTIMIZATION.md for complete implementation
}
```

### Interpolation Curves

#### SVG Path
```tsx
<path d={`M ${start.x} ${start.y} C ${cp1} ${cp2} ${end.x} ${end.y}`} />
```

#### Three.js Curve
```tsx
function InterpolationCurve({ start, end, control1, control2 }) {
  const curve = useMemo(() => {
    return new THREE.CubicBezierCurve3(
      new THREE.Vector3(start.x, start.y, 0),
      new THREE.Vector3(control1.x, control1.y, 0),
      new THREE.Vector3(control2.x, control2.y, 0),
      new THREE.Vector3(end.x, end.y, 0)
    );
  }, [start, end, control1, control2]);

  // Adaptive LOD based on curve length
  const length = curve.getLength();
  const points = Math.max(10, Math.min(50, Math.floor(length / 5)));

  return (
    <Line
      points={curve.getPoints(points)}
      color="#0066cc"
      lineWidth={2}
      dashed={false}
    />
  );
}

// For multiple curves, use InterpolationCurveRenderer pattern
// from RENDERING_OPTIMIZATION.md for better performance
```

## Interactive Components

### Gesture Handling Migration

#### Current SVG Gestures
```tsx
// Using @use-gesture/react directly on SVG
useGesture({
  onPinch: ({ offset: [scale], origin }) => {
    // Transform SVG viewBox
  },
  onWheel: ({ delta }) => {
    // Pan SVG content
  }
}, { target: svgRef });
```

#### Three.js Gesture Options

**Option 1: Custom PanZoomControls (Recommended)**
```tsx
import { PanZoomControls } from './pan-zoom-controls';

function TimelineControls() {
  const controlsRef = useRef();
  
  return (
    <PanZoomControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      panSpeed={1.0}
      zoomSpeed={1.0}
      minZoom={0.1}   // 10% of timeline width
      maxZoom={10}    // 1000% zoom
      // No mouse button actions - scroll/pinch only
      mouseButtons={{
        LEFT: null,
        MIDDLE: null,
        RIGHT: null
      }}
    />
  );
}
```

**Option 2: Adapt Existing Gestures**
```tsx
function AdaptedGestureControls() {
  const { camera } = useThree();
  const domRef = useRef();
  
  useGesture({
    onPinch: ({ offset: [scale], origin }) => {
      const zoomFactor = 1 / scale;
      const currentWidth = camera.right - camera.left;
      const newWidth = currentWidth * zoomFactor;
      
      // Zoom to pinch center
      const relativeX = origin[0] / domRef.current.clientWidth;
      const worldX = camera.left + currentWidth * relativeX;
      
      camera.left = worldX - newWidth * relativeX;
      camera.right = worldX + newWidth * (1 - relativeX);
      camera.updateProjectionMatrix();
    },
    onWheel: ({ delta, event }) => {
      if ((event.ctrlKey || event.metaKey) && delta[1] !== 0) {
        // Zoom with mod+vertical scroll
        const zoomFactor = delta[1] > 0 ? 0.9 : 1.1;
        // Apply zoom logic similar to pinch
      } else if (delta[0] !== 0) {
        // Pan with horizontal scroll
        const panDelta = delta[0] * 0.1;
        camera.left += panDelta;
        camera.right += panDelta;
        camera.updateProjectionMatrix();
      }
    }
  }, { 
    target: domRef,
    eventOptions: { passive: false }
  });

  return <div ref={domRef} className="absolute inset-0" />;
}
```

**Recommendation**: Use Custom PanZoomControls for:
- Better Three.js integration
- Consistent behavior across views
- Optimized performance
- Easier maintenance

### Frame Dragging

```tsx
function DraggableKeyframe({ position, onDrag }) {
  const meshRef = useRef();
  const { camera, gl } = useThree();
  
  const bind = useDrag(({ xy, down }) => {
    const worldPos = screenToWorld(xy, camera);
    if (down) {
      meshRef.current.position.x = worldPos.x;
      onDrag(worldPos);
    }
  });

  return (
    <mesh ref={meshRef} position={position} {...bind()}>
      <sphereGeometry args={[5, 16, 16]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
}
```

## Shared Utilities

### Coordinate Conversion

```tsx
// SVG to Three.js coordinate mapping
export function svgToThreeCoords(svgX, svgY, width, height) {
  // SVG: origin top-left, y-down
  // Three: origin center, y-up
  return {
    x: svgX - width / 2,
    y: height / 2 - svgY,
    z: 0
  };
}

// Screen to world coordinates
export function screenToWorld(screenPos, camera) {
  const vector = new THREE.Vector3();
  vector.set(
    (screenPos[0] / window.innerWidth) * 2 - 1,
    -(screenPos[1] / window.innerHeight) * 2 + 1,
    0.5
  );
  vector.unproject(camera);
  return vector;
}
```

### Scale Management

```tsx
// Maintain pixel-perfect rendering
export function calculateOrthographicZoom(containerWidth, containerHeight, worldWidth, worldHeight) {
  const scaleX = containerWidth / worldWidth;
  const scaleY = containerHeight / worldHeight;
  return Math.min(scaleX, scaleY);
}

// Dynamic LOD based on zoom
export function useLevelOfDetail(camera) {
  const [lod, setLod] = useState('high');
  
  useFrame(() => {
    const zoom = camera.zoom;
    if (zoom < 0.5) setLod('low');
    else if (zoom < 2) setLod('medium');
    else setLod('high');
  });
  
  return lod;
}
```

## State Management

### Animation Store Integration

```tsx
// Sync Three.js scene with animation store
function useAnimationSync() {
  const tracks = useAnimationStore(state => state.tracks);
  const [sceneObjects, setSceneObjects] = useState(new Map());
  
  useEffect(() => {
    // Update scene when tracks change
    tracks.forEach(track => {
      if (!sceneObjects.has(track.id)) {
        // Create new Three.js objects
        const trackObject = createTrackObject(track);
        setSceneObjects(prev => new Map(prev).set(track.id, trackObject));
      } else {
        // Update existing objects
        updateTrackObject(sceneObjects.get(track.id), track);
      }
    });
  }, [tracks]);
  
  return sceneObjects;
}
```

### Performance Monitoring

```tsx
// Track rendering performance with continuous rendering
function usePerformanceMonitor() {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const lastReport = useRef(0);
  
  useFrame((state, delta) => {
    frameCount.current++;
    
    // Report every second
    if (state.clock.elapsedTime - lastReport.current > 1) {
      const info = gl.info;
      console.log(`FPS: ${frameCount.current}, Draw calls: ${info.render.calls}`);
      frameCount.current = 0;
      lastReport.current = state.clock.elapsedTime;
    }
    
    // Warn on high draw calls
    if (info.render.calls > 100) {
      console.warn('High draw call count:', info.render.calls);
    }
  });
}
```

## Migration Checklist

### Per Component
- [ ] Create Three.js geometry equivalents
- [ ] Port interaction handlers
- [ ] Implement coordinate transformations
- [ ] Add performance optimizations
- [ ] Maintain visual parity
- [ ] Update tests

### System-Wide
- [ ] Set up Canvas and View infrastructure
- [ ] Implement shared camera system
- [ ] Create material/shader library
- [ ] Port gesture handling
- [ ] Optimize render loop
- [ ] Add debugging tools

## Common Pitfalls

1. **Coordinate System Mismatch**: Always transform between SVG and Three.js coordinates
2. **Performance**: Use instancing for repeated elements
3. **Interaction**: Raycasting can be expensive - optimize with layers
4. **Memory**: Dispose of geometries and materials properly
5. **Visual Fidelity**: Match SVG rendering precisely with proper camera setup

## Testing Strategy

1. **Visual Regression**: Screenshot comparison between SVG and Three.js
2. **Performance**: Benchmark frame rates with various track counts
3. **Interaction**: Test all gesture types and edge cases
4. **Memory**: Monitor for leaks during component lifecycle
5. **Cross-platform**: Verify WebGL compatibility