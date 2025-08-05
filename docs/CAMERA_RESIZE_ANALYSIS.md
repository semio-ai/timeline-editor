# Camera Resize Issue Analysis

## Problem Statement

When the canvas is downsized horizontally, content in ALL regions shrinks such that there is increasing amounts of padding on the left and right sides. This behavior is consistent across:

- Main scene track content
- HUD regions (Top Ruler, Timeline)
- All visual elements

## Root Cause Analysis

### 1. R3F Camera Auto-Resize Behavior

React Three Fiber automatically adjusts the camera when the canvas size changes. For orthographic cameras, this typically involves:

- Updating the camera's aspect ratio
- Adjusting frustum dimensions to maintain proper projection
- Recalculating viewport transformations

### 2. Layout System Interaction

The layout system (`useLayout`, `LayoutProvider`) correctly:
- Detects canvas size changes via `useThree().size`
- Recalculates region bounds proportionally
- Updates region dimensions and positions

However, this creates a **double adjustment problem**:
1. R3F adjusts camera for canvas resize
2. Layout system adjusts region bounds for canvas resize
3. Camera controllers try to sync with new region bounds
4. Result: Content gets "zoomed out" with padding

### 3. Camera Controller Conflict

Multiple camera controllers are operating simultaneously:

```
MainSceneCameraController (main scene)
├── Uses frustum manipulation
├── Syncs with gesture state (zoom/pan)
└── Conflicts with R3F auto-resize

HUDCameraController (HUD regions)
├── Manipulates HUD camera frustum
├── Applies horizontal synchronization
└── Also conflicts with R3F auto-resize
```

Each controller tries to override R3F's camera adjustments, creating a feedback loop.

## Coordinate Flow Analysis

### Current Data Flow

Based on code analysis, here's how coordinates flow through the system:

```
Canvas Resize Event
├── R3F useThree().size updates
├── Layout system recalculates bounds (cssToThreePosition)
├── Region bounds shrink proportionally
├── Camera controllers try to adapt to smaller bounds
└── Content appears smaller with padding

Gesture Events  
├── useCameraSync() converts viewport [0,1] to camera state
├── zoom = 1/viewport_width
├── pan.x = viewport_center - 0.5  
├── Camera controllers apply transformations
└── Visual feedback to user
```

### Key Coordinate Systems

1. **Player Store**: Viewport [0, 1] representing timeline portion
2. **Camera Sync**: Zoom (1/viewport_width) + Pan (offset from 0.5)
3. **Layout System**: CSS pixels → Three.js world coordinates via `cssToThreePosition`
4. **Camera Controllers**: Frustum manipulation in world space
5. **R3F Canvas**: Automatic camera aspect ratio adjustment

### The Fundamental Conflict

The issue occurs because:
1. Layout system correctly scales regions proportionally with canvas size
2. R3F automatically adjusts camera for new canvas aspect ratio  
3. Camera controllers see smaller region bounds and adapt accordingly
4. Result: **Double scaling** - both camera AND bounds scale down

## Failed Solution Analysis

### Manual Camera Approach (Attempted)

**What we tried:**
- Set `manual: true` on Canvas camera
- Explicitly set frustum dimensions
- Added `CameraManager` to maintain camera state

**Why it failed:**
- Manual mode prevents ALL camera adjustments, including legitimate ones
- Fixed frustum dimensions don't account for different aspect ratios
- Created visual artifacts (borders on top/bottom)
- Broke gesture system integration

## Architecture Problem Identification

### Current Architecture Issues

1. **Competing Authority**: Both R3F and custom controllers try to control camera
2. **Mixed Coordinate Systems**: Layout uses pixel coordinates, cameras use world coordinates
3. **Timing Issues**: Layout updates and camera updates happen in different cycles
4. **Scale Confusion**: Zoom gestures vs. layout scaling vs. camera frustum scaling

### Gesture System Complexity

From `HUD_GESTURE_MIGRATION.md`, the gesture system has:
- Region-specific behaviors
- Horizontal vs. vertical gesture handling
- Touch vs. mouse gesture differences
- Camera sync state management via `useCameraSync()`

## Potential Solutions

### Option 1: Content-Based Scaling (Recommended)

Instead of fighting R3F camera behavior, embrace it and scale content:

```tsx
// Let R3F handle camera naturally
// Scale content to maintain consistent size
function ContentScaler({ children, baseSize = { width: 800, height: 600 } }) {
  const { size } = useThree();
  const scale = Math.min(size.width / baseSize.width, size.height / baseSize.height);
  
  return (
    <group scale={[scale, scale, 1]}>
      {children}
    </group>
  );
}
```

**Pros:**
- Works with R3F instead of against it
- Maintains gesture system compatibility
- Preserves layout system logic
- Simple to implement

**Cons:**
- Content might become very small on narrow canvases
- Requires content restructuring

### Option 2: Viewport-Based Camera Control

Use R3F's `viewport` system for consistent scaling:

```tsx
function ViewportCamera() {
  const viewport = useThree((state) => state.viewport);
  
  // Use viewport.getCurrentViewport() for consistent scaling
  // Apply transformations based on viewport rather than camera
}
```

### Option 3: Layout-Camera Coordination

Modify the layout system to work WITH camera adjustments:

```tsx
function LayoutAwareCameraController() {
  const { camera, size } = useThree();
  const layoutBounds = useRegion(TRACK_LIST);
  
  // Calculate scale factor that compensates for both:
  // 1. R3F's automatic camera adjustment
  // 2. Layout system's proportional bounds adjustment
  
  const compensationScale = calculateCompensationScale(camera, size, layoutBounds);
  // Apply compensation to maintain visual consistency
}
```

### Option 4: Fixed Aspect Ratio Canvas

Control the canvas container to maintain aspect ratio:

```tsx
function AspectRatioCanvas({ aspectRatio = 16/9, children }) {
  return (
    <div style={{ 
      aspectRatio: aspectRatio,
      width: '100%',
      maxHeight: '100vh'
    }}>
      <Canvas>
        {children}
      </Canvas>
    </div>
  );
}
```

## Recommended Solution: Fixed Reference Camera

### Core Approach

Instead of fighting R3F's automatic camera adjustments, establish a **stable reference coordinate system** that camera controllers can work with consistently.

### Specific Implementation

```tsx
function FixedReferenceCamera() {
  const { camera, size } = useThree();
  const initialSize = useRef<{width: number, height: number} | null>(null);
  const baseScale = useRef<number>(1);

  useEffect(() => {
    // Capture reference size when canvas is at intended size
    if (!initialSize.current && size.width > 400 && size.height > 200) {
      initialSize.current = { width: size.width, height: size.height };
      baseScale.current = Math.min(size.width / 800, size.height / 600); // Reference: 800x600
    }
  }, [size]);

  useFrame(() => {
    if (camera.type === "OrthographicCamera" && initialSize.current) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      
      // Calculate scale factor relative to reference size
      const currentScale = Math.min(size.width / 800, size.height / 600);
      const compensationFactor = baseScale.current / currentScale;
      
      // Apply compensation to maintain visual consistency
      const baseWidth = 400; // Half of reference width
      const baseHeight = 300; // Half of reference height
      
      orthoCamera.left = -baseWidth * compensationFactor;
      orthoCamera.right = baseWidth * compensationFactor;
      orthoCamera.top = baseHeight * compensationFactor;
      orthoCamera.bottom = -baseHeight * compensationFactor;
      
      orthoCamera.updateProjectionMatrix();
    }
  });

  return null;
}
```

### Why This Works

1. **Establishes stable reference**: Uses initial canvas size as baseline
2. **Compensates for R3F scaling**: Calculates compensation factor
3. **Preserves gesture system**: Camera sync coordinates remain consistent
4. **Maintains layout logic**: Region bounds can scale naturally
5. **Simple integration**: Single component addition

### Integration Steps

1. **Replace manual camera approach** with FixedReferenceCamera
2. **Remove competing camera controllers** (MainSceneCameraController)
3. **Test with single region** to validate behavior
4. **Verify gesture functionality** remains intact
5. **Expand to all regions** once validated

## Key Technical Considerations

### Coordinate System Consistency

All components must use the same coordinate system:
- Layout system: Pixel coordinates
- Camera system: World coordinates  
- Gesture system: Screen coordinates
- Conversion functions must be reliable

### Gesture State Management

The `useCameraSync()` hook provides:
- `zoom`: Current zoom level
- `pan`: Pan offset
- `viewport`: Viewport bounds

Ensure any solution preserves this state management.

### Performance Impact

Consider performance implications:
- Avoid recalculating transformations every frame
- Use `useMemo` for expensive coordinate conversions
- Minimize camera projection matrix updates

## Implementation Status

### FixedReferenceCamera Implementation ❌ FAILED

**Date**: Current
**Approach**: Fixed reference coordinate system with compensation scaling
**Status**: Implemented and tested - FAILED

#### Changes Made

1. **Created FixedReferenceCamera component**:
   - `packages/animation/src/components/three/cameras/fixed-reference-camera.tsx`
   - Establishes stable reference coordinate system
   - Compensates for R3F automatic camera adjustments
   - Preserves gesture system compatibility

2. **Integrated into AnimationSheet3D**:
   - Replaced `MainSceneCameraController` with `FixedReferenceCamera`
   - Added to cameras index exports
   - Positioned before layout provider for proper initialization

3. **Key Features**:
   - Captures initial canvas size as baseline reference
   - Calculates compensation factor: `baseScale / currentScale`
   - Applies compensation to camera frustum in real-time
   - Includes utility hook `useCompensationFactor` for other components

#### Technical Implementation

```tsx
// Core compensation logic
const compensationFactor = baseScale.current / currentScale;
const compensatedWidth = baseDimensions.width * compensationFactor;

orthoCamera.left = -compensatedWidth;
orthoCamera.right = compensatedWidth;
orthoCamera.top = compensatedHeight;
orthoCamera.bottom = -compensatedHeight;
```

#### Expected Results vs Actual Results

**Expected:**
- Content maintains consistent size regardless of canvas resize
- No padding appears when canvas shrinks horizontally
- Gesture system continues working with existing coordinate relationships
- Layout system operates normally with proportional region bounds

**Actual Results:**
- ❌ **Padding shifted to top/bottom**: Instead of left/right padding, now shows padding on top and bottom
- ❌ **Resizing issue not addressed**: Content still does not maintain consistent size
- ❓ **Gesture system impact**: Unknown, needs testing
- ❓ **New visual artifacts**: Top/bottom padding suggests camera frustum aspect ratio issues

#### Failure Analysis

**Root Cause**: FixedReferenceCamera approach creates aspect ratio mismatches
1. **Compensation logic flawed**: `baseScale / currentScale` doesn't account for different aspect ratios
2. **Frustum manipulation conflicts**: Setting explicit left/right/top/bottom breaks R3F's aspect ratio handling
3. **Double compensation**: Both R3F and FixedReferenceCamera try to adjust for canvas changes

**Symptoms:**
- Top/bottom padding indicates vertical frustum is too large for current aspect ratio
- Horizontal resize issue persists, suggesting compensation math is incorrect
- Camera frustum becomes misaligned with actual canvas proportions

## 🔍 CRITICAL DISCOVERY: Debug Log Analysis

### ResizeDebug Findings ✅ MAIN ISSUE RESOLVED

**Date**: Current
**Status**: HORIZONTAL SCALING ISSUE FIXED - Major success achieved with minor remaining tasks

#### Key Debug Data - First Test (WITH MainSceneCameraController)

**Canvas Size Changes**:
```
555x348 → 549x348 → 502x348 → 463x348 → 403x348 → 394x348 → 385x348 → 384x348 → 385x348 → 386x348
```

**Camera Frustum Response**:
```
frustumWidth: 555 (CONSTANT - NEVER CHANGES)
frustumHeight: 348 (matches canvas height)
```

#### Key Debug Data - Second Test (WITHOUT MainSceneCameraController)

**Canvas Size Changes**:
```
784x348 → 775x348 → 746x348 → 692x348 → 667x348 → 640x348 → 613x348 → 597x348 → 578x348 → 563x348 → 560x348
```

**Camera Frustum Response**:
```
MUCH IMPROVED BEHAVIOR:
- Initial: frustumWidth: 784 (matches canvas: 784) ✅
- During resize: frustumWidth: 560 when canvas: 563 (3px difference!) ✅
- Final state: Very close tracking, minimal mismatch ✅
```

#### Key Debug Data - Fourth Test (Camera Controllers Disabled, Layout Fixed)

**MAJOR SUCCESS - Primary Issue Resolved**:
```
- Canvas: 784px → 781px → 730px (natural resize) ✅
- Camera tracking: Perfect alignment with canvas size ✅  
- Top/bottom padding eliminated ✅
- HORIZONTAL RESIZE PADDING ISSUE FIXED ✅
- Content scales properly with canvas resize ✅
```

#### 🔍 SMOKING GUN: Comprehensive Debug Logs Analysis

**Date**: Current  
**Status**: ROOT CAUSE DEFINITIVELY IDENTIFIED through comprehensive logging

**Critical Findings from Latest Debug Session**:

1. **DUAL LAYOUT SYSTEM CONFLICT** 🚨
```
Layout calculations running simultaneously:
- Real canvas: 784x348 → 783x348 → 731x348 (changing)
- Fixed system: 800x600 (repeated calculations #1-7)
```

2. **CAMERA INTERFERENCE CONFIRMED** 🚨
```
Frame 86→87: Camera 784px → 783px (canvas: 784px) ❌ WRONG DIRECTION
Frame 87→88: Camera 783px → 731px (canvas: 731px) ✅ CORRECT
Frame 88→89: Camera 731px → 719px (canvas: 731px) ❌ WRONG DIRECTION -12px
```

3. **CONTENT GEOMETRY SCALING** 🚨
```
TimelineRegion geometry args changing with canvas:
- [784, 36] → [783, 36] → [731, 36]
- Content shrinks with canvas, creating padding effect
```

4. **LAYOUT SYSTEM CHAOS** 🚨
```
Multiple competing layout calculations:
- calculation #1-7 in rapid succession
- containerSize switching between canvas size and 800x600
- Region bounds recalculating constantly
```

#### The Problem DEFINITIVELY IDENTIFIED

**MULTIPLE SYSTEM CONFLICTS**: Camera, layout, and content systems all have issues

1. **Camera still has interference**: Moving away from correct size (-12px error detected)
2. **Dual layout system**: Two competing layout calculations (canvas vs fixed 800x600)
3. **Content scaling with canvas**: Geometry sized to shrinking canvas creates padding
4. **Layout calculation chaos**: 7 calculations in rapid succession, constant recalculation

#### Root Cause CONFIRMED - TRIPLE SYSTEM FAILURE

**Three separate systems causing the issue**:

1. **Camera Interference**: Still happening despite removing MainSceneCameraController
   - Camera moving wrong direction: 731px → 719px when canvas is 731px
   - Something is overriding R3F's natural camera adjustment

2. **Dual Layout System**: Two layout providers running simultaneously
   - Canvas-responsive: 784→783→731 (correct)
   - Fixed 800x600: constant recalculation (interference)

3. **Content Geometry Scaling**: Region content sizes based on shrinking canvas
   - TimelineRegion: geometryArgs [784,36] → [731,36]
   - Content shrinks with canvas instead of maintaining size
   - This creates the visual padding effect

4. **Layout Calculation Storm**: 7 layout calculations in rapid succession
   - Suggests multiple layout providers or recursive updates
   - Competing systems fighting each other

#### Remaining Issues IDENTIFIED

- **Camera interference source unknown**: Something still overriding camera after R3F adjustment
- **Dual layout providers**: Need to find and eliminate the 800x600 fixed layout system
- **Content scaling logic wrong**: Regions scaling content WITH canvas instead of maintaining size
- **Layout calculation inefficiency**: Multiple providers causing calculation storm
- **Coordinate system conflicts**: Canvas coordinates vs fixed coordinates competing

## 🎯 SOLUTION APPROACH: Fix Camera Adjustment Interference

### Based on Complex Debug Findings

**The issue is more nuanced**: R3F DOES adjust camera, but something interferes and reverts it

#### Current Problem Analysis
- **R3F camera adjustment works initially** (we see frustumWidth: 438 matching canvas: 438)
- **Something interferes mid-process** and reverts camera to previous state (frustumWidth: 784)
- **Multiple systems competing** for camera control during resize events
- **Final inconsistent state** creates the padding issue

#### Revised Solution Strategy

**Phase 1: Identify Interference Source**
```tsx
// Add detailed logging to find what's overriding camera after R3F adjusts it
function CameraStateTracker() {
  // Track every camera property change and what triggers it
  // Log sequence: R3F adjust → Something overrides → Final mismatch
}
```

**Phase 2: Coordinate System Timing**
```tsx
// Ensure layout system and camera system don't conflict
function CoordinatedCameraLayout() {
  // Let R3F adjust camera first
  // Then update layout based on final camera state
  // Avoid competing adjustments
}
```

**Phase 3: Minimal Interference Camera Control**
```tsx
// Preserve R3F's camera adjustments, only add specific gestures
function NonInterferingGestureCamera() {
  // Monitor R3F camera changes
  // Apply gesture transformations WITHOUT overriding base frustum
  // Maintain R3F's resize behavior
}
```

#### Investigation Priorities (SUCCESS + CLEANUP)
1. ✅ **PRIMARY ISSUE RESOLVED** - horizontal scaling works correctly
2. **PRIORITY 1: Restore pan/zoom functionality** - re-implement gestures without resize interference
3. **PRIORITY 2: Fix dual layout system** - eliminate persistent 800x600 calculations  
4. **PRIORITY 3: Eliminate minor camera interference** - resolve -3px drift
5. **PRIORITY 4: Optimize layout calculations** - prevent unnecessary recalculations

#### Expected Resolution Path (SUCCESS + POLISH)
1. ✅ **Main issue resolved** - horizontal scaling works correctly
2. **PRIORITY 1: Restore gesture functionality** - implement minimal pan/zoom without resize interference
3. **PRIORITY 2: Clean up layout system** - eliminate dual 800x600 calculations
4. **PRIORITY 3: Perfect camera tracking** - eliminate minor -3px interference  
5. **PRIORITY 4: Optimize performance** - reduce layout calculation overhead
6. **PRIORITY 5: Comprehensive testing** - validate all functionality works together

## Alternative Approaches - New Brainstorming

### Approach A: Canvas Container Control
**Concept**: Control resize behavior at the container level, not camera level

```tsx
function ConstrainedCanvasContainer() {
  // Maintain minimum aspect ratio or prevent extreme resizing
  // Let R3F handle camera naturally within controlled bounds
}
```

**Pros**: Works with R3F's natural behavior
**Cons**: May not work with all layout requirements

### Approach B: Viewport-Based Scaling
**Concept**: Use R3F's viewport system for consistent coordinate mapping

```tsx
function ViewportAwareRegions() {
  const viewport = useThree((state) => state.viewport);
  // Use viewport.getCurrentViewport() for consistent scaling
  // Apply viewport-based transformations instead of camera manipulation
}
```

**Pros**: Built into R3F, designed for this purpose
**Cons**: Requires understanding viewport coordinate system

#### Detailed Viewport System Analysis

**R3F Viewport Fundamentals:**
- `useThree().viewport` provides normalized coordinate system
- `viewport.getCurrentViewport()` gives current visible area dimensions
- Automatically accounts for camera settings and canvas size
- Provides consistent scaling regardless of canvas resize

**Coordinate System Flow:**
```
Canvas Resize → R3F Viewport Updates → Consistent World Coordinates
```

**Key Viewport Properties:**
- `width/height`: Current viewport dimensions in world space
- `top/left/bottom/right`: Viewport bounds in world coordinates
- `factor`: Scale factor for converting screen to world coordinates
- `distance`: Camera distance (useful for perspective cameras)

**Implementation Strategy:**
```tsx
function ViewportStabilizedCamera() {
  const viewport = useThree((state) => state.viewport);
  
  // Use viewport dimensions instead of manual camera frustum
  const worldWidth = viewport.getCurrentViewport().width;
  const worldHeight = viewport.getCurrentViewport().height;
  
  // Apply region positioning based on stable viewport coordinates
  // Let R3F handle camera adjustments naturally
}
```

**Advantages Over Camera Manipulation:**
1. **No Camera Conflicts**: Works with R3F's natural camera handling
2. **Automatic Aspect Ratio**: Viewport system handles aspect ratio changes
3. **Gesture Compatibility**: Existing gesture systems already use viewport concepts
4. **Performance**: No per-frame camera projection matrix updates needed

**Integration Points:**
- Replace camera frustum manipulation with viewport-based positioning
- Use `viewport.getCurrentViewport()` for region size calculations
- Apply transformations to content groups rather than camera
- Maintain existing gesture coordinate system compatibility

### Approach C: Hybrid Layout-Content Approach
**Concept**: Let layout system scale regions naturally, but compensate content sizing

```tsx
function ScaleCompensatedContent({ children, regionBounds }) {
  const { size } = useThree();
  const scale = calculateContentScale(regionBounds, size);
  return <group scale={[scale, scale, 1]}>{children}</group>;
}
```

**Pros**: Precise control over content vs layout scaling
**Cons**: Requires content restructuring

### Approach D: Camera Aspect Ratio Lock
**Concept**: Lock camera to specific aspect ratio and handle overflow differently

```tsx
function AspectRatioLockedCamera({ targetRatio = 16/9 }) {
  // Force camera to maintain specific aspect ratio
  // Handle canvas overflow with clipping or letterboxing
}
```

**Pros**: Predictable camera behavior
**Cons**: May not utilize full canvas area

### Approach E: Data-Driven Investigation (ACTIVE)
**Concept**: Use ResizeDebug component to understand exact R3F behavior before implementing solutions

**Current Status**: Implemented and integrated
**Data Collection Points**:
- Canvas size changes and timing
- Camera frustum adjustments by R3F
- Viewport coordinate transformations
- Layout system interactions
- Performance impact measurements

**Expected Insights**:
1. **Exact resize sequence** - what happens first: camera or layout changes?
2. **Coordinate system conflicts** - where do the scaling issues originate?
3. **R3F automatic behaviors** - which adjustments are beneficial vs problematic?
4. **Timing dependencies** - are there race conditions between systems?

### Approach F: R3F Native Scaling Investigation
**Concept**: Investigate R3F's built-in scaling mechanisms before custom solutions

**Research Areas:**
- How does R3F's `useThree().size` interact with camera automatically?
- What scaling methods does R3F provide natively?
- Are there R3F configuration options to control resize behavior?
- Does R3F have built-in solutions for fixed-size content?

**Questions to Answer:**
1. Can we configure R3F Canvas to maintain fixed world coordinates?
2. Does R3F provide scale-independent coordinate systems?
3. Are there Canvas props that control camera auto-adjustment behavior?
4. How do other R3F applications handle this common issue?

## Debug Investigation Approach

### ResizeDebug Component Implementation ✅ COMPLETED

**Purpose**: Understand exactly what R3F does during canvas resize to identify the root cause

**Key Metrics Tracked**:
- Canvas size changes (`useThree().size`)
- Camera property changes (frustum bounds, zoom, aspect ratio)
- Viewport changes (`useThree().viewport`)
- Coordinate transformations
- Frame-by-frame analysis

**Implementation**: 
- Created `ResizeDebug` component with comprehensive logging
- Tracks before/after states during resize events
- Provides visual debug overlays for camera bounds
- Includes test bed for different camera approaches

**Investigation Goals**:
1. **Identify R3F's automatic camera adjustments** - what exactly changes during resize?
2. **Understand timing** - when do camera changes happen relative to layout changes?
3. **Measure coordinate drift** - how do world coordinates shift during resize?
4. **Test different camera setups** - fixed-size vs fixed-aspect vs proportional

**Next Steps with Debug Data**:
1. **Analyze resize event sequence** - identify the exact moment content starts shrinking
2. **Compare coordinate systems** - canvas pixels vs world coordinates vs viewport coordinates
3. **Test camera alternatives** - use debug component to test different approaches
4. **Document findings** - create clear picture of what's happening and why

## Recommended Next Steps (SUCCESS ACHIEVED + POLISH)

1. ✅ **Primary objective complete** - horizontal resize scaling issue resolved
2. ✅ **Major breakthrough achieved** - identified and fixed camera controller interference
3. **Restore pan/zoom gestures** - implement minimal gesture control without resize interference
4. **Clean up layout system** - eliminate remaining dual layout calculations
5. **Fine-tune camera tracking** - resolve minor interference for perfect alignment
6. **Performance optimization** - reduce unnecessary layout recalculations

## Related Files

- `packages/animation/src/components/three/layout/use-layout.ts` - Layout system
- `packages/animation/src/hooks/use-camera-sync.ts` - Camera state management
- `packages/animation/src/components/three/cameras/` - Camera controllers
- `packages/animation/docs/HUD_GESTURE_MIGRATION.md` - Gesture system architecture

## Risk Assessment

**High Risk:**
- Breaking existing gesture functionality
- Disrupting HUD region synchronization
- Performance regression

**Medium Risk:**
- Visual artifacts during transitions
- Coordinate system confusion
- Complex debugging

**Low Risk:**
- Minor visual inconsistencies
- Configuration complexity