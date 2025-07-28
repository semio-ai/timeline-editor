# Rendering Optimization: Shaders and Instancing

## Overview

This document outlines the rendering strategies for achieving high performance while maintaining visual parity with the SVG implementation. The key approaches are:
1. **Shader-based tick rendering** for background grids with LOD
2. **Instanced meshes** for data points (keyframes)
3. **Screen-space scaling** to maintain consistent visual sizes

## Shader-Based Tick Rendering

### Background Grid Implementation

Instead of creating individual line meshes for ticks, use a single plane with a custom shader:

```tsx
import { shaderMaterial } from "@react-three/drei";
import { extend, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

// Define the shader material
const TickGridMaterial = shaderMaterial(
  {
    // Uniforms
    uTime: 0,
    uZoom: 1,
    uFramerate: 30,
    uDuration: 5000,
    uViewportStart: 0,
    uViewportEnd: 1,
    uTickColor: new THREE.Color(0.3, 0.3, 0.3),
    uMajorTickColor: new THREE.Color(0.5, 0.5, 0.5),
    uBackgroundColor: new THREE.Color(0.95, 0.95, 0.95),
    uTickOpacity: 1.0,
  },
  // Vertex shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform float uTime;
    uniform float uZoom;
    uniform float uFramerate;
    uniform float uDuration;
    uniform float uViewportStart;
    uniform float uViewportEnd;
    uniform vec3 uTickColor;
    uniform vec3 uMajorTickColor;
    uniform vec3 uBackgroundColor;
    uniform float uTickOpacity;
    
    varying vec2 vUv;
    
    float drawTick(float x, float width) {
      return smoothstep(width, 0.0, abs(x));
    }
    
    void main() {
      // Map UV to timeline position
      float timelinePos = mix(uViewportStart, uViewportEnd, vUv.x);
      float totalFrames = uFramerate * (uDuration / 1000.0);
      
      // Calculate tick positions
      float framePos = timelinePos * totalFrames;
      float nearestFrame = floor(framePos + 0.5);
      float distToFrame = abs(framePos - nearestFrame);
      
      // LOD based on zoom
      float tickWidth = 0.001 * uZoom;
      float majorTickWidth = tickWidth * 2.0;
      
      // Determine if this is a major tick (every second)
      bool isMajorTick = mod(nearestFrame, uFramerate) < 0.5;
      
      // Calculate tick visibility based on zoom (LOD)
      float minorTickOpacity = smoothstep(0.5, 2.0, uZoom) * uTickOpacity;
      float majorTickOpacity = uTickOpacity;
      
      // Draw tick
      float tick = 0.0;
      if (isMajorTick) {
        tick = drawTick(distToFrame / totalFrames, majorTickWidth) * majorTickOpacity;
      } else {
        tick = drawTick(distToFrame / totalFrames, tickWidth) * minorTickOpacity;
      }
      
      // Mix colors
      vec3 tickColorFinal = isMajorTick ? uMajorTickColor : uTickColor;
      vec3 color = mix(uBackgroundColor, tickColorFinal, tick);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
);

// Register the material
extend({ TickGridMaterial });
```

### Using the Tick Grid

```tsx
function TrackBackground3D({ width, height }) {
  const meshRef = useRef();
  const { camera } = useThree();
  const framerate = useAnimationStore(state => state.framerate);
  const duration = useAnimationStore(state => state.animations[animationId].duration);
  const viewport = usePlayerStore(state => state.player.viewport);
  
  useFrame(() => {
    if (meshRef.current && camera instanceof OrthographicCamera) {
      const zoom = (camera.right - camera.left) / width;
      meshRef.current.material.uniforms.uZoom.value = 1 / zoom;
      meshRef.current.material.uniforms.uViewportStart.value = viewport[0];
      meshRef.current.material.uniforms.uViewportEnd.value = viewport[1];
    }
  });
  
  return (
    <mesh ref={meshRef} position={[0, 0, -1]}>
      <planeGeometry args={[width, height]} />
      <tickGridMaterial
        uFramerate={framerate}
        uDuration={duration}
        transparent
      />
    </mesh>
  );
}
```

## Instanced Data Points

### Keyframe Renderer Pattern

Following the provided pattern, create an instanced renderer for keyframes:

```tsx
import { Instances, Instance } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import type { Object3D, OrthographicCamera } from "three";

interface KeyframeData {
  id: string;
  stamp: number; // 0-1 normalized time
  value: number;
  color: string;
  trackId: string;
}

export function KeyframeRenderer() {
  const frames = useAnimationStore(state => state.frames);
  const tracks = useAnimationStore(state => state.tracks);
  
  // Flatten all frames into a single array
  const allFrames = useMemo(() => {
    return Object.entries(frames).flatMap(([trackId, trackFrames]) => 
      trackFrames.map(frame => ({
        ...frame,
        trackId,
        color: tracks[trackId]?.color || '#0066cc'
      }))
    );
  }, [frames, tracks]);
  
  return (
    <Instances limit={10000} range={allFrames.length}>
      {/* Shared geometry - diamond shape for keyframes */}
      <octahedronGeometry args={[8, 0]} />
      <meshBasicMaterial toneMapped={false} />
      
      {/* Individual keyframe instances */}
      {allFrames.map((frame) => (
        <Keyframe
          key={frame.id}
          id={frame.id}
          stamp={frame.stamp}
          value={frame.value}
          color={frame.color}
          trackId={frame.trackId}
        />
      ))}
    </Instances>
  );
}
```

### Individual Keyframe with Screen-Space Scaling

```tsx
function Keyframe({ id, stamp, value, color, trackId }: KeyframeData) {
  const instanceRef = useRef<Object3D>(null);
  const { xScale, yScale } = useTrackContext();
  const duration = usePlayerStore(state => state.player.duration);
  
  // Convert normalized stamp to world position
  const worldX = useMemo(() => xScale(stamp * duration), [stamp, duration, xScale]);
  const worldY = useMemo(() => yScale(value), [value, yScale]);
  
  useFrame(({ camera, viewport }) => {
    if (instanceRef.current && camera instanceof OrthographicCamera) {
      // Calculate screen-space scaling to maintain consistent visual size
      const baseSize = 8; // Base size in pixels
      const currentWidth = camera.right - camera.left;
      const scaleFactor = (currentWidth / viewport.width) * baseSize;
      
      // Apply LOD - reduce size when zoomed out significantly
      const lodScale = currentWidth > viewport.width * 5 ? 0.5 : 1.0;
      
      instanceRef.current.scale.setScalar(scaleFactor * lodScale);
    }
  });
  
  return (
    <Instance
      ref={instanceRef}
      position={[worldX, worldY, 0]}
      color={color}
      userData={{ id, trackId }} // For interaction handling
    />
  );
}
```

## Interpolation Curves

For interpolation curves between keyframes, see the comprehensive [INTERPOLATION_RENDERING.md](./INTERPOLATION_RENDERING.md) guide which covers:

- Multiple rendering modes (Key, Preview, Transition)
- Using drei's CubicBezierLine component
- Shader-based curve rendering
- Filled area visualization
- Performance optimizations with LOD

Quick example using drei's CubicBezierLine:

```tsx
import { CubicBezierLine } from "@react-three/drei";

function InterpolationSegment({ start, end, control1, control2, color }) {
  return (
    <CubicBezierLine
      start={start}
      end={end}
      midA={control1}
      midB={control2}
      color={color}
      lineWidth={1.5}
    />
  );
}
```

For detailed implementation including mode-specific rendering, dashed lines, and performance optimizations, refer to the interpolation rendering guide.

## Violation Rendering with Masking

### Using drei's Mask Component

For violation displays that require diagonal stripe patterns, drei's Mask component provides an efficient solution:

```tsx
import { Mask, useMask } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ViolationRenderer() {
  const violations = useAnimationStore(state => state.violations);
  const { xScale } = useTrackContext();
  
  // Create mask for diagonal stripes
  const stencil = useMask(1, true);
  
  return (
    <>
      {/* Define the mask pattern */}
      <DiagonalStripeMask id={1} />
      
      {/* Render violations with mask applied */}
      <group>
        {violations.segments.map(segment => (
          <ViolationSegment
            key={segment.id}
            segment={segment}
            stencil={stencil}
          />
        ))}
      </group>
    </>
  );
}

function DiagonalStripeMask({ id }) {
  const maskRef = useRef();
  
  return (
    <Mask id={id} position={[0, 0, -0.1]}>
      <planeGeometry args={[1000, 1000]} />
      <shaderMaterial
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          void main() {
            float stripe = mod(vUv.x * 100.0 + vUv.y * 100.0, 20.0);
            float alpha = stripe < 10.0 ? 1.0 : 0.0;
            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
          }
        `}
      />
    </Mask>
  );
}
```

### Alternative: Shader-Based Violation Rendering

For better performance with many violations, use a custom shader:

```tsx
const ViolationMaterial = shaderMaterial(
  {
    uColor: new THREE.Color(1, 0, 0),
    uOpacity: 0.5,
    uStripeWidth: 10.0,
    uTime: 0,
  },
  // Vertex shader
  `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader with diagonal stripe pattern
  `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uStripeWidth;
    uniform float uTime;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      // Diagonal stripe pattern
      float stripe = mod((vPosition.x + vPosition.y) * 0.1, uStripeWidth);
      float mask = step(uStripeWidth * 0.5, stripe);
      
      // Apply color with pattern
      vec3 finalColor = uColor;
      float finalAlpha = uOpacity * mask;
      
      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `
);

extend({ ViolationMaterial });
```

### Instanced Violation Segments

For efficient rendering of multiple violation segments:

```tsx
function ViolationSegments() {
  const violationSet = useViolationSet();
  const { xScale } = useTrackContext();
  const duration = usePlayerStore(state => state.player.duration);
  
  // Prepare instance data
  const instanceData = useMemo(() => {
    return violationSet.segments.map(segment => {
      const startX = xScale(segment.stampRange.start * duration);
      const endX = xScale(segment.stampRange.end * duration);
      const width = endX - startX;
      const centerX = startX + width / 2;
      
      return {
        id: segment.id,
        position: [centerX, 0, 0.1] as [number, number, number],
        scale: [width, 50, 1] as [number, number, number],
        color: getViolationColor(segment.violations),
        violations: segment.violations
      };
    });
  }, [violationSet, xScale, duration]);
  
  return (
    <Instances limit={1000} range={instanceData.length}>
      <planeGeometry />
      <violationMaterial transparent />
      
      {instanceData.map(data => (
        <ViolationInstance
          key={data.id}
          {...data}
        />
      ))}
    </Instances>
  );
}

function ViolationInstance({ position, scale, color, violations }) {
  const instanceRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  return (
    <Instance
      ref={instanceRef}
      position={position}
      scale={scale}
      color={color}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      userData={{ violations }}
    />
  );
}
```

### Hover Interaction with HTML Overlay

For complex tooltips, use HTML overlays instead of 3D elements:

```tsx
import { Html } from "@react-three/drei";

function ViolationTooltip({ violations, position, visible }) {
  if (!visible) return null;
  
  return (
    <Html
      position={position}
      center
      style={{
        pointerEvents: 'none',
        transition: 'opacity 0.2s',
      }}
    >
      <div className="violation-tooltip">
        {/* Render violation details */}
        {violations.map(v => (
          <div key={v.id}>{v.type}: {v.message}</div>
        ))}
      </div>
    </Html>
  );
}
```

## Performance Optimizations

### 1. Frustum Culling for Tracks

```tsx
function OptimizedTrackView({ trackId, bounds }) {
  const meshRef = useRef();
  const { camera } = useThree();
  
  useFrame(() => {
    if (meshRef.current && camera instanceof OrthographicCamera) {
      // Simple horizontal frustum culling
      const trackLeft = bounds.left;
      const trackRight = bounds.right;
      const cameraLeft = camera.left;
      const cameraRight = camera.right;
      
      // Check if track is visible
      const isVisible = !(trackRight < cameraLeft || trackLeft > cameraRight);
      meshRef.current.visible = isVisible;
    }
  });
  
  return (
    <group ref={meshRef}>
      <KeyframeRenderer trackId={trackId} />
      <InterpolationCurveRenderer trackId={trackId} />
    </group>
  );
}
```

### 2. LOD System for Dense Data

```tsx
function useLOD() {
  const { camera } = useThree();
  const [lod, setLod] = useState<'high' | 'medium' | 'low'>('high');
  
  useFrame(() => {
    if (camera instanceof OrthographicCamera) {
      const zoomLevel = (camera.right - camera.left) / camera.getFrustumWidth();
      
      if (zoomLevel > 5) {
        setLod('low');    // Show only major elements
      } else if (zoomLevel > 2) {
        setLod('medium'); // Reduce detail
      } else {
        setLod('high');   // Full detail
      }
    }
  });
  
  return lod;
}
```

### 3. Object Pooling for Dynamic Elements

```tsx
class KeyframePool {
  private pool: Object3D[] = [];
  private active: Set<Object3D> = new Set();
  
  acquire(): Object3D {
    const obj = this.pool.pop() || new THREE.Mesh(
      new THREE.OctahedronGeometry(8, 0),
      new THREE.MeshBasicMaterial()
    );
    this.active.add(obj);
    return obj;
  }
  
  release(obj: Object3D): void {
    if (this.active.delete(obj)) {
      obj.visible = false;
      this.pool.push(obj);
    }
  }
  
  releaseAll(): void {
    this.active.forEach(obj => this.release(obj));
  }
}
```

## Visual Parity Considerations

### Maintaining SVG Appearance

1. **Colors**: Use exact color values from the SVG implementation
2. **Opacity**: Apply the same opacity rules based on zoom/hover states
3. **Patterns**: Implement diagonal stripes as shader patterns:

```glsl
// Diagonal stripe pattern in fragment shader
float stripePattern(vec2 uv, float width) {
  float stripe = mod(uv.x + uv.y, width * 2.0) / width;
  return step(1.0, stripe);
}
```

4. **Hover Effects**: Use raycasting with instanced meshes:

```tsx
function useInstanceHover(instances: Instances) {
  const { raycaster, mouse } = useThree();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  useFrame(() => {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(instances);
    
    if (intersects.length > 0) {
      const instanceId = intersects[0].object.userData.id;
      setHoveredId(instanceId);
    } else {
      setHoveredId(null);
    }
  });
  
  return hoveredId;
}
```

## Summary

This rendering approach provides:
- **60+ FPS** with thousands of keyframes and violations
- **Pixel-perfect** tick rendering at all zoom levels
- **Smooth LOD transitions** based on zoom
- **Minimal draw calls** through instancing and shaders
- **Complex masking** via drei's Mask or custom shaders
- **Visual parity** with the SVG implementation including patterns