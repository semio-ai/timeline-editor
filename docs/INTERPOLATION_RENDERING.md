# Interpolation Rendering Guide

## Overview

This guide covers the rendering of interpolation segments between keyframes in Three.js, supporting multiple visualization modes (Key, Preview, Transition) while maintaining visual parity with the SVG implementation.

## Rendering Modes

### 1. Key Mode (Linear Interpolation)
- Simple straight lines between keyframes
- Thicker stroke (4px equivalent)
- Dashed lines for pseudo regions

### 2. Preview Mode (Bezier Curves)
- Smooth bezier curves showing actual interpolation
- Filled area beneath curve
- Thin stroke (1.5px)

### 3. Transition Mode (Easing Visualization)  
- Shows easing function (0 to 1)
- Filled area visualization
- No stroke for pseudo regions

## Implementation Options

### Option 1: drei's CubicBezierLine (Recommended for Curves)

CubicBezierLine is ideal for Preview and Transition modes:

```tsx
import { CubicBezierLine, Line } from "@react-three/drei";
import { Vector3 } from "three";
import { useMemo } from "react";

interface InterpolationSegment3DProps {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  trackRender: TrackRender;
  pseudoRegion?: boolean;
  color: string;
}

function InterpolationSegment3D({
  start,
  end,
  trackRender,
  pseudoRegion = false,
  color
}: InterpolationSegment3DProps) {
  const { xScale, yScale } = useTrackContext();
  const duration = usePlayerStore(state => state.player.duration);
  
  // Calculate positions
  const startPos = useMemo(() => 
    new Vector3(
      xScale(start.stamp * duration),
      yScale(start.value),
      0
    ), [start, xScale, yScale, duration]
  );
  
  const endPos = useMemo(() => 
    new Vector3(
      xScale(end.stamp * duration),
      yScale(end.value),
      0
    ), [end, xScale, yScale, duration]
  );
  
  // Calculate control points for bezier curve
  const { control1, control2 } = useMemo(() => {
    if (trackRender === TrackRender.Key) {
      // No control points needed for linear
      return { control1: startPos, control2: endPos };
    }
    
    // Calculate bezier control points based on interpolation type
    const deltaX = endPos.x - startPos.x;
    const deltaY = endPos.y - startPos.y;
    
    return {
      control1: new Vector3(
        startPos.x + deltaX * 0.5,
        startPos.y,
        0
      ),
      control2: new Vector3(
        endPos.x - deltaX * 0.5,
        endPos.y,
        0
      )
    };
  }, [startPos, endPos, trackRender]);
  
  // Render based on mode
  if (trackRender === TrackRender.Key) {
    return (
      <Line
        points={[startPos, endPos]}
        color={color}
        lineWidth={4}
        dashed={pseudoRegion}
        dashScale={5}
        transparent
        opacity={pseudoRegion ? 0.5 : 1}
      />
    );
  }
  
  return (
    <>
      {/* Bezier curve line */}
      <CubicBezierLine
        start={startPos}
        end={endPos}
        midA={control1}
        midB={control2}
        color={color}
        lineWidth={1.5}
        dashed={pseudoRegion}
        transparent
        opacity={pseudoRegion ? 0.5 : 1}
      />
      
      {/* Filled area (if not pseudo region) */}
      {!pseudoRegion && trackRender === TrackRender.Preview && (
        <InterpolationFill
          curve={{ start: startPos, end: endPos, control1, control2 }}
          color={color}
        />
      )}
    </>
  );
}
```

### Option 2: Custom Shader-Based Curves

For maximum performance with many curves:

```tsx
const InterpolationCurveMaterial = shaderMaterial(
  {
    uStart: new THREE.Vector3(),
    uEnd: new THREE.Vector3(),
    uControl1: new THREE.Vector3(),
    uControl2: new THREE.Vector3(),
    uColor: new THREE.Color(),
    uOpacity: 1.0,
    uDashed: 0.0,
    uDashSize: 5.0,
    uTime: 0,
  },
  // Vertex shader
  `
    uniform vec3 uStart;
    uniform vec3 uEnd;
    uniform vec3 uControl1;
    uniform vec3 uControl2;
    
    attribute float t; // Parameter from 0 to 1
    varying float vT;
    
    vec3 bezier(float t, vec3 p0, vec3 p1, vec3 p2, vec3 p3) {
      float t2 = t * t;
      float t3 = t2 * t;
      float mt = 1.0 - t;
      float mt2 = mt * mt;
      float mt3 = mt2 * mt;
      
      return mt3 * p0 + 3.0 * mt2 * t * p1 + 3.0 * mt * t2 * p2 + t3 * p3;
    }
    
    void main() {
      vT = t;
      vec3 pos = bezier(t, uStart, uControl1, uControl2, uEnd);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uDashed;
    uniform float uDashSize;
    
    varying float vT;
    
    void main() {
      // Dashed line pattern
      if (uDashed > 0.5) {
        float dashPattern = mod(vT * 100.0, uDashSize * 2.0);
        if (dashPattern > uDashSize) discard;
      }
      
      gl_FragColor = vec4(uColor, uOpacity);
    }
  `
);
```

### Option 3: Instanced Curves for Multiple Segments

For rendering many interpolation segments efficiently:

```tsx
function InterpolationBatch({ segments }: { segments: SegmentData[] }) {
  const meshRef = useRef<THREE.InstancedMesh>();
  
  // Create curve geometry template
  const curveGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const points = 50; // Resolution
    const positions = new Float32Array(points * 3);
    const t = new Float32Array(points);
    
    for (let i = 0; i < points; i++) {
      t[i] = i / (points - 1);
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('t', new THREE.BufferAttribute(t, 1));
    
    return geometry;
  }, []);
  
  // Update instances
  useFrame(() => {
    segments.forEach((segment, i) => {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      
      // Update uniforms per instance (would need custom instancing)
      // This is pseudo-code - actual implementation would need 
      // per-instance attributes or uniform arrays
      material.uniforms.uStart.value = segment.start;
      material.uniforms.uEnd.value = segment.end;
      material.uniforms.uControl1.value = segment.control1;
      material.uniforms.uControl2.value = segment.control2;
    });
  });
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[curveGeometry, interpolationCurveMaterial, segments.length]}
    />
  );
}
```

## Filled Area Rendering

For Preview and Transition modes that require filled areas:

```tsx
function InterpolationFill({ curve, color }) {
  const { yScale, bounds } = useTrackContext();
  
  const fillGeometry = useMemo(() => {
    // Create filled shape under curve
    const shape = new THREE.Shape();
    const curvePoints = new THREE.CubicBezierCurve3(
      curve.start,
      curve.control1,
      curve.control2,
      curve.end
    ).getPoints(50);
    
    // Start from bottom
    shape.moveTo(curve.start.x, yScale(0));
    
    // Add curve points
    curvePoints.forEach(point => {
      shape.lineTo(point.x, point.y);
    });
    
    // Close path along bottom
    shape.lineTo(curve.end.x, yScale(0));
    shape.closePath();
    
    return new THREE.ShapeGeometry(shape);
  }, [curve, yScale]);
  
  return (
    <mesh geometry={fillGeometry} position={[0, 0, -0.1]}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
```

## Performance Optimizations

### 1. LOD for Curves

```tsx
function LODInterpolationSegment({ segment }) {
  const { camera } = useThree();
  const [curveResolution, setCurveResolution] = useState(50);
  
  useFrame(() => {
    if (camera instanceof OrthographicCamera) {
      const zoom = camera.zoom;
      
      // Adjust curve resolution based on zoom
      if (zoom < 0.5) {
        setCurveResolution(10);  // Low detail
      } else if (zoom < 2) {
        setCurveResolution(25);  // Medium detail
      } else {
        setCurveResolution(50);  // High detail
      }
    }
  });
  
  return (
    <CubicBezierLine
      {...segment}
      segments={curveResolution}
    />
  );
}
```

### 2. Curve Caching

```tsx
const curveCache = new Map<string, THREE.BufferGeometry>();

function getCachedCurveGeometry(key: string, generator: () => THREE.BufferGeometry) {
  if (!curveCache.has(key)) {
    curveCache.set(key, generator());
  }
  return curveCache.get(key)!;
}
```

### 3. Batched Updates

```tsx
function InterpolationRenderer() {
  const segments = useInterpolationSegments();
  
  // Group segments by visual properties
  const segmentGroups = useMemo(() => {
    return segments.reduce((groups, segment) => {
      const key = `${segment.trackRender}-${segment.pseudoRegion}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(segment);
      return groups;
    }, {});
  }, [segments]);
  
  return (
    <>
      {Object.entries(segmentGroups).map(([key, group]) => (
        <InterpolationGroup key={key} segments={group} />
      ))}
    </>
  );
}
```

## Dashed Line Implementation

For pseudo regions with dashed lines:

```tsx
function DashedInterpolation({ start, end, dashScale = 5 }) {
  const { camera } = useThree();
  const [dashSize, setDashSize] = useState(5);
  
  // Scale dashes based on zoom
  useFrame(() => {
    if (camera instanceof OrthographicCamera) {
      const zoom = camera.zoom;
      setDashSize(dashScale / zoom);
    }
  });
  
  return (
    <Line
      points={[start, end]}
      dashed
      dashScale={dashSize}
      gapScale={dashSize}
      dashOffset={0}
      computeLineDistances
    />
  );
}
```

## Mode-Specific Implementations

### Key Mode
```tsx
function KeyModeInterpolation({ segments }) {
  return segments.map(segment => (
    <Line
      key={segment.id}
      points={[segment.start, segment.end]}
      color={segment.color}
      lineWidth={4}
      dashed={segment.pseudoRegion}
      opacity={segment.pseudoRegion ? 0 : 1}
    />
  ));
}
```

### Preview Mode
```tsx
function PreviewModeInterpolation({ segments }) {
  return segments.map(segment => (
    <group key={segment.id}>
      <CubicBezierLine {...segment} lineWidth={1.5} />
      {!segment.pseudoRegion && <InterpolationFill {...segment} />}
    </group>
  ));
}
```

### Transition Mode
```tsx
function TransitionModeInterpolation({ segments }) {
  // Transition mode shows easing from 0 to 1
  return segments.map(segment => {
    const easingCurve = calculateEasingCurve(segment.easingType);
    return (
      <group key={segment.id}>
        <CubicBezierLine {...easingCurve} lineWidth={1.5} />
        <InterpolationFill {...easingCurve} />
      </group>
    );
  });
}
```

## Recommendations

1. **Use CubicBezierLine** for most cases - it's optimized and handles edge cases well
2. **Implement LOD** for curve resolution based on zoom level
3. **Batch similar segments** to reduce draw calls
4. **Cache geometries** for repeated curve types
5. **Use instancing** only for very large numbers of similar curves
6. **Consider shader-based rendering** for extreme performance needs

The drei CubicBezierLine component is recommended as it:
- Handles curve tessellation efficiently
- Supports dashed lines out of the box
- Integrates well with Three.js ecosystem
- Provides good performance for typical use cases