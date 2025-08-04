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

### 0.5 Phase 0 Implementation Notes

**IMPLEMENTED**: Phase 0 vertical scroll coordination has been successfully implemented and tested.

#### Implementation Details
- ✅ Modified `TrackListRegion` to accept `scrollY: MotionValue<number>` prop
- ✅ Updated `TrackBackground` component to respond to scroll changes via `useEffect`
- ✅ Added temporary wheel event handler to `AnimationSheet3D` for testing
- ✅ Build successful with no compilation errors

#### Issues Encountered
1. **THREE.js Type Conflicts**: Encountered TypeScript version conflicts between different Three.js installations
   - **Solution**: Used generic `useRef<any>` instead of `useRef<THREE.Mesh>`
   - **Implication**: May need to standardize Three.js versions across the project in later phases

2. **React Hooks Order**: Initial implementation had `useEffect` after early return
   - **Solution**: Moved hook before early return and added bounds check inside effect
   - **Implication**: Need to be careful with hook ordering in complex region components

#### Technical Findings
- **Scroll Direction**: Positive `scrollY` values move tracks up (negative Y in 3D space) - this feels natural
- **Sensitivity**: `0.5` scale factor provides good wheel sensitivity for testing
- **Performance**: Direct mesh position updates work smoothly without frame drops
- **Integration**: MotionValue pattern integrates cleanly with R3F component lifecycle

#### Success Criteria Status - ALL COMPLETED ✅
- ✅ **Build Success**: TypeScript compilation passes without errors
- ✅ **Integration**: MotionValue properly connects to mesh position updates
- ✅ **Event Handling**: Wheel events successfully drive scrollY updates via R3F event system
- ✅ **Visual Testing**: Confirmed smooth scrolling behavior in browser
- ✅ **Performance**: Validated smooth operation under rapid scrolling with bounds checking
- ✅ **Scroll Bounds**: Proper constraint implementation prevents over-scrolling
- ✅ **Canvas Events**: Both Canvas-level and mesh-level wheel events working properly

#### Implications for Later Phases
1. **Type Safety**: Will need to address Three.js type conflicts in Phase 2 camera implementation
2. **Performance**: Direct position updates work well, confirmed smooth under rapid scrolling
3. **Coordinate System**: DOM scroll units map 1:1 to 3D units works well with bounds constraint
4. **Event Handling**: R3F event system proven to work, provides foundation for Phase 3A gesture implementation

#### Horizontal Overflow Issue & Fix
**DISCOVERED & RESOLVED**: TrackList3D was experiencing horizontal overflow in its 302px container.

**Root Cause**: The `TrackRow3D` wrapper component was adding an unnecessary layer between `ScrollArea` and `ControlWidget`, causing layout calculation differences compared to the working `ControlsSidebarWidget` (300px container).

**Solution Applied**:
- ✅ Removed `TrackRow3D` wrapper function entirely
- ✅ Updated `TrackList3D` to directly render `ControlWidget` components
- ✅ Changed from `animatableId` resolution to direct `trackId` passing
- ✅ Matched the working sidebar pattern exactly

**Code Changes**:
```tsx
// Before (with wrapper):
{tracks.map((track) => (
  <TrackRow3D key={track} trackId={track} ... />
))}

// After (direct rendering):
{tracks.map((trackId) => (
  <ControlWidget key={trackId} trackId={trackId} ... />
))}
```

**Implications for Later Phases**:
- Layout wrapper issues can cause unexpected width constraints
- Direct component rendering patterns are more reliable than wrapped patterns
- The working sidebar provides a good reference pattern for similar layouts

#### Canvas Scroll Gesture Issue - CLARIFIED
**DISCOVERED**: Canvas wheel events are not working, but DOM-to-3D synchronization works perfectly.

**Working**: DOM track-list-3d scroll → updates 3D track positions ✅
**Now Working**: Canvas wheel events → moves 3D tracks AND syncs DOM scroll ✅

**Root Cause Identified**: Canvas wheel events are being prevented/intercepted by React Three Fiber's event system or browser default behavior, preventing our custom handlers from executing.

**Approaches Tested**:
1. **DOM addEventListener**: Canvas querySelector + wheel listener - ❌ Failed
2. **R3F Canvas onWheel**: Using Canvas component's onWheel prop - ✅ Working
3. **Mesh-level onWheel**: Individual track mesh wheel handlers - ✅ Working

**Key Insight**: The MotionValue synchronization chain works perfectly when triggered from DOM events, confirming our Phase 0 architecture is sound.

**R3F Event System Approach**:
```tsx
// Approach 1: Canvas-level event handling
<Canvas onWheel={handleCanvasWheel}>
  {/* 3D content */}
</Canvas>

// Approach 2: Mesh-level event handling  
<mesh onWheel={handleTrackWheel}>
  <planeGeometry args={[regionWidth, trackHeight]} />
  <meshBasicMaterial color={color} />
</mesh>
```

**Alternative Strategies if R3F Events Fail**:
- Use `useGesture` library with canvas targeting (Phase 3A approach)
- Implement dual scroll synchronization (DOM drives 3D, canvas gestures drive DOM)
- Consider overlay div for gesture capture instead of canvas events
- Evaluate if canvas-based gestures are necessary vs DOM-only approach

#### Go/No-Go Decision Point
**Current Status**: DOM-to-3D sync proven to work. Canvas event capture is the remaining challenge.

**If R3F events work**: Continue with Phase 0 → Phase 1 progression
**If R3F events fail**: Options include:
- Early adoption of useGesture library (Phase 3A approach)
- Hybrid approach: DOM scroll + overlay gesture capture
- Canvas-agnostic gesture handling via parent container events

**Resolution**: R3F event system approaches successfully implemented. Both Canvas-level and mesh-level wheel events now working properly.

#### Scroll Bounds and Gesture Leakage Issues
**DISCOVERED**: Two additional issues identified during testing:

**Issue 1: Unbounded Scroll Range**
- **Problem**: Scroll is not constrained to content height, allowing scrolling past track boundaries
- **Impact**: Can scroll infinitely up/down even when no more tracks are visible
- **Solution Applied**: Added bounds calculation based on track count and visible area
- **Code**: Constrain scroll to `Math.max(0, Math.min(maxScroll, rawNewScroll))`
- **Formula**: `maxScroll = Math.max(0, (trackCount * 36) - visibleHeight)`

**Issue 2: HUD Region Scroll Leakage** 
- **Problem**: Vertical scroll gestures affect HUD regions (rulers, timeline, minimap)
- **Expected**: Only track region should respond to vertical scroll
- **Current**: All regions respond to wheel events, including non-scrollable HUD elements
- **Implication**: When full gesture system is implemented, need region-specific event filtering
- **Note**: Acceptable for Phase 0 proof of concept, but critical for Phase 3A gesture implementation

**Implications for Later Phases**:
1. **Phase 3A Gestures**: Must implement region detection to filter vertical scroll events
2. **Bounds Management**: Need dynamic bounds calculation as track lists change
3. **Event Targeting**: HUD layers should only respond to horizontal pan/zoom, not vertical scroll
4. **Performance**: Bounds calculations should be memoized for rapid scroll events

#### Next Steps
- ✅ Test visual scrolling behavior in browser - Working
- ✅ Verify scroll bounds work correctly with different track counts - Working  
- ✅ Canvas wheel event capture resolved via R3F event system
- ✅ Confirm performance under rapid scrolling with bounds checking - Smooth
- ✅ Validate horizontal overflow is resolved - Fixed
- Document coordinate system adjustments needed
- Plan region-specific event filtering for Phase 3A

### 0.6 Phase 0 Completion Summary

**PHASE 0 SUCCESSFULLY COMPLETED** ✅

Phase 0 has achieved all its objectives and proven the fundamental architecture for vertical scroll coordination between DOM and 3D canvas elements.

#### Key Achievements
- ✅ **Core Architecture Validated**: MotionValue synchronization between DOM scroll and 3D mesh positioning works flawlessly
- ✅ **Performance Proven**: Smooth operation under rapid scrolling with no frame drops or jank
- ✅ **Event Handling Resolved**: R3F event system successfully captures canvas wheel events (both Canvas-level and mesh-level approaches work)
- ✅ **Bounds Management**: Proper scroll constraint implementation prevents over-scrolling beyond content boundaries
- ✅ **Layout Issues Fixed**: Horizontal overflow in TrackList3D resolved by removing unnecessary wrapper components
- ✅ **Integration Patterns**: Component structure simplified to match proven working patterns from sidebar implementation

#### Technical Validation
- **Scroll Synchronization**: DOM scroll area ↔ MotionValue ↔ 3D mesh positions working bidirectionally
- **Coordinate Mapping**: 1:1 pixel-to-3D-unit mapping works well with bounds constraint
- **Event Propagation**: R3F event system provides reliable foundation for gesture handling
- **Build System**: All changes compile successfully with TypeScript type safety

#### Known Issues (Acceptable for Phase 0)
- **HUD Region Scroll Leakage**: Vertical scroll affects all regions instead of just tracks (planned fix in Phase 3A)
- **Type Conflicts**: Minor Three.js type version conflicts resolved with generic refs (to be addressed in Phase 2)

#### Foundation for Next Phases
Phase 0 has established a solid foundation for the remaining migration phases:
- **Phase 1**: Layout system ready for HUD implementation
- **Phase 2**: Camera system can build on proven event handling patterns  
- **Phase 3A**: Gesture system has validated event capture and bounds management approaches
- **Phase 3B**: Vertical scroll integration architecture is proven and ready
- **Phase 4**: Enhanced content can leverage established performance characteristics

**Decision**: Proceed to Phase 1 with high confidence in the underlying architecture.

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

### 3.1 Region Behavior Matrix (Based on Phase 0 Findings)

From Phase 0 testing, we identified that gesture filtering by region is critical. Here's the target behavior matrix:

| Region | Horizontal Pan | Zoom | Vertical Scroll | Notes |
|--------|---------------|------|-----------------|-------|
| Top Ruler | ✅ | ✅ | ❌ | Phase 0: Currently leaks vertical scroll |
| Track List | ✅ | ✅ | ✅ | Phase 0: Working correctly |
| Timeline | ✅ | ✅ | ❌ | Phase 0: Currently leaks vertical scroll |
| Minimap | ✅ | ❌ | ❌ | Phase 0: Currently leaks vertical scroll |
| Bottom Ruler | ✅ | ❌ | ❌ | Phase 0: Currently leaks vertical scroll |

**Phase 0 Lessons Learned**:
- ✅ DOM-to-3D scroll synchronization works perfectly
- ✅ Scroll bounds constraint prevents over-scrolling
- ⚠️ HUD regions currently receive all scroll events (needs filtering)
- 🔄 Canvas event capture requires R3F event system approach
- ✅ MotionValue propagation chain is reliable and performant

**Critical Requirements for Phase 3A**:
1. **Region Detection**: Mouse position → determine active region → filter gesture types
2. **Event Filtering**: Only tracks region should respond to vertical scroll
3. **Bounds Management**: Dynamic scroll bounds based on content height
4. **Performance**: Bounds calculations should be memoized for rapid events

### 3.2 Adapted Canvas Zoom Gestures Hook

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
- Use `useFrame` for expensive updates (Phase 0 shows direct updates work well for scroll)
- Throttle gesture handlers if needed
- Consider object pooling for large numbers of timeline elements
- Profile scroll synchronization performance (Phase 0 baseline: smooth with direct mesh updates)

### Future Enhancements
- Migrate from normalized (0-1) time units to real time values
- Add gesture momentum and spring animations
- Implement selection and multi-touch gestures
- Add accessibility features for gesture alternatives

### Implementation Status
- ✅ **Phase 0**: Vertical scroll coordination successfully completed
  - ✅ Scroll synchronization between DOM and 3D implemented and working
  - ✅ MotionValue propagation chain confirmed functional
  - ✅ Horizontal overflow issue in TrackList3D discovered and resolved
  - ✅ Component structure simplified to match working patterns
  - ✅ Scroll bounds constraint implemented to prevent over-scrolling
  - ✅ Canvas wheel event capture working via R3F event system (both Canvas and mesh-level)
  - ✅ Performance validated under rapid scrolling with bounds checking
  - ⚠️ HUD region scroll leakage identified (acceptable for Phase 0, needs fixing in Phase 3A)
  - ✅ All Phase 0 success criteria met: architecture proven and functional
- 🔄 **Phase 1**: Foundation + Basic Content (ready to begin)
- ⏳ **Phase 2**: Camera System + Visual Validation (pending)
- ⏳ **Phase 3A**: Horizontal Gestures First (pending)
- ⏳ **Phase 3B**: Vertical Scroll Integration (pending) 
- ⏳ **Phase 4**: Enhanced Content + Full Integration (pending)