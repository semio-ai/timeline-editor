# Three.js Animation Sheet Migration Implementation Plan

## Overview

This document outlines a comprehensive multi-phase migration plan for implementing a Three.js-based animation sheet using React Three Fiber, drei, and related libraries. The new implementation will be built alongside the existing SVG version as a drop-in replacement, with each phase capable of rendering Storybook stories using the same data inputs.

## Architecture Goals

- **Drop-in replacement**: Same props interface as existing `AnimationSheet`
- **Progressive enhancement**: Each phase adds functionality while maintaining story compatibility
- **Performance-first**: Designed for 100+ tracks from the start
- **Visual parity**: Maintain exact appearance and UX of SVG version
- **Incremental delivery**: Small, focused changes per phase

## Component Structure

```
AnimationSheet3D/
├── core/
│   ├── canvas-provider.tsx       # Single Canvas with View.Port
│   ├── view-manager.tsx          # Manages tracking divs and View components
│   └── coordinate-system.tsx     # Transform utilities and scales
├── components/
│   ├── animation-sheet-3d.tsx    # Main component (drop-in replacement)
│   ├── track-visualizer-3d.tsx   # Individual track rendering
│   ├── timeline-3d.tsx           # Timeline component
│   ├── ruler-3d.tsx              # Top/bottom rulers
│   └── minimap-3d.tsx            # Minimap component
├── track-internals/
│   ├── track-background-3d.tsx   # Grid and tick rendering
│   ├── data-display-3d.tsx       # Keyframes and interpolation
│   ├── frame-marker-3d.tsx       # Individual keyframe rendering
│   ├── gesture-controls-3d.tsx   # Pan/zoom interaction
│   ├── bounds-display-3d.tsx     # Viewport bounds visualization
│   ├── bound-cart-3d.tsx         # Left/right bound indicators
│   ├── hover-marker-3d.tsx       # Mouse position indicator
│   ├── playhead-3d.tsx           # Current time indicator
│   ├── playhead-cart-3d.tsx      # Playhead with time display
│   └── zoom-display-3d.tsx       # Minimap zoom indicator
├── materials/
│   ├── grid-material.ts          # Shader for tick rendering
│   ├── interpolation-material.ts # Curve rendering shaders
│   └── violation-material.ts     # Diagonal stripe patterns
├── hooks/
│   ├── use-viewport-transform.ts # Camera/viewport calculations
│   ├── use-track-layout.ts       # Dynamic track positioning
│   └── use-three-gestures.ts     # Gesture handling integration
└── stories/
    └── animation-sheet-3d.stories.tsx  # Story variants for each phase
```

## Phase Implementation Plan

### Phase 1: Infrastructure and Basic Canvas Setup

**Goal**: Establish Three.js infrastructure with basic View system rendering empty tracks.

**Deliverables**:
- Canvas provider with View.Port setup
- Basic AnimationSheet3D component with same props interface
- Empty track containers that match SVG layout
- Basic View system for rulers, timeline, minimap

**Components**:
```tsx
// Basic structure - renders empty colored rectangles where tracks should be
function AnimationSheet3D(props: AnimationSheetProps) {
  return (
    <div className="relative w-full h-full">
      <Canvas className="absolute inset-0 pointer-events-none">
        <View.Port />
      </Canvas>
      
      <div className="grid grid-cols-[298px_1fr] grid-rows-[32px_1fr_36px_36px_36px]">
        {/* HTML controls remain unchanged */}
        <div ref={rulerTopRef}>
          <View track={rulerTopRef}>
            <PlaceholderRect color="blue" />
          </View>
        </div>
        {/* ... other views with placeholder rects */}
      </div>
    </div>
  );
}
```

**Stories**: Basic layout verification - colored rectangles in correct positions.

**Success Criteria**:
- [ ] Canvas renders without errors
- [ ] View system creates proper viewports
- [ ] Layout matches SVG version dimensions
- [ ] All story variants render (even as placeholders)

### Phase 2: Coordinate System and Transform Architecture

**Goal**: Implement transform-based coordinate system with proper camera setup.

**Deliverables**:
- OrthographicCamera setup for each View
- Viewport transform utilities
- Scale and position calculation hooks
- Basic world-space coordinate mapping

**Components**:
```tsx
function useViewportTransform() {
  const { viewport } = useThree();
  const playerViewport = usePlayerStore(state => state.player.viewport);
  
  return useMemo(() => {
    const timelineWidth = viewport.width;
    const visibleWidth = timelineWidth * (playerViewport[1] - playerViewport[0]);
    const scale = timelineWidth / visibleWidth;
    const offset = -timelineWidth * playerViewport[0] * scale;
    
    return { scale, offset };
  }, [viewport.width, playerViewport]);
}

function BaseView3D({ trackRef, children }) {
  const viewportTransform = useViewportTransform();
  
  return (
    <View track={trackRef}>
      <OrthographicCamera makeDefault position={[0, 0, 100]} />
      <group 
        scale={[viewportTransform.scale, 1, 1]}
        position={[viewportTransform.offset, 0, 0]}
      >
        {children}
      </group>
    </View>
  );
}
```

**Stories**: Colored rectangles that respond to viewport changes.

**Success Criteria**:
- [ ] Cameras properly positioned and sized
- [ ] Viewport transforms apply correctly
- [ ] Pan/zoom gestures work on placeholder content
- [ ] Multiple Views stay synchronized

### Phase 3: Grid and Tick Rendering

**Goal**: Implement shader-based grid and tick system for backgrounds.

**Deliverables**:
- Custom tick grid shader material
- TrackBackground3D component
- Ruler tick rendering with LOD
- Time label rendering with drei Text

**Components**:
```tsx
const TickGridMaterial = shaderMaterial(
  {
    uFramerate: 30,
    uDuration: 5000,
    uZoom: 1,
    uViewportStart: 0,
    uViewportEnd: 1,
  },
  vertexShader,
  fragmentShader
);

function TrackBackground3D({ width, height }) {
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
```

**Stories**: Proper grid and tick rendering matching SVG appearance.

**Success Criteria**:
- [ ] Ticks render at correct intervals
- [ ] Major/minor tick distinction works
- [ ] LOD system shows/hides ticks based on zoom
- [ ] Time labels appear correctly
- [ ] Performance remains smooth with many ticks

### Phase 4: Basic Data Visualization

**Goal**: Render keyframes as simple shapes without interpolation.

**Deliverables**:
- FrameMarker3D component using Instance
- Basic keyframe positioning and coloring
- Simple data parsing from animation store
- Screen-space scaling for consistent keyframe size

**Components**:
```tsx
function DataDisplay3D() {
  const frameData = useMemo(() => computeFrames(tracks, []), [tracks]);
  
  return (
    <Instances limit={10000} range={frameData.length}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial />
      
      {frameData.map(frame => (
        <FrameMarker3D
          key={frame.id}
          frame={frame}
          position={[xScale(frame.stamp * duration), 0, 0]}
        />
      ))}
    </Instances>
  );
}

function FrameMarker3D({ frame, position }) {
  const instanceRef = useRef();
  
  useFrame(({ camera, viewport }) => {
    // Screen-space scaling
    const scaleFactor = calculateScreenScale(camera, viewport);
    instanceRef.current.scale.setScalar(scaleFactor);
  });
  
  return (
    <Instance
      ref={instanceRef}
      position={position}
      color={frame.color}
      userData={{ frameId: frame.id }}
    />
  );
}
```

**Stories**: Keyframes appear as colored diamonds in correct positions.

**Success Criteria**:
- [ ] Keyframes render at correct timestamps
- [ ] Colors match track settings
- [ ] Screen-space scaling maintains visual size
- [ ] Multiple tracks display correctly
- [ ] Performance acceptable with 100+ keyframes

### Phase 5: Gesture Integration and Interaction

**Goal**: Implement custom pan/zoom controls and basic keyframe interaction.

**Deliverables**:
- PanZoomControls integration
- Gesture handling for horizontal scroll and pinch zoom
- Basic keyframe hover/selection
- Raycasting for object interaction

**Components**:
```tsx
function GestureEnabledView({ trackRef, children }) {
  return (
    <View track={trackRef}>
      <OrthographicCamera makeDefault />
      <PanZoomControls
        enablePan={true}
        enableZoom={true}
        panSpeed={2.0}
        zoomSpeed={1.2}
        minZoom={0.05}
        maxZoom={20}
        mouseButtons={{ LEFT: null, MIDDLE: null, RIGHT: null }}
      />
      <SelectableGroup>
        {children}
      </SelectableGroup>
    </View>
  );
}

function InteractiveKeyframe({ frame, position }) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <Instance
      position={position}
      scale={hovered ? 1.2 : 1}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={(e) => handleSelection(frame.id)}
    />
  );
}
```

**Stories**: Interactive keyframes with hover effects and basic pan/zoom.

**Success Criteria**:
- [ ] Horizontal scroll pans timeline
- [ ] Pinch/Ctrl+scroll zooms
- [ ] Keyframes respond to hover
- [ ] Selection system works
- [ ] Gesture behavior matches SVG version
- [ ] Basic hover marker appears on mouse movement

### Phase 6: Interpolation Curve Rendering

**Goal**: Add interpolation curves between keyframes using drei's CubicBezierLine.

**Deliverables**:
- InterpolationSegment3D component
- Support for different render modes (Key, Preview, Transition)
- Bezier curve calculation and rendering
- Filled area rendering for Preview mode

**Components**:
```tsx
function InterpolationSegment3D({ start, end, trackRender, color }) {
  const { control1, control2 } = useMemo(() => {
    if (trackRender === TrackRender.Key) {
      return { control1: start.position, control2: end.position };
    }
    
    const deltaX = end.position.x - start.position.x;
    return {
      control1: new Vector3(start.position.x + deltaX * 0.5, start.position.y, 0),
      control2: new Vector3(end.position.x - deltaX * 0.5, end.position.y, 0)
    };
  }, [start, end, trackRender]);
  
  if (trackRender === TrackRender.Key) {
    return (
      <Line
        points={[start.position, end.position]}
        color={color}
        lineWidth={4}
      />
    );
  }
  
  return (
    <CubicBezierLine
      start={start.position}
      end={end.position}
      midA={control1}
      midB={control2}
      color={color}
      lineWidth={1.5}
    />
  );
}
```

**Stories**: Smooth curves between keyframes with different render modes.

**Success Criteria**:
- [ ] Linear interpolation (Key mode) renders as straight lines
- [ ] Bezier curves (Preview mode) render smoothly
- [ ] Transition mode shows easing visualization
- [ ] Performance remains good with many curves
- [ ] Visual appearance matches SVG version

### Phase 7: UI Indicators and Navigation Elements

**Goal**: Add playhead, bounds display, hover markers, and other UI indicators.

**Deliverables**:
- Playhead and PlayheadCart components
- BoundsDisplay and BoundCart components for viewport boundaries
- HoverMarker for mouse position feedback
- ZoomDisplay for minimap integration
- Violation rendering with diagonal stripe patterns
- HTML tooltip integration

**Components**:
```tsx
function Playhead3D({ ignoreZoom = false }) {
  const currentTime = usePlayerStore(state => state.currentTime);
  const { xScale, bounds } = useTrackContext();
  const lineRef = useRef();
  
  const transformSpring = useTrackTransformSpring(ignoreZoom, false);
  
  return (
    <motion.line
      ref={lineRef}
      x1={xScale(currentTime)}
      x2={xScale(currentTime)}
      y1={0}
      y2={bounds.height}
      stroke="red"
      strokeWidth={2}
      className="pointer-events-none"
    />
  );
}

function HoverMarker3D({ ignoreZoom = false }) {
  const [mouseX, setMouseX] = useState(0);
  const { bounds, xScale } = useTrackContext();
  
  return (
    <motion.line
      x1={mouseX}
      x2={mouseX}
      y1={0}
      y2={bounds.height}
      stroke="gray"
      strokeWidth={1}
      opacity={0.7}
      className="pointer-events-none"
    />
  );
}

function BoundsDisplay3D({ ignoreZoom = false }) {
  const viewport = usePlayerStore(state => state.player.viewport);
  const { xScale, bounds } = useTrackContext();
  
  return (
    <group>
      <BoundCart3D side="left" position={xScale(viewport[0])} />
      <BoundCart3D side="right" position={xScale(viewport[1])} />
      {/* Bounds overlay */}
      <rect
        x={xScale(viewport[0])}
        width={xScale(viewport[1]) - xScale(viewport[0])}
        height={bounds.height}
        fill="blue"
        opacity={0.1}
        className="pointer-events-none"
      />
    </group>
  );
}

function ViolationSegment3D({ segment }) {
  return (
    <mesh position={[segment.center, 0, 0.1]}>
      <planeGeometry args={[segment.width, TRACK_HEIGHT]} />
      <violationMaterial
        uStripeWidth={10}
        uColor={getViolationColor(segment.violations)}
        transparent
      />
    </mesh>
  );
}
```

**Stories**: Full UI indicators and navigation elements.

**Success Criteria**:
- [ ] Playhead moves correctly with current time
- [ ] Hover marker follows mouse position
- [ ] Bounds display shows viewport boundaries
- [ ] Bound carts appear at correct positions
- [ ] Zoom display works in minimap
- [ ] Violation areas render with correct patterns
- [ ] Tooltips show on hover with proper positioning
- [ ] All indicators respond to pan/zoom transforms

### Phase 8: Performance Optimization and Polish

**Goal**: Final optimizations, advanced features, and production readiness.

**Deliverables**:
- Instanced rendering for maximum performance
- Advanced culling and batching
- LOD system based on zoom level
- Viewport culling for invisible tracks
- Smooth animations and transitions
- Error boundary and fallback handling
- Comprehensive test coverage

**Components**:
```tsx
function HighPerformanceKeyframes({ tracks }) {
  const instanceMatrix = useMemo(() => {
    const matrices = [];
    tracks.forEach(track => {
      track.frames.forEach(frame => {
        const matrix = new Matrix4().setPosition(
          xScale(frame.timestamp), 
          getTrackY(track.id), 
          0
        );
        matrices.push(matrix);
      });
    });
    return matrices;
  }, [tracks]);
  
  return (
    <instancedMesh args={[geometry, material, instanceMatrix.length]}>
      {/* Optimized batch rendering */}
    </instancedMesh>
  );
}

function OptimizedTrackContent({ track }) {
  const lod = useLOD();
  const visible = useViewportCulling(track.bounds);
  
  if (!visible) return null;
  
  return (
    <group>
      {lod === 'high' && <DetailedTrackContent track={track} />}
      {lod === 'medium' && <SimplifiedTrackContent track={track} />}
      {lod === 'low' && <MinimalTrackContent track={track} />}
    </group>
  );
}
```

**Stories**: Performance comparison stories showing frame rates and memory usage.

**Success Criteria**:
- [ ] 60+ FPS with 1000+ keyframes
- [ ] Memory usage under 500MB for large animations
- [ ] Smooth pan/zoom at all scales
- [ ] Visual artifacts eliminated
- [ ] Error states handled gracefully

## Story Development Strategy

Each phase will include corresponding Storybook stories:

```tsx
// stories/animation-sheet-3d.stories.tsx
export default {
  title: "animation/AnimationSheet3D",
  component: AnimationSheet3D,
};

// Phase-specific stories
export const Phase1_Infrastructure = { /* Basic layout */ };
export const Phase2_Coordinates = { /* Transform system */ };
export const Phase3_Grid = { /* Grid and ticks */ };
export const Phase4_Data = { /* Basic keyframes */ };
export const Phase5_Interaction = { /* Gestures */ };
export const Phase6_Interpolation = { /* Curves */ };
export const Phase7_UIIndicators = { /* Playhead, bounds, hover */ };
export const Phase8_Performance = { /* Optimized */ };

// Comparison stories
export const SVG_vs_Three_Comparison = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <AnimationSheet {...sharedProps} />
      <AnimationSheet3D {...sharedProps} />
    </div>
  )
};
```

## Implementation Guidelines

### Code Organization
- Keep each phase in feature branches
- Use TypeScript strict mode throughout
- Follow existing naming conventions
- Maintain prop interface compatibility

### Testing Strategy
- Visual regression tests for each phase
- Performance benchmarks at each stage
- Interaction testing with Playwright
- Unit tests for utility functions

### Documentation
- Update this plan as phases complete
- Document any architectural changes
- Create migration guide for consumers
- Performance comparison reports

### Quality Gates
- Each phase must pass all existing animation stories
- Performance must not regress from previous phase
- Visual output must match SVG version exactly
- No memory leaks or excessive re-renders

## Migration Timeline

**Phase 1-2**: Weeks 1-2 (Infrastructure)
**Phase 3-4**: Weeks 3-4 (Basic rendering)
**Phase 5-6**: Weeks 5-6 (Interaction and curves)
**Phase 7-8**: Weeks 7-8 (UI indicators and optimization)

Each phase should take 1-2 weeks with proper testing and documentation. The modular approach ensures we can ship incremental improvements and gather feedback early.

## Risk Mitigation

- **Performance concerns**: Start with small datasets, optimize incrementally
- **Visual parity**: Frequent comparison with SVG version
- **Browser compatibility**: Test across target browser matrix
- **Large track counts**: Implement virtualization early in Phase 7
- **Gesture conflicts**: Extensive testing of pan/zoom interactions

## Success Metrics

- **Visual**: Pixel-perfect match with SVG version
- **Performance**: 60+ FPS with 100+ tracks
- **Memory**: <2GB total for large animations
- **UX**: No behavioral regressions from SVG version
- **Maintainability**: Clear, documented, testable code