# Migration Guide: SVG to Three.js/React Three Fiber Animation System

## Overview

This guide outlines the migration strategy for converting the current SVG-based animation sheet to a Three.js/React Three Fiber (R3F) implementation using drei's View component system. The goal is to maintain the current layout and functionality while leveraging 3D rendering capabilities.

## Current Architecture Analysis

### Component Hierarchy

```
AnimationSheet
├── Grid Layout Container
├── Expand Toggle & Controls
├── Ruler (Top)
├── TrackList
│   ├── ScrollArea
│   └── TrackRow[]
│       ├── ControlWidget
│       └── TrackVisualizer
│           ├── TrackBackground (SVG)
│           └── DataDisplay (SVG)
├── Timeline
│   └── TrackVisualizer
├── Minimap
│   └── TrackVisualizer
├── TimelineControl
├── TimeControls
├── PlaybackSettings
└── Ruler (Bottom)
```

### Core SVG Components

1. **TrackVisualizer** - The main rendering component that creates SVG elements
2. **TrackBackground** - Renders grid lines, ticks, and background patterns
3. **DataDisplay** - Renders keyframes, interpolation curves, and violations
4. **FrameMarker** - Individual keyframe representations
5. **InterpolationSegment** - Curves between keyframes
6. **ViolationDisplay** - Error/warning indicators

## Migration Strategy

### 1. Canvas Architecture

Following the reference pattern, we'll use a single Canvas with multiple View components:

```tsx
<Canvas frameloop="demand" className="animation-canvas">
  <View.Port />
</Canvas>
```

Each visual component (TrackList, Timeline, Minimap, Rulers) will have a corresponding tracking div with a View component.

### 2. Component Migration Map

#### AnimationSheet → AnimationSheet3D
- Maintain CSS Grid layout for HTML structure
- Add single Canvas element
- Replace SVG-rendering components with View-tracked divs

#### TrackVisualizer → TrackVisualizer3D
- Convert from `<svg>` to `<View>` with scene
- Use OrthographicCamera for 2D-like visualization
- Implement scene management for each track

#### TrackBackground → TrackBackground3D
- **Grid Lines**: Use Three.js GridHelper or custom line geometry
- **Tick Marks**: Create instanced mesh for performance
- **Background**: Use plane geometry with materials
- **Patterns**: Implement with shaders or textures

#### DataDisplay → DataDisplay3D
- **Keyframes**: Use instanced spheres or custom geometry
- **Interpolation**: Use CatmullRomCurve3 or custom curve geometry
- **Violations**: Use sprite or billboard techniques

### 3. Scene Structure

Each View will contain:
```
Scene
├── OrthographicCamera
├── Lighting (minimal for 2D look)
├── Background Plane
├── Grid/Ticks Group
├── Data Group
│   ├── Keyframes (InstancedMesh)
│   ├── Interpolation Curves
│   └── Violations
└── Controls (MapControls)
```

### 4. Interaction Migration

#### Gestures
- Maintain existing `useZoomGestures` hook
- Apply transformations to camera instead of SVG transform
- Use MapControls for panning (disable rotation)

#### Frame Dragging
- Use Three.js raycasting for object selection
- Implement custom drag controls or adapt DragControls
- Maintain frame merging logic

### 5. Performance Optimizations

1. **Instancing**: Use InstancedMesh for repeated elements (ticks, keyframes)
2. **LOD**: Implement level-of-detail for dense data
3. **Culling**: Use frustum culling for off-screen elements
4. **Geometry Merging**: Combine static geometries

### 6. Visual Parity Considerations

#### Maintaining 2D Appearance
- Use OrthographicCamera exclusively
- Disable shadows and complex lighting
- Use flat shading or unlit materials
- Implement custom shaders for patterns

#### Color Management
- Port color hooks to material properties
- Use uniforms for dynamic color updates
- Maintain opacity/transparency behavior

## Implementation Phases

### Phase 1: Infrastructure
1. Set up Canvas and View system
2. Create base Track3DVisualizer component
3. Implement camera and control setup

### Phase 2: Background Elements
1. Migrate grid and tick rendering
2. Implement pattern systems
3. Port ruler components

### Phase 3: Data Visualization
1. Convert keyframe rendering
2. Implement interpolation curves
3. Add violation indicators

### Phase 4: Interactions
1. Port gesture handling
2. Implement frame dragging
3. Add selection mechanics

### Phase 5: Optimization & Polish
1. Implement instancing
2. Add LOD systems
3. Performance profiling
4. Visual refinements

## Key Challenges & Solutions

### Challenge 1: SVG Masks & Patterns
**Solution**: Use stencil buffers or custom shaders for masking effects. Patterns can be implemented with texture mapping or procedural shaders.

### Challenge 2: Precise 2D Positioning
**Solution**: Use pixel-perfect OrthographicCamera setup with careful coordinate mapping from screen space to world space.

### Challenge 3: Text Rendering
**Solution**: Use drei's Text component or HTML overlays for labels and time markers.

### Challenge 4: Performance with Many Tracks
**Solution**: Implement virtualization - only render visible tracks, use object pooling for dynamic elements.

## Benefits of Migration

1. **Performance**: GPU acceleration for complex animations
2. **Scalability**: Better handling of large datasets
3. **Effects**: Access to shaders and post-processing
4. **3D Ready**: Future expansion to 3D visualization
5. **Unified Rendering**: Single render pipeline

## Next Steps

1. Create proof-of-concept with single track
2. Benchmark performance vs SVG implementation
3. Develop migration tooling for existing animations
4. Plan incremental rollout strategy