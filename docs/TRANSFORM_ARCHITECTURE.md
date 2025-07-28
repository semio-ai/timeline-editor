# Transform-Based Architecture for Animation System

## Overview

This guide outlines a higher-level architectural approach for the Three.js migration that leverages scene graph transformations, camera viewport calculations, and group-based scaling instead of pixel-level manipulations. This approach results in cleaner, more maintainable code that better utilizes GPU transformations.

## Core Principles

### 1. Scene Graph Hierarchy
Instead of calculating pixel positions for each element, use Three.js's scene graph to handle transformations hierarchically:

```tsx
<group name="timeline" position={[0, 0, 0]}>
  <group name="viewport-transform" scale={[viewportScale, 1, 1]} position={[viewportOffset, 0, 0]}>
    <group name="track" position={[0, trackY, 0]}>
      <InstancedKeyframes />
      <InterpolationCurves />
    </group>
  </group>
</group>
```

### 2. Viewport-Based Calculations
Use the camera's viewport for consistent coordinate systems:

```tsx
function useViewportTransform() {
  const { viewport, camera } = useThree();
  const playerViewport = usePlayerStore(state => state.player.viewport);
  
  return useMemo(() => {
    // Timeline spans from -viewport.width/2 to viewport.width/2
    const timelineWidth = viewport.width;
    const visibleWidth = timelineWidth * (playerViewport[1] - playerViewport[0]);
    const scale = timelineWidth / visibleWidth;
    const offset = -timelineWidth * playerViewport[0] * scale;
    
    return { scale, offset };
  }, [viewport.width, playerViewport]);
}
```

### 3. Screen-Space Invariant Elements
For elements that should maintain constant screen size regardless of zoom:

```tsx
import { ScreenSizer } from '@react-three/drei';

function ZoomInvariantKeyframe({ position }) {
  return (
    <group position={position}>
      <ScreenSizer>
        <mesh>
          <octahedronGeometry args={[8, 0]} />
          <meshBasicMaterial />
        </mesh>
      </ScreenSizer>
    </group>
  );
}
```

## Architecture Patterns

### Timeline Container Architecture

```tsx
function Timeline3D() {
  const { viewport } = useThree();
  const viewportTransform = useViewportTransform();
  
  return (
    <group name="timeline-container">
      {/* Fixed elements (rulers, labels) */}
      <group name="fixed-ui" position={[0, 0, 1]}>
        <TimeRuler />
        <PlayheadIndicator />
      </group>
      
      {/* Scrollable/zoomable content */}
      <group 
        name="viewport-content"
        scale={[viewportTransform.scale, 1, 1]}
        position={[viewportTransform.offset, 0, 0]}
      >
        <TrackList />
      </group>
    </group>
  );
}
```

### Track Group Architecture

```tsx
function Track3D({ trackId, index }) {
  const trackHeight = 50; // World units
  const trackY = -index * trackHeight;
  
  return (
    <group name={`track-${trackId}`} position={[0, trackY, 0]}>
      {/* Background spans full width */}
      <TrackBackground height={trackHeight} />
      
      {/* Data elements positioned in timeline space */}
      <group name="track-data">
        <KeyframeInstances trackId={trackId} />
        <InterpolationSegments trackId={trackId} />
      </group>
      
      {/* Screen-space elements */}
      <group name="track-overlays">
        <ViolationOverlays trackId={trackId} />
      </group>
    </group>
  );
}
```

## Coordinate System Design

### World Space (Timeline Coordinates)
- X: Time in milliseconds (0 to duration)
- Y: Track value (-1 to 1 normalized, or actual value range)
- Z: Layering (background: -1, data: 0, overlays: 1)

### Screen Space (UI Elements)
- Use ScreenSizer for consistent sizing
- Position in world space, scale in screen space

```tsx
function ScreenSpaceElement({ worldPosition, screenSize = 10 }) {
  return (
    <group position={worldPosition}>
      <ScreenSizer scale={screenSize}>
        {children}
      </ScreenSizer>
    </group>
  );
}
```

## Transform Utilities

### Viewport-Aware Scaling

```tsx
function useTimelineScale() {
  const { viewport, camera } = useThree();
  const duration = useAnimationStore(state => state.duration);
  
  return useMemo(() => {
    // Map timeline duration to viewport width
    const pixelsPerMs = viewport.width / duration;
    const msPerPixel = duration / viewport.width;
    
    return {
      timeToWorld: (ms: number) => (ms - duration/2) * pixelsPerMs,
      worldToTime: (x: number) => (x / pixelsPerMs) + duration/2,
      pixelsPerMs,
      msPerPixel
    };
  }, [viewport.width, duration]);
}
```

### Level-of-Detail with Groups

```tsx
function LODTrackContent({ trackId }) {
  const { camera } = useThree();
  const [lod, setLod] = useState('high');
  
  useFrame(() => {
    const zoom = (camera as OrthographicCamera).zoom;
    if (zoom < 0.5) setLod('low');
    else if (zoom < 2) setLod('medium');
    else setLod('high');
  });
  
  return (
    <group>
      {/* Always visible */}
      <group name="lod-critical">
        <MajorKeyframes trackId={trackId} />
      </group>
      
      {/* Medium and high detail */}
      {lod !== 'low' && (
        <group name="lod-medium">
          <MinorKeyframes trackId={trackId} />
          <InterpolationCurves trackId={trackId} />
        </group>
      )}
      
      {/* High detail only */}
      {lod === 'high' && (
        <group name="lod-high">
          <KeyframeLabels trackId={trackId} />
          <VelocityIndicators trackId={trackId} />
        </group>
      )}
    </group>
  );
}
```

## Instance Transform Pattern

Instead of calculating positions for each instance:

```tsx
// Old approach - calculating each position
frames.forEach((frame, i) => {
  const x = xScale(frame.stamp * duration);
  const y = yScale(frame.value);
  instanceMesh.setMatrixAt(i, matrix.setPosition(x, y, 0));
});

// New approach - use parent transform
<group scale={[timeScale, valueScale, 1]} position={[timeOffset, valueOffset, 0]}>
  <Instances>
    {frames.map(frame => (
      // Position in normalized space (0-1)
      <Instance position={[frame.stamp, frame.value, 0]} />
    ))}
  </Instances>
</group>
```

## Camera-Based Calculations

### Viewport Utilities

```tsx
function useViewportInfo() {
  const { viewport, camera } = useThree();
  
  return useMemo(() => {
    const cam = camera as OrthographicCamera;
    
    return {
      // World units visible
      visibleWidth: cam.right - cam.left,
      visibleHeight: cam.top - cam.bottom,
      
      // Pixels per world unit
      pixelDensity: viewport.width / (cam.right - cam.left),
      
      // World units per pixel
      worldPerPixel: (cam.right - cam.left) / viewport.width,
      
      // Viewport bounds in world space
      bounds: {
        left: cam.left,
        right: cam.right,
        top: cam.top,
        bottom: cam.bottom
      }
    };
  }, [viewport, camera]);
}
```

### Frustum-Based Culling

```tsx
function VisibilityGroup({ bounds, children }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>();
  
  useFrame(() => {
    if (!groupRef.current) return;
    
    const cam = camera as OrthographicCamera;
    const visible = !(
      bounds.right < cam.left ||
      bounds.left > cam.right ||
      bounds.top < cam.bottom ||
      bounds.bottom > cam.top
    );
    
    groupRef.current.visible = visible;
  });
  
  return <group ref={groupRef}>{children}</group>;
}
```

## Implementation Strategy

### Phase 1: Scene Structure
1. Set up group hierarchy
2. Implement viewport transform utilities
3. Create coordinate system mappings

### Phase 2: Component Migration
1. Convert keyframes to use instance transforms
2. Implement screen-space sizing for UI elements
3. Use groups for LOD management

### Phase 3: Optimization
1. Implement frustum culling at group level
2. Add transform caching
3. Optimize update patterns

## Benefits

1. **Cleaner Code**: Less manual calculation, more declarative
2. **Better Performance**: GPU handles transforms, fewer JS calculations
3. **Easier Maintenance**: Clear hierarchy and separation of concerns
4. **Flexible Scaling**: Easy to add zoom/pan without recalculating everything
5. **Natural LOD**: Group visibility makes LOD implementation straightforward

## Example: Complete Track Implementation

```tsx
function Track3D({ trackId, index }) {
  const { viewport } = useThree();
  const viewportTransform = useViewportTransform();
  const timelineScale = useTimelineScale();
  const trackData = useAnimationStore(state => state.tracks[trackId]);
  
  const trackY = -index * TRACK_HEIGHT;
  
  return (
    <group position={[0, trackY, 0]}>
      {/* Background - full viewport width */}
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[viewport.width, TRACK_HEIGHT]} />
        <trackBackgroundMaterial />
      </mesh>
      
      {/* Data container with timeline transform */}
      <group
        scale={[1 / timelineScale.msPerPixel, 1, 1]}
        position={[-viewport.width / 2, 0, 0]}
      >
        {/* Keyframes in timeline space */}
        <Instances limit={1000}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial />
          {trackData.keyframes.map(frame => (
            <Instance
              key={frame.id}
              position={[frame.time, 0, 0]}
              scale={8} // Constant size in timeline units
              color={trackData.color}
            />
          ))}
        </Instances>
        
        {/* Interpolations */}
        <InterpolationCurves frames={trackData.keyframes} />
      </group>
      
      {/* Screen-space overlays */}
      <group>
        {trackData.violations.map(violation => (
          <ScreenSpaceViolation
            key={violation.id}
            timeRange={violation.range}
            worldY={0}
          />
        ))}
      </group>
    </group>
  );
}
```

This architecture provides a solid foundation for the Three.js migration while significantly simplifying the codebase and improving maintainability.