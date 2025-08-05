# Gesture System Architecture Analysis

## Executive Summary

The current gesture system suffers from fundamental architectural conflicts between React state management patterns and Three.js native approaches. Since we're undertaking a fundamental reworking of the gesture system, this analysis recommends a clean Three.js controller architecture that prioritizes optimal organization, performance, and maintainability over backwards compatibility. The recommended approach leverages HUD isolation, player store authority, and native Three.js patterns for a robust, scalable solution.

## Current Architecture Problems

### 1. State Management Conflicts

**React-First Approach Issues:**
```typescript
// Current problematic pattern
const { zoom, pan, viewport } = useCameraSync();           // React state
useCanvasZoomGestures(canvasRef, { bounds, enabled });     // DOM events → React state
useFrame(() => { camera.frustum = f(zoom, pan) });        // React state → Three.js
```

**Problems:**
- **Async state propagation**: React batching delays state updates during rapid gesture events
- **Stale closures**: useFrame callbacks capture stale state during gesture handling
- **Multiple render cycles**: State changes trigger re-renders during performance-critical gesture events
- **State synchronization lag**: Player store updates don't immediately reflect in camera sync

### 2. Multiple Authority Conflicts

**Competing Systems:**
1. **R3F automatic camera adjustment** (canvas resize)
2. **Custom camera controllers** (manual frustum manipulation)
3. **useGesture system** (React state updates)
4. **Layout system** (region bounds calculation)

**Feedback Loop Pattern:**
```
Gesture Event → Player Store → useCameraSync() → useFrame() → Camera Update
     ↑                                                              ↓
     ←←←←←←← Component Re-render ←←←←← React State Change ←←←←←←←←←←←
```

This creates timing conflicts and visual artifacts during gesture interactions.

### 3. Event System Fragmentation

**Current Event Flow:**
- Touch/pointer events → useGesture library
- Canvas events → R3F event system  
- Wheel events → DOM event handlers
- State changes → React rendering system

**Issues:**
- No unified event coordinate system
- Conflicting event prevention/bubbling
- Complex coordinate transformations between systems
- Region-based event isolation not handled at source

## Technical Comparison: useGesture vs Three.js Controllers

### Current useGesture Implementation Analysis

**Event Flow:**
```typescript
// Current gesture system (problematic)
useGesture({
  onPinch: ({ offset: [scale], event }) => {
    // 1. Event captured by useGesture library
    // 2. Transformed to React state update
    const newViewport = calculateViewport(scale);
    
    // 3. Player store update (async)
    updatePlayerStore(newViewport);
    
    // 4. useCameraSync reads updated state (potential stale data)
    const { zoom, pan } = useCameraSync();
    
    // 5. useFrame applies camera changes (next frame)
    useFrame(({ camera }) => {
      camera.left = /* calculation based on zoom/pan */;
      camera.updateProjectionMatrix();
    });
  }
}, { domTarget: canvasRef.current });
```

**Issues Identified:**
1. **5+ step indirection** between gesture and camera update
2. **State staleness** during rapid gesture events
3. **React render cycles** triggered during performance-critical interactions
4. **Coordinate system jumps** between DOM events, React state, and Three.js world space
5. **No built-in event capture** - relies on external DOM manipulation

**Performance Characteristics:**
- **Latency**: 16-33ms (1-2 frames) from gesture to visual update
- **CPU overhead**: React state updates, component re-renders, virtual DOM diffing
- **Memory pressure**: State updates create new objects, trigger garbage collection
- **Frame drops**: Possible during rapid pinch gestures on lower-end devices

### Three.js Controller Implementation Analysis

**Event Flow:**
```typescript
// Three.js controller approach (efficient)
class PanZoomControls extends EventDispatcher {
  private onPointerMove = (event: PointerEvent) => {
    // 1. Event captured directly by controller
    this.updatePointer(event);
    
    // 2. Immediate gesture calculation
    if (this.state === STATE.ZOOM) {
      const zoomFactor = this.calculateZoomFactor();
      
      // 3. Direct camera manipulation (same frame)
      this.zoomCameraHorizontal(zoomFactor, center);
      
      // 4. Optional: Notify React if needed
      this.dispatchEvent(_changeEvent);
    }
  };
}
```

**Advantages:**
1. **Direct manipulation** - no intermediate state layers
2. **Same-frame updates** - immediate visual feedback
3. **Native event capture** - proper pointer capture/release
4. **Unified coordinate system** - all calculations in consistent space
5. **Standard Three.js patterns** - follows established conventions

**Performance Characteristics:**
- **Latency**: <1ms from gesture to camera update (same frame)
- **CPU overhead**: Minimal - direct camera property updates
- **Memory efficiency**: No intermediate state objects created
- **Smooth interactions**: 60fps maintained even on lower-end devices

### Coordinate System Comparison

**Current useGesture Approach:**
```typescript
// Multiple coordinate transformations
DOM Event (screen px) 
  → useGesture (normalized scale)
  → Player Store (viewport [0,1])
  → useCameraSync (zoom factor + pan offset)
  → useFrame (Three.js world coordinates)
  → Camera Frustum (clip space)
```

**Three.js Controller Approach:**
```typescript
// Direct coordinate handling
DOM Event (screen px)
  → Controller (event.clientX/Y)
  → Canvas relative coordinates (getBoundingClientRect)
  → Camera world coordinates (direct frustum calculation)
```

### Regional Event Isolation Comparison

**Current Approach (Problematic):**
```typescript
// Region detection in React, events handled globally
const bounds = useRegion(TRACK_LIST);
useGesture({
  onPinch: (event) => {
    // No knowledge of region boundaries
    // All events processed regardless of location
    updateGlobalCameraState(event);
  }
});
```

**Controller Approach (Clean):**
```typescript
// Region awareness built into controller
class RegionalPanZoomControls extends PanZoomControls {
  private onPointerDown = (event: PointerEvent) => {
    // Early rejection for out-of-region events
    if (!this.isEventInRegion(event)) return;
    
    // Process only relevant events
    super.onPointerDown(event);
  };
}
```

### State Management Comparison

**Current useGesture Pattern:**
```typescript
// State scattered across multiple systems
const playerStore = useAnimationStore(); // Global viewport state
const { zoom, pan } = useCameraSync();   // Derived camera state  
const bounds = useRegion(regionId);      // Layout state
const gestureRef = useGesture(handlers); // Gesture state

// Complex synchronization required
useEffect(() => {
  // Sync gesture state with player store
  // Sync player store with camera
  // Sync camera with layout bounds
}, [zoom, pan, bounds, viewport]);
```

**Controller Pattern:**
```typescript
// Single source of truth
class PanZoomControls {
  // Controller owns authoritative state
  private camera: OrthographicCamera;
  private regionBounds: RegionBounds;
  
  // External systems read from controller
  getFrustum() { return this.camera.frustum; }
  getViewport() { return this.calculateViewport(); }
  
  // Optional: Bridge to React when needed
  addEventListener('change', () => {
    // Update external systems only when necessary
  });
}
```

### Error Handling & Debugging Comparison

**Current System Issues:**
```typescript
// Debugging requires tracing through multiple systems
console.log('Gesture event:', event);           // useGesture
console.log('Player store:', store.viewport);   // Zustand
console.log('Camera sync:', { zoom, pan });     // useCameraSync  
console.log('Camera state:', camera.frustum);   // useFrame
// State can be inconsistent between systems
```

**Controller System Benefits:**
```typescript
// Single source of truth for debugging
console.log('Controller state:', {
  camera: this.camera.frustum,
  pointers: this.pointers.length,
  state: this.state,
  enabled: this.enabled
});
// Always consistent, authoritative state
```

## HUD Isolation and Controller Independence

### Drei HUD Architecture Benefits

The drei HUD system provides complete isolation between different UI layers, which significantly strengthens the controller approach:

**HUD Independence:**
```typescript
// Each HUD can have its own controller without interference
<Canvas>
  {/* Main scene with track controller */}
  <RegionalPanZoomControls camera={mainCamera} region={trackBounds} />
  
  {/* Timeline HUD with its own controller */}
  <Hud renderPriority={1}>
    <OrthographicCamera makeDefault />
    <RegionalPanZoomControls camera={hudCamera} region={timelineBounds} />
    <TimelineContent />
  </Hud>
  
  {/* Minimap HUD with independent controller */}
  <Hud renderPriority={2}>
    <OrthographicCamera makeDefault />
    <MinimapPanZoomControls camera={minimapCamera} />
    <MinimapContent />
  </Hud>
</Canvas>
```

**Key Benefits:**
1. **Complete Scene Isolation**: Each HUD is a separate React portal with its own scene
2. **Independent Camera Systems**: No camera conflicts between main scene and HUDs
3. **Separate Event Handling**: Each controller operates in its own isolated context
4. **Clear Render Hierarchy**: renderPriority ensures predictable rendering order
5. **Regional Autonomy**: Each HUD can implement different gesture behaviors

This architecture eliminates the camera authority conflicts we identified, as each scene has clear ownership of its camera.

## Player Store Authority Pattern

### Revised Synchronization Approach

Based on the clarification that **the player store should remain the single source of truth for viewport state**, the controller architecture needs to be modified to work as an implementation detail rather than replacing the store authority.

**Key Principle: Store Authority + Controller Implementation**
```typescript
// Player store maintains authoritative viewport state
interface PlayerState {
  viewport: {
    start: number;  // [0, 1] representing timeline portion
    end: number;    // [0, 1] representing timeline portion
    zoom: number;   // Derived from viewport width
    pan: number;    // Derived from viewport center
  };
  // ... other player state
}

// Controller implements viewport changes via store updates
class RegionalPanZoomControls extends PanZoomControls {
  // Store reference for imperative access
  private playerStore: PlayerStore;
  
  constructor(camera: OrthographicCamera, domElement: HTMLElement, store: PlayerStore) {
    super(camera, domElement);
    this.playerStore = store;
    this.subscribeToStore();
  }
  
  // Subscribe to authoritative viewport changes
  private subscribeToStore() {
    this.unsubscribe = this.playerStore.subscribe(
      (state) => state.viewport,
      (viewport) => {
        // Apply store state to camera (one-way: store → camera)
        this.updateCameraFromViewport(viewport);
      }
    );
  }
  
  // Gesture handling updates store, which triggers camera update
  private handleGestureEnd() {
    const newViewport = this.calculateViewportFromCamera();
    
    // Update authoritative state
    this.playerStore.getState().updateViewport(newViewport);
    
    // Camera update happens via subscription (store → camera)
    // This ensures consistency with rest of application
  }
}
```

### Benefits of Store Authority + Controller Implementation

**1. Maintains Single Source of Truth**
- Player store remains authoritative for all viewport state
- Controllers are implementation details for gesture handling
- React components continue to read from store as before
- No breaking changes to existing state management

**2. Imperative Store Access Pattern**
```typescript
// Access store outside React context using Zustand's subscribe
export class ViewportController {
  private unsubscribe: () => void;
  
  constructor(private store: PlayerStore) {
    // Direct store subscription without React hooks
    this.unsubscribe = store.subscribe(
      (state) => ({ viewport: state.viewport, playing: state.playing }),
      ({ viewport, playing }) => {
        if (!playing) {
          this.syncCameraToViewport(viewport);
        }
      }
    );
  }
  
  // Gesture updates go through store
  updateViewport(newViewport: Viewport) {
    this.store.getState().updateViewport(newViewport);
    // Camera update happens via subscription
  }
  
  dispose() {
    this.unsubscribe();
  }
}
```

**3. Gesture Responsiveness with Store Consistency**
```typescript
class RegionalPanZoomControls extends PanZoomControls {
  private optimisticCamera: OrthographicCamera;
  private pendingStoreUpdate: Viewport | null = null;
  
  // Immediate visual feedback during gestures
  private handleGestureMove(gestureData: GestureData) {
    // Apply immediately to camera for responsive feel
    this.updateCameraDirectly(gestureData);
    
    // Debounce store updates during active gestures
    this.pendingStoreUpdate = this.calculateViewportFromCamera();
  }
  
  // Commit to store when gesture ends
  private handleGestureEnd() {
    if (this.pendingStoreUpdate) {
      this.playerStore.getState().updateViewport(this.pendingStoreUpdate);
      this.pendingStoreUpdate = null;
    }
  }
  
  // Reconcile with store state when needed
  private reconcileWithStore() {
    const storeViewport = this.playerStore.getState().viewport;
    const cameraViewport = this.calculateViewportFromCamera();
    
    if (!this.isGestureActive && !this.viewportsEqual(storeViewport, cameraViewport)) {
      this.updateCameraFromViewport(storeViewport);
    }
  }
}
```

### HUD Synchronization with Store Authority

**Timeline HUD Synchronization:**
```typescript
// Timeline HUD follows main viewport state
const TimelineHUD = () => {
  const trackControllerRef = useRef<RegionalPanZoomControls>();
  const timelineControllerRef = useRef<RegionalPanZoomControls>();
  
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault />
      <RegionalPanZoomControls
        ref={timelineControllerRef}
        syncWithStore={playerStore}
        syncAxes="x" // Only horizontal sync
        onViewportChange={(viewport) => {
          // Timeline gestures update same store state
          // This automatically syncs with main scene via store subscription
          playerStore.getState().updateViewport(viewport);
        }}
      />
      <TimelineContent />
    </Hud>
  );
};
```

### Addressing Previous Synchronization Issues

**Problem 1: State Staleness**
```typescript
// OLD: React hook chain with stale closures
const { zoom, pan } = useCameraSync();  // Potentially stale
useFrame(() => {
  camera.left = calculateLeft(zoom, pan);  // Uses stale values
});

// NEW: Direct store subscription
class Controller {
  constructor(store: PlayerStore) {
    store.subscribe(
      (state) => state.viewport,
      (viewport) => {
        // Always fresh viewport data
        this.updateCamera(viewport);
      }
    );
  }
}
```

**Problem 2: Multiple Authority Conflicts**
```typescript
// OLD: Multiple systems updating camera
useGesture() → PlayerStore → useCameraSync() → useFrame() → Camera
     ↑                                                        ↓
     ←←←←←← Component Re-render ←←←←← React State Change ←←←←←

// NEW: Clear authority chain
Gesture → Controller → PlayerStore → Controller.subscription → Camera
                         ↑                                      ↓
                         ←←←←←←← Single source of truth ←←←←←←←
```

**Problem 3: Regional Event Isolation**
```typescript
// Each HUD controller subscribes to same store but filters regionally
class RegionalPanZoomControls {
  private handlePointerDown = (event: PointerEvent) => {
    // Regional filtering at event source
    if (!this.isEventInRegion(event)) return;
    
    // Update shared store state
    this.processGesture(event);
  };
  
  // Store subscription updates camera
  private syncWithStore(viewport: Viewport) {
    // Each controller applies store state to its own camera
    this.updateCameraFromViewport(viewport);
  }
}
```

### Implementation Benefits of Store Authority Pattern

**1. Backwards Compatibility**
- Existing React components continue working unchanged
- Store structure remains the same
- No breaking changes to current state management

**2. Performance Optimization**
- Controllers provide immediate visual feedback during gestures
- Store updates can be debounced for performance
- React re-renders minimized during gesture interactions

**3. Debugging Clarity**
- Player store remains single source of truth for debugging
- Controller state is derived and can be regenerated from store
- Clear data flow: Store → Controller → Camera

**4. Feature Completeness**
- Timeline synchronization works through shared store state
- Minimap can show overview of same viewport state
- Playback integration maintains store authority for seek operations

## Three.js Controller Approach Analysis

### Advantages of Native Controllers</text>

<old_text line=565>
### Controller-Based Region Solution

**Unified Region-Aware Controller:**

**1. Direct Camera Manipulation**
```typescript
// Three.js native approach (from pan-zoom-controls-impl.ts)
private zoomCameraHorizontal(zoomFactor: number, center: Vector2) {
  const camera = this.object;
  const currentWidth = camera.right - camera.left;
  const newWidth = Math.max(minWidth, Math.min(maxWidth, currentWidth / zoomFactor));
  
  // Direct frustum manipulation - no React state involved
  camera.left = newCenterX - newHalfWidth;
  camera.right = newCenterX + newHalfWidth;
  camera.updateProjectionMatrix();
}
```

**Benefits:**
- **Immediate response**: No React render cycles during gestures
- **Consistent state**: Camera state is always authoritative
- **Performance**: No state synchronization overhead
- **Predictable behavior**: Direct cause-and-effect relationship

**2. Event System Integration**
```typescript
// Unified event handling in controller
private onPointerDown = (event: PointerEvent) => {
  // Single source of truth for all pointer events
  this.addPointer(event);
  this.domElement?.setPointerCapture(event.pointerId);
}

private onMouseWheel = (event: WheelEvent) => {
  // Direct gesture → camera transformation
  if ((event.ctrlKey || event.metaKey) && this.enableZoom) {
    this.zoomCameraHorizontal(zoomFactor, center);
  }
}
```

**Benefits:**
- **Unified coordinate system**: All events handled in same context
- **Proper event capture**: Native DOM event capture/release
- **Region awareness**: Can be implemented at controller level
- **Consistent behavior**: Same event handling patterns as other Three.js controls

**3. State Authority**
```typescript
// Controller as single source of truth
class PanZoomControls extends EventDispatcher {
  getFrustum() {
    return {
      left: this.object.left,
      right: this.object.right,
      top: this.object.top,
      bottom: this.object.bottom,
    };
  }
}
```

**Benefits:**
- **Single authority**: Controller owns camera state
- **React integration**: Expose state via events when needed
- **Debugging clarity**: Clear ownership of camera properties
- **No state conflicts**: React state follows controller, not vice versa

## Regional Gesture Isolation

### Current Region Detection Issues

**Problem Pattern:**
```typescript
// Regions detected in React components, events handled elsewhere
const bounds = useRegion(TRACK_LIST);
// But gesture events are handled globally by useGesture
```

**Issues:**
- Gesture events don't know about regions
- Region bounds calculated in React, used in DOM events
- No prevention of gesture leakage between regions

### Controller-Based Region Solution

**Unified Region-Aware Controller:**
```typescript
class RegionalPanZoomControls extends PanZoomControls {
  constructor(camera, domElement, regionBounds) {
    super(camera, domElement);
    this.regionBounds = regionBounds;
  }

  private isEventInRegion(event: PointerEvent): boolean {
    const rect = this.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    return this.regionBounds.contains(x, y);
  }

  private onPointerDown = (event: PointerEvent) => {
    // Regional isolation at event source
    if (!this.isEventInRegion(event)) return;
    
    super.onPointerDown(event);
  }
}
```

**Benefits:**
- **Event isolation**: Gestures only apply within intended regions
- **Coordinate consistency**: Region bounds and event coordinates in same system
- **Performance**: No need for complex React-based region detection
- **Maintainability**: Clear ownership of regional behavior

## Implementation Guide: Regional Pan-Zoom Controllers

### Step 1: Extend Base Controller for Regional Awareness

```typescript
// regional-pan-zoom-controls.ts
import { PanZoomControls } from './pan-zoom-controls-impl';
import { OrthographicCamera, Vector2 } from 'three';

export interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  contains(clientX: number, clientY: number): boolean;
}

export class RegionalPanZoomControls extends PanZoomControls {
  private regionBounds: RegionBounds | null = null;
  private syncControllers: Set<RegionalPanZoomControls> = new Set();
  private syncAxes: 'x' | 'y' | 'xy' = 'x';

  constructor(camera: OrthographicCamera, domElement?: HTMLElement) {
    super(camera, domElement);
  }

  setRegionBounds(bounds: RegionBounds): void {
    this.regionBounds = bounds;
  }

  // Regional event filtering
  private isEventInRegion(event: PointerEvent | WheelEvent): boolean {
    if (!this.regionBounds || !this.domElement) return true;
    
    const rect = this.domElement.getBoundingClientRect();
    const clientX = 'clientX' in event ? event.clientX : 0;
    const clientY = 'clientY' in event ? event.clientY : 0;
    
    return this.regionBounds.contains(clientX - rect.left, clientY - rect.top);
  }

  // Override event handlers with regional filtering
  protected onPointerDown = (event: PointerEvent) => {
    if (!this.enabled || !this.isEventInRegion(event)) return;
    super.onPointerDown(event);
  };

  protected onMouseWheel = (event: WheelEvent) => {
    if (!this.enabled || !this.isEventInRegion(event)) return;
    super.onMouseWheel(event);
    
    // Sync with other controllers if configured
    this.syncWithOthers();
  };

  // Controller synchronization
  syncWith(other: RegionalPanZoomControls, axes: 'x' | 'y' | 'xy' = 'x'): void {
    this.syncControllers.add(other);
    this.syncAxes = axes;
    
    // Bidirectional sync
    other.syncControllers.add(this);
    other.syncAxes = axes;
  }

  private syncWithOthers(): void {
    if (this.syncControllers.size === 0) return;

    const frustum = this.getFrustum();
    
    for (const other of this.syncControllers) {
      if (other === this) continue;
      
      const otherCamera = other.object;
      
      // Sync horizontal axis (common for timeline sync)
      if (this.syncAxes.includes('x')) {
        otherCamera.left = frustum.left;
        otherCamera.right = frustum.right;
      }
      
      // Sync vertical axis (less common)
      if (this.syncAxes.includes('y')) {
        otherCamera.top = frustum.top;
        otherCamera.bottom = frustum.bottom;
      }
      
      otherCamera.updateProjectionMatrix();
      other.dispatchEvent({ type: 'change' });
    }
  }

  // Enhanced state access for React integration
  getViewportState() {
    const frustum = this.getFrustum();
    const width = frustum.right - frustum.left;
    const height = frustum.top - frustum.bottom;
    const centerX = (frustum.left + frustum.right) / 2;
    const centerY = (frustum.top + frustum.bottom) / 2;
    
    return {
      zoom: this.initialCameraWidth / width,
      pan: { x: centerX, y: centerY },
      viewport: { width, height, centerX, centerY },
      bounds: frustum
    };
  }
}
```

### Step 2: React Integration Component

```typescript
// regional-pan-zoom-controls.tsx
import { useEffect, useRef, forwardRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera } from 'three';
import { RegionalPanZoomControls, type RegionBounds } from './regional-pan-zoom-controls';

export interface RegionalPanZoomControlsProps {
  enabled?: boolean;
  regionBounds?: RegionBounds;
  enablePan?: boolean;
  enableZoom?: boolean;
  panSpeed?: number;
  zoomSpeed?: number;
  minZoom?: number;
  maxZoom?: number;
  syncWith?: React.RefObject<RegionalPanZoomControls>;
  syncAxes?: 'x' | 'y' | 'xy';
  onChange?: (state: any) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export const RegionalPanZoomControls = forwardRef<
  RegionalPanZoomControls,
  RegionalPanZoomControlsProps
>((props, ref) => {
  const {
    enabled = true,
    regionBounds,
    enablePan = true,
    enableZoom = true,
    panSpeed = 1.0,
    zoomSpeed = 1.0,
    minZoom = 0.1,
    maxZoom = 10,
    syncWith,
    syncAxes = 'x',
    onChange,
    onStart,
    onEnd
  } = props;

  const controlsRef = useRef<RegionalPanZoomControls | null>(null);
  const { camera, gl, invalidate } = useThree();

  // Create controller instance
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) {
      console.warn('RegionalPanZoomControls: camera must be OrthographicCamera');
      return;
    }

    const controls = new RegionalPanZoomControls(camera, gl.domElement);
    controlsRef.current = controls;

    // Configure controller
    controls.enabled = enabled;
    controls.enablePan = enablePan;
    controls.enableZoom = enableZoom;
    controls.panSpeed = panSpeed;
    controls.zoomSpeed = zoomSpeed;
    controls.minZoom = minZoom;
    controls.maxZoom = maxZoom;

    // Set region bounds
    if (regionBounds) {
      controls.setRegionBounds(regionBounds);
    }

    // Setup sync relationship
    if (syncWith?.current) {
      controls.syncWith(syncWith.current, syncAxes);
    }

    // Expose ref
    if (ref) {
      if (typeof ref === 'function') {
        ref(controls);
      } else {
        ref.current = controls;
      }
    }

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl.domElement, ref]);

  // Update region bounds
  useEffect(() => {
    if (controlsRef.current && regionBounds) {
      controlsRef.current.setRegionBounds(regionBounds);
    }
  }, [regionBounds]);

  // Event handlers
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleChange = () => {
      invalidate();
      if (onChange) {
        const state = controls.getViewportState();
        onChange(state);
      }
    };

    const handleStart = () => onStart?.();
    const handleEnd = () => onEnd?.();

    controls.addEventListener('change', handleChange);
    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('change', handleChange);
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
    };
  }, [onChange, onStart, onEnd, invalidate]);

  return null;
});
```

### Step 3: Usage in Animation Sheet

```typescript
// Example integration in animation-sheet-3d.tsx
function AnimationSheet3D({ animationId }: AnimationSheet3DProps) {
  const trackControllerRef = useRef<RegionalPanZoomControls>(null);
  const timelineControllerRef = useRef<RegionalPanZoomControls>(null);
  
  const trackBounds = useRegion(DATA_VISUALIZATION_REGIONS.TRACK_LIST);
  const timelineBounds = useRegion(DATA_VISUALIZATION_REGIONS.TIMELINE);

  return (
    <Canvas /* ... */>
      {/* Main track controller */}
      <RegionalPanZoomControls
        ref={trackControllerRef}
        enabled={true}
        regionBounds={trackBounds}
        enablePan={true}
        enableZoom={true}
        panSpeed={2.0}
        zoomSpeed={1.2}
        minZoom={0.05}
        maxZoom={20}
        onChange={(state) => {
          // Optional: Update React state for other components
          updatePlayerStore(state.viewport);
        }}
      />

      {/* Timeline controller (synced horizontally with track) */}
      <RegionalPanZoomControls
        ref={timelineControllerRef}
        enabled={true}
        regionBounds={timelineBounds}
        enablePan={false} // Timeline doesn't need pan
        enableZoom={true}
        syncWith={trackControllerRef}
        syncAxes="x" // Only horizontal sync
      />

      {/* Your scene content */}
      <TrackListRegion />
      <TimelineRegion />
      <MinimapRegion />
    </Canvas>
  );
}
```

### Step 4: Region Bounds Integration

```typescript
// Adapt existing layout system to provide bounds
function useRegionBounds(regionId: string): RegionBounds | null {
  const bounds = useRegion(regionId);
  
  return useMemo(() => {
    if (!bounds) return null;
    
    return {
      x: bounds.center.x - bounds.dimensions.width / 2,
      y: bounds.center.y - bounds.dimensions.height / 2,
      width: bounds.dimensions.width,
      height: bounds.dimensions.height,
      contains(clientX: number, clientY: number): boolean {
        return (
          clientX >= this.x &&
          clientX <= this.x + this.width &&
          clientY >= this.y &&
          clientY <= this.y + this.height
        );
      }
    };
  }, [bounds]);
}
```

### Step 5: Migration Strategy

#### Phase 1: Parallel Implementation
```typescript
// Keep existing system while testing controller approach
function AnimationSheet3D({ animationId }: AnimationSheet3DProps) {
  const useControllerGestures = useFeatureFlag('controller-gestures');
  
  return (
    <Canvas>
      {useControllerGestures ? (
        <RegionalPanZoomControls /* ... */ />
      ) : (
        <GestureOnlyCamera /* existing implementation */ />
      )}
      
      {/* Scene content unchanged */}
    </Canvas>
  );
}
```

#### Phase 2: Gradual Conversion
```typescript
// Convert regions one at a time
const CONTROLLER_ENABLED_REGIONS = [
  DATA_VISUALIZATION_REGIONS.TRACK_LIST, // Convert first
  // DATA_VISUALIZATION_REGIONS.TIMELINE, // Convert after track list is stable
  // DATA_VISUALIZATION_REGIONS.MINIMAP,  // Convert last
];
```

## Addressing Specific Issues from Current System

### Issue 1: Broken Zoom Behavior Despite Working Gesture Capture

**Problem Analysis:**
```
🤏 Pinch: 1.00x → 1.17x (IN) scale:1.099 damped:1.020  // Zoom in works
🤏 Pinch: 1.00x → 0.82x (OUT) scale:0.150 damped:0.830  // Current zoom resets to 1.00x??
```

**Root Cause:** The useGesture → React state → useCameraSync() chain creates stale state during rapid gesture events. The "current zoom" reading `1.00x` instead of the actual `1.17x` indicates that `useCameraSync()` is reading from a stale React state snapshot.

**Controller Solution:**
```typescript
// Controller maintains authoritative zoom state
class RegionalPanZoomControls extends PanZoomControls {
  private currentZoom = 1.0;
  
  private handleTouchZoom() {
    const zoomFactor = this.zoomStart / this.zoomEnd;
    
    // Direct zoom calculation from current authoritative state
    this.currentZoom *= zoomFactor;
    this.zoomCameraHorizontal(zoomFactor, center);
    
    // No React state dependency - zoom always consistent
  }
  
  getCurrentZoom(): number {
    return this.currentZoom; // Always fresh, never stale
  }
}
```

**Benefits:**
- Eliminates stale state readings
- Zoom calculations always use current authoritative values
- No React batching delays affecting gesture responsiveness

### Issue 2: Component Re-mounting During Gestures

**Problem Analysis:**
```
🎮 DebugGestureCamera: Component mounted/rendering (called repeatedly during gestures)
```

**Root Cause:** React state updates during gesture events trigger component re-renders and potential re-mounting. This happens because gesture events update player store state, which causes React components to re-render, potentially changing dependencies that cause camera components to unmount/remount.

**Controller Solution:**
```typescript
// Controller exists outside React lifecycle
const controllerRef = useRef<RegionalPanZoomControls>();

useEffect(() => {
  // Controller created once, persists across re-renders
  const controller = new RegionalPanZoomControls(camera, domElement);
  controllerRef.current = controller;
  
  return () => controller.dispose(); // Only disposed when component unmounts
}, [camera, domElement]); // Stable dependencies

// Gesture events handled directly by controller - no React re-renders
```

**Benefits:**
- Controller lifecycle independent of React renders
- No component re-mounting during gesture interactions
- Stable event handling across state changes

### Issue 3: Multiple Camera Authority Conflicts

**Problem Analysis:** Multiple systems compete for camera control:
- R3F automatic camera adjustment (canvas resize)
- Custom camera controllers (manual frustum manipulation)
- Gesture system (player store viewport updates)
- Layout system (region bounds recalculation)

**Controller Solution:**
```typescript
// Single controller per camera with clear authority
class RegionalPanZoomControls extends PanZoomControls {
  private baseFrustum: { left: number; right: number; top: number; bottom: number };
  
  constructor(camera: OrthographicCamera, domElement: HTMLElement) {
    super(camera, domElement);
    
    // Capture R3F's natural camera state as baseline
    this.baseFrustum = {
      left: camera.left,
      right: camera.right, 
      top: camera.top,
      bottom: camera.bottom
    };
  }
  
  // Apply gestures on top of R3F's natural adjustments
  updateFromResize(newBaseFrustum: any) {
    this.baseFrustum = newBaseFrustum;
    this.applyCurrentGestureState(); // Reapply gestures to new base
  }
}
```

**Benefits:**
- Clear camera authority hierarchy
- Works WITH R3F instead of against it
- No competing camera controllers

### Issue 4: Coordinate System Inconsistencies

**Problem Analysis:** Multiple coordinate transformations create inconsistencies:
- Player Store: Viewport `[0, 1]` (timeline portion)
- useCameraSync: Zoom `1/viewport_width` + Pan `viewport_center - 0.5`
- Camera Controllers: Three.js world coordinates
- Layout System: CSS pixels → Three.js coordinates
- Gesture Library: Screen coordinates + scale factors

**Controller Solution:**
```typescript
class RegionalPanZoomControls extends PanZoomControls {
  // Single coordinate system throughout
  private screenToWorld(screenX: number, screenY: number): Vector2 {
    const rect = this.domElement.getBoundingClientRect();
    const relativeX = (screenX - rect.left) / rect.width;
    const relativeY = (screenY - rect.top) / rect.height;
    
    const frustum = this.getFrustum();
    const worldX = frustum.left + relativeX * (frustum.right - frustum.left);
    const worldY = frustum.bottom + relativeY * (frustum.top - frustum.bottom);
    
    return new Vector2(worldX, worldY);
  }
  
  // All gesture calculations in consistent world space
  private zoomToPoint(zoomFactor: number, screenPoint: Vector2) {
    const worldPoint = this.screenToWorld(screenPoint.x, screenPoint.y);
    // Direct world coordinate calculations - no coordinate system jumps
  }
}
```

**Benefits:**
- Single coordinate system eliminates transformation errors
- Screen → World mapping handled consistently
- No coordinate system boundary issues

### Issue 5: Async State Synchronization Problems

**Problem Analysis:** State updates happen in different React cycles, creating timing dependencies and synchronization issues between player store, camera sync, and camera controllers.

**Controller Solution:**
```typescript
// Optional React integration (when needed)
class RegionalPanZoomControls extends PanZoomControls {
  private reactStateSync?: (state: any) => void;
  
  setReactStateSync(callback: (state: any) => void) {
    this.reactStateSync = callback;
  }
  
  private notifyReactIfNeeded() {
    // Only sync to React when explicitly needed
    if (this.reactStateSync) {
      const state = this.getViewportState();
      this.reactStateSync(state);
    }
  }
  
  // Gesture handling remains synchronous
  private handleGesture() {
    this.updateCameraDirectly(); // Immediate
    this.notifyReactIfNeeded();  // Optional, async
  }
}
```

**Benefits:**
- Camera updates are immediate and synchronous
- React state sync is optional and secondary
- No timing dependencies between systems

## Implementation Impact on Current Issues

### Immediate Fixes

1. **✅ Zoom behavior consistency** - Controller maintains authoritative zoom state
2. **✅ Component stability** - No re-mounting during gestures
3. **✅ Visual smoothness** - Same-frame camera updates eliminate artifacts
4. **✅ Performance** - No React overhead during gesture interactions

### Architecture Improvements

1. **✅ Clear camera authority** - Single controller per camera/HUD
2. **✅ Player store authority** - Viewport state remains in player store
3. **✅ Unified coordinates** - Consistent transformation throughout  
4. **✅ Regional isolation** - Events filtered at source per HUD
5. **✅ HUD independence** - Each HUD can have different gesture behavior
6. **✅ Simplified debugging** - Clear authority hierarchy (store → controller → camera)</text>

<old_text line=957>
### Compatibility Preservation

1. **✅ Layout system integration** - Controllers work with existing region bounds
2. **✅ Optional React state sync** - Can still update player store when needed
3. **✅ Incremental migration** - Can convert regions one at a time
4. **✅ Fallback capability** - Can revert individual regions if issues arise

### Compatibility Preservation

1. **✅ Layout system integration** - Controllers work with existing region bounds
2. **✅ Optional React state sync** - Can still update player store when needed
3. **✅ Incremental migration** - Can convert regions one at a time
4. **✅ Fallback capability** - Can revert individual regions if issues arise

## Recommended Architecture

### Phase 1: Hybrid Transition Approach

**1. Keep Layout System, Replace Gesture Handling**
```typescript
// Maintain React-based layout system for region calculation
const bounds = useRegion(TRACK_LIST);

// But use Three.js controller for gesture handling
useEffect(() => {
  if (bounds && cameraRef.current) {
    const controller = new RegionalPanZoomControls(
      cameraRef.current,
      canvasRef.current,
      bounds
    );
    
    // Optional: Bridge to React state when needed
    controller.addEventListener('change', () => {
      // Update player store only when necessary
      updatePlayerStore(controller.getViewport());
    });
    
    return () => controller.dispose();
  }
}, [bounds]);
```

**2. Camera Authority Pattern**
```typescript
// Single camera controller per region
<Canvas>
  <PanZoomControls 
    camera={mainCamera}
    region={trackListBounds}
    enabled={true}
    ref={trackControllerRef}
  />
  
  <HUDPanZoomControls
    camera={hudCamera}  
    region={timelineBounds}
    enabled={true}
    syncWith={trackControllerRef} // Horizontal sync only
  />
</Canvas>
```

### Phase 2: Full Controller Architecture

**1. Region-Aware Controller Hierarchy**
```typescript
interface RegionController {
  regionId: string;
  bounds: RegionBounds;
  camera: OrthographicCamera;
  enabled: boolean;
  
  // Regional event isolation
  handleEvent(event: Event): boolean;
  
  // Synchronization with other controllers
  syncWith(other: RegionController, axes: 'x' | 'y' | 'xy'): void;
}

class TrackController extends RegionController {
  // Track-specific gesture behavior
  handleZoom(delta: number, center: Vector2): void;
  handlePan(delta: Vector2): void;
}

class TimelineController extends RegionController {
  // Timeline-specific behavior (horizontal only)
  handleHorizontalSync(trackController: TrackController): void;
}
```

**2. Event System Unification**
```typescript
class GestureManager {
  private controllers: Map<string, RegionController> = new Map();
  
  registerController(regionId: string, controller: RegionController): void {
    this.controllers.set(regionId, controller);
  }
  
  private routeEvent(event: Event): void {
    // Single event routing system
    for (const [regionId, controller] of this.controllers) {
      if (controller.handleEvent(event)) {
        break; // Event consumed
      }
    }
  }
}
```

## Implementation Benefits

### Performance Advantages

**1. Eliminated React Overhead**
- No state updates during gesture handling
- No component re-renders during interactions
- No stale closure issues
- Direct camera manipulation without intermediate state

**2. Reduced Complexity**
- Single event handling system
- Clear ownership of camera state
- No state synchronization between systems
- Simplified debugging

### Maintainability Benefits

**1. Clear Architecture**
- One controller per region/camera
- Well-defined interfaces between controllers
- Standard Three.js patterns
- Familiar development patterns for Three.js developers

**2. Extensibility**
- Easy to add new gesture types
- Simple to implement controller variants
- Clear inheritance patterns
- Standard event system integration

### User Experience Improvements

**1. Responsive Gestures**
- Immediate visual feedback
- Smooth animations without state lag
- Consistent behavior across devices
- Proper event capture/release

**2. Regional Isolation**
- Gestures only affect intended regions
- No gesture leakage between areas
- Proper event boundaries
- Intuitive interaction model

## Migration Strategy

### Stage 1: Foundation (1-2 weeks)
1. **Implement base PanZoomControls** with region awareness
2. **Create RegionalPanZoomControls** extending base class
3. **Add event routing system** for multiple controllers
4. **Test single region** (track list) conversion

### Stage 2: Core Features (2-3 weeks)
1. **Convert track region** to controller-based system
2. **Implement timeline sync** with track controller
3. **Add minimap controller** with overview behavior
4. **Remove old useGesture system** from converted regions

### Stage 3: Polish & Optimization (1-2 weeks)
1. **Performance optimization** of controller interactions
2. **Enhanced gesture features** (momentum, constraints)
3. **Comprehensive testing** across devices
4. **Documentation** and developer guides

## Risk Assessment

### Implementation Risks

**Medium Risk:**
- **Learning curve**: Team needs to understand Three.js controller patterns
- **Integration complexity**: Bridging with existing layout system
- **Testing scope**: Need comprehensive gesture testing across devices

**Low Risk:**
- **Performance regressions**: Controller approach should improve performance
- **Feature parity**: Three.js controllers provide more gesture features
- **Maintenance burden**: Standard patterns reduce maintenance complexity

### Mitigation Strategies

1. **Incremental migration**: Convert one region at a time
2. **Parallel development**: Keep old system running during transition
3. **Comprehensive testing**: Automated gesture testing suite
4. **Fallback plan**: Can revert individual regions if needed

## Conclusion

The current useGesture-based approach creates fundamental conflicts between React state management and Three.js camera control. A unified Three.js controller architecture addresses the root causes of our gesture issues:

1. **Eliminates state synchronization problems** by making controllers authoritative
2. **Provides proper regional isolation** at the event source
3. **Follows established Three.js patterns** for better maintainability
4. **Improves performance** by removing React overhead during gestures

**Recommendation: Proceed with controller-based architecture** using the phased migration approach. The pan-zoom-controls implementation provides a solid foundation that can be extended for our specific regional and synchronization needs.

The benefits significantly outweigh the implementation costs, and the resulting system will be more performant, maintainable, and extensible than the current approach.

## Decision Matrix

### Technical Comparison

| Aspect | Current useGesture Approach | Three.js Controller Approach | Winner |
|--------|----------------------------|------------------------------|--------|
| **Performance** | 16-33ms latency, React overhead | <1ms latency, direct updates | **Controller** |
| **State Consistency** | Multiple sources of truth, stale state | Single authoritative source | **Controller** |
| **Regional Isolation** | Global events, React-based filtering | Native event filtering at source | **Controller** |
| **Debugging** | Multi-system trace required | Single controller state | **Controller** |
| **Maintainability** | Complex state synchronization | Standard Three.js patterns | **Controller** |
| **Learning Curve** | React patterns (familiar) | Three.js patterns (new) | **useGesture** |
| **Integration Effort** | Already integrated | Requires implementation | **useGesture** |
| **Framework Alignment** | React-first approach | Three.js native approach | **Controller** |

### Risk Assessment

| Risk Category | Current System | Controller Migration | Mitigation |
|---------------|----------------|---------------------|------------|
| **Performance Issues** | High (ongoing) | Low | Incremental migration |
| **Development Velocity** | Medium (complexity) | Low (after initial setup) | Parallel implementation |
| **User Experience** | High (broken gestures) | Low | Comprehensive testing |
| **Technical Debt** | High (accumulating) | Low | Standard patterns |

### Implementation Complexity

| Phase | Effort Level | Timeline | Risk Level |
|-------|-------------|----------|------------|
| **Foundation Setup** | Medium | 1-2 weeks | Low |
| **Single Region Migration** | Low | 3-5 days | Low |
| **Multi-Region Sync** | Medium | 1 week | Medium |
| **Complete Migration** | Low | 2-3 weeks | Low |

## Final Recommendations

### Immediate Action Plan

**1. Clean Architecture Implementation (High Priority)**
- **Rationale**: Fundamental reworking allows optimal architecture design
- **Approach**: Build clean Three.js controller system with player store authority
- **Timeline**: Begin immediately with clean foundation implementation

**2. Optimal Implementation Strategy**
- **Phase 1**: Design and implement clean RegionalPanZoomControls architecture
- **Phase 2**: Build track region with optimal controller patterns
- **Phase 3**: Implement HUD-based timeline and minimap controllers
- **Phase 4**: Establish clean store authority patterns throughout

**4. Player Store Integration Pattern**
```typescript
// Export store instance for imperative access
export const playerStoreInstance = createPlayerStore();

export function getPlayerStore() {
  return playerStoreInstance;
}

// Controller maintains store authority
class RegionalPanZoomControls extends PanZoomControls {
  private unsubscribe: () => void;
  
  constructor(camera: OrthographicCamera, domElement: HTMLElement) {
    super(camera, domElement);
    this.syncWithPlayerStore();
  }
  
  // Subscribe to authoritative viewport state
  private syncWithPlayerStore() {
    const store = getPlayerStore();
    
    // One-way sync: store → camera
    this.unsubscribe = store.subscribe(
      (state) => ({
        viewport: state.viewport,
        playing: state.playing
      }),
      ({ viewport, playing }) => {
        // Only apply external viewport changes when not actively gesturing
        if (!playing && !this.isGestureActive) {
          this.updateCameraFromViewport(viewport);
        }
      }
    );
  }
  
  // Gestures update authoritative store state
  private commitGestureToStore() {
    const viewport = this.calculateViewportFromCamera();
    getPlayerStore().getState().updateViewport(viewport);
  }
  
  dispose() {
    this.unsubscribe();
    super.dispose();
  }
}
```
```</text>

<old_text line=915>
### Issue 5: Async State Synchronization Problems

**Problem Analysis:** State updates happen in different React cycles, creating timing dependencies and synchronization issues between player store, camera sync, and camera controllers.

**Controller Solution:**
```typescript
// Optional React integration (when needed)
class RegionalPanZoomControls extends PanZoomControls {
  private reactStateSync?: (state: any) => void;
  
  setReactStateSync(callback: (state: any) => void) {
    this.reactStateSync = callback;
  }
  
  private notifyReactIfNeeded() {
    // Only sync to React when explicitly needed
    if (this.reactStateSync) {
      const state = this.getViewportState();
      this.reactStateSync(state);
    }
  }
  
  // Gesture handling remains synchronous
  private handleGesture() {
    this.updateCameraDirectly(); // Immediate
    this.notifyReactIfNeeded();  // Optional, async
  }
}
```

**Benefits:**
- Camera updates are immediate and synchronous
- React state sync is optional and secondary
- No timing dependencies between systems

**3. Parallel Development Approach**
- Keep existing system running during migration
- Use feature flags to toggle between approaches
- Comprehensive testing before switching regions

### Strategic Decisions

**✅ RECOMMENDED: Clean Three.js Controller Architecture with Player Store Authority**

**Key Decision Factors:**
1. **Addresses root causes** rather than symptoms of current issues
2. **Follows established Three.js patterns** for optimal organization
3. **Provides immediate performance benefits** with same-frame updates
4. **Enables proper regional isolation** via HUD system architecture
5. **Maintains player store authority** as single source of truth
6. **Leverages HUD independence** for clean controller separation
7. **Focuses on optimal architecture** rather than backwards compatibility
8. **Enables imperative store access** for responsive gesture handling
9. **Simplifies debugging** with clear authority hierarchy: Store → Controller → Camera
10. **Establishes clean foundation** for future gesture feature development

<old_text line=1172>
**The Three.js controller approach with store authority directly addresses all identified issues:**

1. **Eliminates state synchronization problems** with store subscription pattern
2. **Provides proper regional event isolation** at the source via HUD system
3. **Maintains player store authority** while adding responsive gesture implementation
4. **Follows established Three.js patterns** for better maintainability  
5. **Delivers immediate performance improvements** with same-frame updates
6. **Preserves existing state management** ensuring backwards compatibility
7. **Simplifies debugging** with clear authority chain: Store → Controller → Camera

**❌ NOT RECOMMENDED: Continuing with useGesture fixes**

**Rejection Rationale:**
1. **Fundamental architecture conflicts** cannot be resolved with incremental fixes
2. **State synchronization issues** are inherent to React → Three.js state flow
3. **Performance overhead** will persist with React-based gesture handling
4. **Technical debt accumulation** will continue without architectural change

### Success Criteria

**Technical Metrics:**
- ✅ Gesture latency < 5ms (currently 16-33ms)
- ✅ Zero component re-mounting during gestures
- ✅ Consistent zoom/pan state at all times
- ✅ Regional event isolation working correctly

**User Experience Metrics:**
- ✅ Smooth 60fps gesture interactions on all devices
- ✅ Intuitive zoom/pan behavior matching user expectations
- ✅ No visual artifacts during gesture handling
- ✅ Responsive feedback on touch/mouse interactions

**Development Metrics:**
- ✅ Clear debugging capabilities for gesture issues
- ✅ Standard Three.js development patterns
- ✅ Reduced complexity in camera-related code
- ✅ Easier addition of new gesture features

### Implementation Timeline

**Phase 1: Clean Foundation (Week 1-2)**
- [ ] Design and implement clean RegionalPanZoomControls architecture
- [ ] Create optimized React integration components
- [ ] Establish player store subscription patterns
- [ ] Setup comprehensive testing framework for gesture interactions
- [ ] Document clean controller API and usage patterns

**Phase 2: Core Implementation (Week 3-4)**
- [ ] Implement track region with clean controller architecture
- [ ] Build timeline HUD with synchronized controller
- [ ] Create minimap HUD with overview controller
- [ ] Establish clean HUD isolation patterns
- [ ] Comprehensive testing of multi-region interactions

**Phase 3: Integration & Optimization (Week 5-6)**
- [ ] Integrate all controllers with player store authority
- [ ] Optimize performance and gesture responsiveness
- [ ] Implement comprehensive regional event isolation
- [ ] Clean up and remove old gesture system entirely
- [ ] Final testing, documentation, and deployment

**Phase 4: Enhancement & Polish (Week 7)**
- [ ] Add advanced gesture features (momentum, constraints)
- [ ] Performance optimization and edge case handling
- [ ] Developer documentation and usage guides
- [ ] Production deployment and monitoring

## Step-by-Step Implementation Guide

This section provides a comprehensive, actionable implementation plan for the clean Three.js controller architecture. Since this is a fundamental reworking, we focus on optimal organization and clarity rather than backwards compatibility.

### Step 1: Foundation Architecture Setup

#### 1.1 Create Base Controller Structure

**File: `src/controllers/base/PanZoomControlsBase.ts`**
```typescript
import { EventDispatcher, OrthographicCamera, Vector2 } from 'three';
import type { PlayerStore } from '../../stores/player-store';

export interface ViewportState {
  start: number;    // [0, 1] timeline position
  end: number;      // [0, 1] timeline position
  zoom: number;     // Derived zoom factor
  pan: number;      // Derived pan offset
}

export abstract class PanZoomControlsBase extends EventDispatcher {
  protected camera: OrthographicCamera;
  protected domElement: HTMLElement;
  protected playerStore: PlayerStore;
  protected enabled = true;
  protected isGestureActive = false;
  private storeUnsubscribe?: () => void;

  constructor(camera: OrthographicCamera, domElement: HTMLElement, playerStore: PlayerStore) {
    super();
    this.camera = camera;
    this.domElement = domElement;
    this.playerStore = playerStore;
    this.setupStoreSubscription();
    this.connect();
  }

  // Abstract methods for subclasses
  abstract isEventInRegion(event: PointerEvent | WheelEvent): boolean;
  abstract calculateViewportFromCamera(): ViewportState;
  abstract updateCameraFromViewport(viewport: ViewportState): void;

  private setupStoreSubscription() {
    this.storeUnsubscribe = this.playerStore.subscribe(
      (state) => ({ viewport: state.viewport, playing: state.playing }),
      ({ viewport, playing }) => {
        if (!playing && !this.isGestureActive) {
          this.updateCameraFromViewport(viewport);
        }
      }
    );
  }

  protected commitViewportToStore(viewport: ViewportState) {
    this.playerStore.getState().updateViewport(viewport);
  }

  dispose() {
    this.disconnect();
    this.storeUnsubscribe?.();
  }
}
```

#### 1.2 Create Regional Controller Implementation

**File: `src/controllers/RegionalPanZoomControls.ts`**
```typescript
import { Vector2 } from 'three';
import { PanZoomControlsBase, type ViewportState } from './base/PanZoomControlsBase';

export interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class RegionalPanZoomControls extends PanZoomControlsBase {
  private regionBounds: RegionBounds | null = null;
  private pointers: PointerEvent[] = [];
  private zoomStart = 0;
  private panStart = new Vector2();

  setRegionBounds(bounds: RegionBounds) {
    this.regionBounds = bounds;
  }

  isEventInRegion(event: PointerEvent | WheelEvent): boolean {
    if (!this.regionBounds) return true;
    
    const rect = this.domElement.getBoundingClientRect();
    const clientX = 'clientX' in event ? event.clientX : 0;
    const clientY = 'clientY' in event ? event.clientY : 0;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    return (
      x >= this.regionBounds.x &&
      x <= this.regionBounds.x + this.regionBounds.width &&
      y >= this.regionBounds.y &&
      y <= this.regionBounds.y + this.regionBounds.height
    );
  }

  calculateViewportFromCamera(): ViewportState {
    const frustumWidth = this.camera.right - this.camera.left;
    const frustumCenter = (this.camera.left + this.camera.right) / 2;
    
    // Convert camera state to viewport coordinates
    // Implementation specific to your coordinate system
    const zoom = this.getBaseWidth() / frustumWidth;
    const pan = frustumCenter / this.getBaseWidth();
    
    return {
      start: Math.max(0, 0.5 + pan - 0.5 / zoom),
      end: Math.min(1, 0.5 + pan + 0.5 / zoom),
      zoom,
      pan
    };
  }

  updateCameraFromViewport(viewport: ViewportState) {
    const baseWidth = this.getBaseWidth();
    const frustumWidth = baseWidth / viewport.zoom;
    const frustumCenter = viewport.pan * baseWidth;
    
    this.camera.left = frustumCenter - frustumWidth / 2;
    this.camera.right = frustumCenter + frustumWidth / 2;
    this.camera.updateProjectionMatrix();
  }

  private getBaseWidth(): number {
    // Return base timeline width - adjust based on your system
    return 1000; // Example value
  }

  // Event handlers implementation...
  private onPointerDown = (event: PointerEvent) => {
    if (!this.enabled || !this.isEventInRegion(event)) return;
    
    event.preventDefault();
    this.isGestureActive = true;
    this.addPointer(event);
    
    if (this.pointers.length === 2) {
      this.startZoomGesture();
    }
    
    this.dispatchEvent({ type: 'start' });
  };

  // Additional event handling methods...
}
```

### Step 2: HUD-Based Regional Implementation

#### 2.1 Create HUD Controller Manager

**File: `src/controllers/HUDControllerManager.ts`**
```typescript
export class HUDControllerManager {
  private controllers = new Map<string, RegionalPanZoomControls>();
  private syncGroups = new Map<string, Set<string>>();

  registerController(id: string, controller: RegionalPanZoomControls) {
    this.controllers.set(id, controller);
  }

  createSyncGroup(groupId: string, controllerIds: string[], syncAxes: 'x' | 'y' | 'xy' = 'x') {
    const group = new Set(controllerIds);
    this.syncGroups.set(groupId, group);
    
    // Setup bidirectional sync between controllers in group
    for (const controllerId of controllerIds) {
      const controller = this.controllers.get(controllerId);
      if (controller) {
        controller.addEventListener('change', () => {
          this.syncGroup(groupId, controllerId, syncAxes);
        });
      }
    }
  }

  private syncGroup(groupId: string, sourceId: string, syncAxes: string) {
    const group = this.syncGroups.get(groupId);
    const sourceController = this.controllers.get(sourceId);
    
    if (!group || !sourceController) return;
    
    const sourceViewport = sourceController.calculateViewportFromCamera();
    
    for (const targetId of group) {
      if (targetId === sourceId) continue;
      
      const targetController = this.controllers.get(targetId);
      if (targetController) {
        // Apply sync based on axes
        if (syncAxes.includes('x')) {
          const targetViewport = { ...targetController.calculateViewportFromCamera() };
          targetViewport.start = sourceViewport.start;
          targetViewport.end = sourceViewport.end;
          targetController.updateCameraFromViewport(targetViewport);
        }
      }
    }
  }

  dispose() {
    for (const controller of this.controllers.values()) {
      controller.dispose();
    }
    this.controllers.clear();
    this.syncGroups.clear();
  }
}
```

#### 2.2 Create React HUD Components

**File: `src/components/three/huds/TrackHUD.tsx`**
```typescript
import { useRef, useEffect } from 'react';
import { Hud } from '@react-three/drei';
import { OrthographicCamera } from 'three';
import { useThree } from '@react-three/fiber';
import { RegionalPanZoomControls } from '../../../controllers/RegionalPanZoomControls';
import { usePlayerStore } from '../../../hooks/use-player-store';
import { useRegion } from '../layout';

export function TrackHUD({ children }: { children: React.ReactNode }) {
  const controllerRef = useRef<RegionalPanZoomControls>();
  const { camera, gl } = useThree();
  const playerStore = usePlayerStore.getState();
  const trackBounds = useRegion('TRACK_LIST');

  useEffect(() => {
    if (!(camera instanceof OrthographicCamera) || !trackBounds) return;

    const controller = new RegionalPanZoomControls(camera, gl.domElement, playerStore);
    controller.setRegionBounds({
      x: trackBounds.center.x - trackBounds.dimensions.width / 2,
      y: trackBounds.center.y - trackBounds.dimensions.height / 2,
      width: trackBounds.dimensions.width,
      height: trackBounds.dimensions.height
    });

    controllerRef.current = controller;

    return () => {
      controller.dispose();
    };
  }, [camera, gl.domElement, trackBounds, playerStore]);

  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 100]} />
      {children}
    </Hud>
  );
}
```

**File: `src/components/three/huds/TimelineHUD.tsx`**
```typescript
export function TimelineHUD({ children, syncWithTrack }: { 
  children: React.ReactNode;
  syncWithTrack?: React.RefObject<RegionalPanZoomControls>;
}) {
  const controllerRef = useRef<RegionalPanZoomControls>();
  const { camera, gl } = useThree();
  const playerStore = usePlayerStore.getState();
  const timelineBounds = useRegion('TIMELINE');

  useEffect(() => {
    if (!(camera instanceof OrthographicCamera) || !timelineBounds) return;

    const controller = new RegionalPanZoomControls(camera, gl.domElement, playerStore);
    controller.setRegionBounds({
      x: timelineBounds.center.x - timelineBounds.dimensions.width / 2,
      y: timelineBounds.center.y - timelineBounds.dimensions.height / 2,
      width: timelineBounds.dimensions.width,
      height: timelineBounds.dimensions.height
    });

    // Setup horizontal sync with track controller
    if (syncWithTrack?.current) {
      // Implement sync logic
    }

    controllerRef.current = controller;

    return () => {
      controller.dispose();
    };
  }, [camera, gl.domElement, timelineBounds, playerStore, syncWithTrack]);

  return (
    <Hud renderPriority={2}>
      <OrthographicCamera makeDefault position={[0, 0, 100]} />
      {children}
    </Hud>
  );
}
```

### Step 3: Integration with Animation Sheet

#### 3.1 Update Animation Sheet Component

**File: `src/components/three/animation-sheet-3d.tsx`**
```typescript
import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { TrackHUD } from './huds/TrackHUD';
import { TimelineHUD } from './huds/TimelineHUD';
import { MinimapHUD } from './huds/MinimapHUD';
import { HUDControllerManager } from '../../controllers/HUDControllerManager';

export function AnimationSheet3D({ animationId }: { animationId: string }) {
  const controllerManagerRef = useRef<HUDControllerManager>();
  const trackControllerRef = useRef<RegionalPanZoomControls>();
  const timelineControllerRef = useRef<RegionalPanZoomControls>();
  const minimapControllerRef = useRef<RegionalPanZoomControls>();

  useEffect(() => {
    const manager = new HUDControllerManager();
    controllerManagerRef.current = manager;

    // Setup sync groups when controllers are ready
    if (trackControllerRef.current && timelineControllerRef.current) {
      manager.registerController('track', trackControllerRef.current);
      manager.registerController('timeline', timelineControllerRef.current);
      manager.createSyncGroup('horizontal-sync', ['track', 'timeline'], 'x');
    }

    return () => {
      manager.dispose();
    };
  }, []);

  return (
    <Canvas
      orthographic
      camera={{
        position: [0, 0, 100],
        zoom: 1,
        near: 0.1,
        far: 1000
      }}
    >
      {/* Main scene content */}
      <TrackHUD>
        <TrackListRegion animationId={animationId} />
      </TrackHUD>

      <TimelineHUD syncWithTrack={trackControllerRef}>
        <TimelineRegion />
      </TimelineHUD>

      <MinimapHUD>
        <MinimapRegion />
      </MinimapHUD>
    </Canvas>
  );
}
```

### Step 4: Player Store Integration

#### 4.1 Update Player Store for Controller Access

**File: `src/stores/player-store.ts`**
```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface ViewportState {
  start: number;
  end: number;
  zoom: number;
  pan: number;
}

interface PlayerState {
  viewport: ViewportState;
  playing: boolean;
  currentTime: number;
  duration: number;
}

interface PlayerActions {
  updateViewport: (viewport: Partial<ViewportState>) => void;
  setPlaying: (playing: boolean) => void;
  seekTo: (time: number) => void;
}

export const usePlayerStore = create<PlayerState & PlayerActions>()(
  subscribeWithSelector((set, get) => ({
    // State
    viewport: { start: 0, end: 1, zoom: 1, pan: 0.5 },
    playing: false,
    currentTime: 0,
    duration: 5000,

    // Actions
    updateViewport: (viewport) => set((state) => ({
      viewport: { ...state.viewport, ...viewport }
    })),
    
    setPlaying: (playing) => set({ playing }),
    
    seekTo: (currentTime) => set({ currentTime }),
  }))
);

// Export store instance for imperative access
export const playerStoreInstance = usePlayerStore;
```

### Step 5: Remove Old Gesture System

#### 5.1 Clean Up Old Files

**Remove these files:**
- `src/hooks/use-camera-sync.ts`
- `src/hooks/use-zoom-gestures.ts`
- `src/components/three/cameras/gesture-only-camera.tsx`
- `src/components/three/cameras/main-scene-camera-controller.tsx`
- Any other useGesture-based components

#### 5.2 Update Imports and References

**Update all components that previously used:**
```typescript
// Remove these imports
import { useCameraSync } from '../hooks/use-camera-sync';
import { useCanvasZoomGestures } from '../hooks/use-zoom-gestures';
import { GestureOnlyCamera } from '../cameras/gesture-only-camera';

// Replace with clean HUD-based approach
import { TrackHUD, TimelineHUD, MinimapHUD } from '../huds';
```

### Step 6: Testing and Validation

#### 6.1 Create Controller Test Suite

**File: `src/controllers/__tests__/RegionalPanZoomControls.test.ts`**
```typescript
import { RegionalPanZoomControls } from '../RegionalPanZoomControls';
import { OrthographicCamera } from 'three';

describe('RegionalPanZoomControls', () => {
  let camera: OrthographicCamera;
  let domElement: HTMLElement;
  let controller: RegionalPanZoomControls;

  beforeEach(() => {
    camera = new OrthographicCamera(-400, 400, 300, -300, 0.1, 1000);
    domElement = document.createElement('div');
    controller = new RegionalPanZoomControls(camera, domElement, mockPlayerStore);
  });

  test('should filter events by region', () => {
    controller.setRegionBounds({ x: 100, y: 100, width: 200, height: 200 });
    
    const eventInRegion = new PointerEvent('pointerdown', { clientX: 150, clientY: 150 });
    const eventOutsideRegion = new PointerEvent('pointerdown', { clientX: 50, clientY: 50 });
    
    expect(controller.isEventInRegion(eventInRegion)).toBe(true);
    expect(controller.isEventInRegion(eventOutsideRegion)).toBe(false);
  });

  test('should update viewport state correctly', () => {
    const viewport = { start: 0.2, end: 0.8, zoom: 2, pan: 0.5 };
    controller.updateCameraFromViewport(viewport);
    
    const result = controller.calculateViewportFromCamera();
    expect(result.zoom).toBeCloseTo(viewport.zoom);
    expect(result.pan).toBeCloseTo(viewport.pan);
  });
});
```

#### 6.2 Integration Testing

**File: `src/components/__tests__/AnimationSheet3D.integration.test.tsx`**
```typescript
import { render, fireEvent } from '@testing-library/react';
import { AnimationSheet3D } from '../AnimationSheet3D';

describe('AnimationSheet3D Integration', () => {
  test('should handle gestures without conflicts', async () => {
    const { container } = render(<AnimationSheet3D animationId="test" />);
    const canvas = container.querySelector('canvas');
    
    // Simulate pinch gesture
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 100, pointerId: 2 });
    
    // Should not throw errors or cause conflicts
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 250, clientY: 100, pointerId: 2 });
  });
});
```

### Step 7: Documentation and Deployment

#### 7.1 Update Component Documentation

**File: `docs/controllers/README.md`**
```markdown
# Animation System Controllers

## Architecture Overview

The animation system uses a clean Three.js controller architecture with HUD-based regional isolation and player store authority.

### Key Components

1. **RegionalPanZoomControls**: Base controller for gesture handling within specific regions
2. **HUD Components**: Isolated UI layers with independent cameras and controllers
3. **Player Store**: Single source of truth for viewport state
4. **Controller Manager**: Synchronization between multiple controllers

### Usage Examples

#### Basic Track Controller
```tsx
<TrackHUD>
  <TrackListRegion animationId={animationId} />
</TrackHUD>
```

#### Synchronized Timeline
```tsx
<TimelineHUD syncWithTrack={trackControllerRef}>
  <TimelineRegion />
</TimelineHUD>
```
```

## Conclusion

This step-by-step implementation guide provides a clear path to a clean, well-organized Three.js controller architecture. The approach prioritizes:

1. **Clean Architecture**: Optimal organization with clear separation of concerns
2. **HUD Isolation**: Each region operates independently without conflicts
3. **Player Store Authority**: Centralized state management with controller implementation
4. **Performance**: Same-frame gesture responses with optimized store updates
5. **Maintainability**: Standard Three.js patterns with comprehensive testing

The implementation can be completed in phases, with each step building upon the previous foundation to create a robust, scalable gesture system that resolves all current architectural issues.