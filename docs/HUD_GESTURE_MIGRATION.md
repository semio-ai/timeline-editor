# HUD Gesture Migration Guide

## Overview

This guide documents the migration from the current layout system to a HUD-based gesture architecture for the 3D animation timeline. The goal is to achieve proper layering where tracks appear behind other elements, with synchronized gesture controls across regions.

## Architecture Summary

Based on the gesture and camera requirements:

| Region       | Camera Zooms | Camera Scrolls Vertically | z-index | HUD Layer |
|--------------|--------------|---------------------------|---------|-----------|
| top ruler    | yes          | no                        | 1       | HUD 1     |
| tracks       | yes          | yes                       | 0       | Main Scene|
| timeline     | yes          | no                        | 1       | HUD 2     |
| minimap      | no           | no                        | 1       | HUD 3     |
| bottom ruler | no           | no                        | 1       | HUD 3     |

**Key Insight**: All regions respond to horizontal pan/zoom gestures using the same controller, but only tracks respond to vertical scrolling.

## Phase 1: Update Layout System for HUD Elements

### 1.1 Modify Animation Sheet Structure

Update `animation-sheet-3d.tsx` to support the new HUD architecture:

```tsx
// animation-sheet-3d.tsx
export function InnerSheet3D({
  namespaceId,
  animationInstances,
  onToggleExpand,
  height = MIN_SHEET_HEIGHT,
}: AnimationSheet3DProps): ReactNode {
  const scrollY = useMotionValue(0);

  // ... existing state management ...

  return (
    <ColorContextProvider>
      <div className="animation-sheet-container w-full">
        {/* Existing DOM controls */}
        <div
          ref={layoutRef}
          style={{ height, minHeight: MIN_SHEET_HEIGHT }}
          className="grid grid-cols-[302px_1fr] group/sheet w-full pr-0.5 pb-0.5 grid-rows-[32px_1fr_36px_36px_36px]"
        >
          {/* ... existing DOM layout ... */}

          {/* Replace Canvas section */}
          <div className="w-full min-w-0 row-span-5">
            <Canvas
              className="w-full h-full"
              orthographic
              camera={{
                position: [0, 0, 100],
                up: [0, 1, 0],
                zoom: 1,
              }}
            >
              <HUDDataEditor
                animationId={currentAnimation}
                namespaceId={namespaceId}
                instanceSettings={instanceSettings}
                scrollY={scrollY}
              />
            </Canvas>
          </div>

          {/* ... existing DOM controls ... */}
        </div>

        {/* Synchronized Track List */}
        <div className="absolute left-0 top-[32px] w-[302px]" style={{ height: height - MIN_SHEET_HEIGHT }}>
          <TrackList3D
            animationId={currentAnimation}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            height={height - MIN_SHEET_HEIGHT}
            trackRender={trackRender}
            scrollY={scrollY}
          />
        </div>

        {/* ... more existing DOM layout ... */}

      </div>
    </ColorContextProvider>
  );
}
```

### 1.2 Create HUD Timeline Scene Component

```tsx
// components/three/hud-timeline-scene.tsx
interface HUDDataEditorProps {
  animationId: string;
  namespaceId: string;
  instanceSettings?: AnimationInstanceSettings;
  scrollY: MotionValue<number>;
}

export function HUDDataEditor({
  animationId,
  namespaceId,
  instanceSettings,
  scrollY,
}: HUDDataEditorProps): ReactNode {
  return (
    <>
      {/* Main scene: tracks only - full gesture support */}
      <TrackCamera scrollY={scrollY} />
      <UniversalGestureHandler enableVerticalScroll={true}>
        <TrackListRegion
          animationId={animationId}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          scrollY={scrollY}
        />
      </UniversalGestureHandler>

      {/* HUD 1: Top Ruler - zooming camera */}
      <Hud renderPriority={1}>
        <ZoomingCamera height={DATA_VISUALIZATION_HEIGHTS.TOP_RULER} />
        <UniversalGestureHandler enableVerticalScroll={false}>
          <TopRulerRegion />
        </UniversalGestureHandler>
      </Hud>

      {/* HUD 2: Timeline - zooming camera */}
      <Hud renderPriority={2}>
        <ZoomingCamera height={DATA_VISUALIZATION_HEIGHTS.TIMELINE} />
        <UniversalGestureHandler enableVerticalScroll={false}>
          <TimelineRegion />
        </UniversalGestureHandler>
      </Hud>

      {/* HUD 3: Minimap + Bottom Ruler - fixed camera */}
      <Hud renderPriority={3}>
        <FixedCamera
          height={DATA_VISUALIZATION_HEIGHTS.MINIMAP + DATA_VISUALIZATION_HEIGHTS.BOTTOM_RULER}
        />
        <UniversalGestureHandler enableVerticalScroll={false}>
          <MinimapRegion />
          <BottomRulerRegion />
        </UniversalGestureHandler>
      </Hud>

      <ambientLight intensity={1} />
    </>
  );
}
```

### 1.3 Update Layout Provider Usage

Remove the `LayoutProvider` from the main scene since each HUD will manage its own coordinate system:

```tsx
// Remove this from the Canvas children:
// <LayoutProvider config={DEFAULT_DATA_VISUALIZATION_LAYOUT}>
```

## Phase 2: Camera System Implementation

### 2.1 Create Base Camera Hook

```tsx
// hooks/use-camera-sync.ts
export function useCameraSync() {
  const { viewport } = usePlayerStore();
  const { camera } = useThree();

  return { viewport, camera };
}
```

### 2.2 Track Camera (Main Scene)

```tsx
// components/three/cameras/track-camera.tsx
interface TrackCameraProps {
  scrollY: MotionValue<number>;
}

export function TrackCamera({ scrollY }: TrackCameraProps): ReactNode {
  const { viewport, camera } = useCameraSync();
  const { duration } = useAnimationStore();

  // Horizontal zoom/pan from viewport
  useEffect(() => {
    if (camera instanceof OrthographicCamera) {
      const totalWidth = duration;
      camera.left = viewport[0] * totalWidth - totalWidth / 2;
      camera.right = viewport[1] * totalWidth - totalWidth / 2;
      camera.updateProjectionMatrix();
    }
  }, [viewport, camera, duration]);

  // Vertical scroll from motion value
  useFrame(() => {
    if (camera instanceof OrthographicCamera) {
      camera.position.y = scrollY.get();
      camera.updateMatrixWorld();
    }
  });

  return null;
}
```

### 2.3 Zooming Camera (Top Ruler & Timeline)

```tsx
// components/three/cameras/zooming-camera.tsx
interface ZoomingCameraProps {
  height: number;
}

export function ZoomingCamera({ height }: ZoomingCameraProps): ReactNode {
  const { viewport, camera } = useCameraSync();
  const { duration } = useAnimationStore();

  useEffect(() => {
    if (camera instanceof OrthographicCamera) {
      // Apply zoom from viewport
      const totalWidth = duration;
      camera.left = viewport[0] * totalWidth - totalWidth / 2;
      camera.right = viewport[1] * totalWidth - totalWidth / 2;

      // Fixed vertical bounds
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.position.set(0, 0, 0);

      camera.updateProjectionMatrix();
    }
  }, [viewport, camera, duration, height]);

  return null;
}
```

### 2.4 Fixed Camera (Minimap & Bottom Ruler)

```tsx
// components/three/cameras/fixed-camera.tsx
interface FixedCameraProps {
  height: number;
}

export function FixedCamera({ height }: FixedCameraProps): ReactNode {
  const { camera } = useCameraSync();
  const { duration } = useAnimationStore();

  useEffect(() => {
    if (camera instanceof OrthographicCamera) {
      // Always show full timeline range
      camera.left = -duration / 2;
      camera.right = duration / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.position.set(0, 0, 0);

      camera.updateProjectionMatrix();
    }
  }, [camera, duration, height]);

  return null;
}
```

## Phase 3: Vertical Scroll Synchronization

### 3.1 Update Track List Region

```tsx
// components/three/regions/track-list-region.tsx
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
      {/* Track backgrounds positioned in world coordinates */}
      {animationId &&
        tracks.map((trackId, index) => (
          <TrackBackground
            key={trackId}
            trackId={trackId}
            index={index}
            worldY={-index * 36} // Fixed world positions
          />
        ))}
    </>
  );
}

function TrackBackground({
  trackId,
  index,
  worldY
}: {
  trackId: string;
  index: number;
  worldY: number;
}): ReactNode {
  const color = useColors(trackId);
  const { duration } = useAnimationStore();

  return (
    <mesh position={[0, worldY, -0.1]}>
      <planeGeometry args={[duration, 36]} />
      <meshBasicMaterial color={color} transparent opacity={1} />
    </mesh>
  );
}
```

### 3.2 Synchronize with DOM Track List

Ensure the DOM `TrackList3D` uses the same `scrollY` motion value:

```tsx
// components/three/track-list-3d.tsx
export function TrackList3D({
  // ... existing props
  scrollY,
}: TrackList3DProps): ReactNode {
  // ... existing logic

  return (
    <div className="relative h-full w-full overflow-hidden">
      <ScrollArea
        orientation="vertical"
        className="pr-1"
        style={{ maxHeight: height }}
        motionScrollY={scrollY} // This syncs with 3D camera
      >
        {/* ... track items */}
      </ScrollArea>
    </div>
  );
}
```

## Phase 4: Adapted useGesture Controller

### 4.1 Maintaining Existing Patterns

Adapt the current `useZoomGestures` hook to work with Canvas instead of SVG while maintaining the same player store pattern:

- **Familiar API**: Same `useGesture` hook with `onPinch`/`onWheel` handlers
- **Player store integration**: Gestures update viewport, cameras respond to store changes
- **Region-aware behavior**: Different gesture responses based on screen coordinates
- **Minimal refactoring**: Most existing gesture logic can be reused

### 4.2 Region Behavior Matrix

| Gesture Type | Tracks | Top Ruler | Timeline | Minimap | Bottom Ruler |
|--------------|--------|-----------|----------|---------|--------------|
| Horizontal Pan | ✅ | ✅ | ✅ | ✅ | ✅ |
| Zoom | ✅ | ✅ | ✅ | ❌ | ❌ |
| Vertical Scroll | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4.3 Adapted Canvas Zoom Gestures Hook

```tsx
// hooks/use-canvas-zoom-gestures.ts
export const useCanvasZoomGestures = (
  canvasRef: RefObject<HTMLCanvasElement>,
  otherGestureHandlers?: GestureHandlers<AnyHandlerEventTypes>,
  config?: UserGestureConfig,
) => {
  const shiftKeyPressed = useShiftKeyPressed();
  const { animationId } = useTrackContext();
  const updatePlayerViewport = usePlayerStore(
    useShallow((state: PlayerActions) => state.updatePlayerViewport),
  );

  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[animationId]?.duration ?? 5000),
  );

  const zoomScale = useRef<ScaleLinear>(scaleLinear({ domain: [0, 1], range: [0, 1] }));

  usePlayerSubscription(
    (state) => state.player.viewport,
    (viewport) => zoomScale.current.domain(viewport),
  );

  // Get canvas bounds instead of SVG bounds
  const getCanvasBounds = useCallback(() => {
    if (!canvasRef.current) return { left: 0, width: 800 };
    const rect = canvasRef.current.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  }, [canvasRef]);

  // Detect active region for gesture filtering
  const getActiveRegion = useCallback((clientY: number): 'tracks' | 'rulers' | 'minimap' => {
    if (!canvasRef.current) return 'tracks';

    const rect = canvasRef.current.getBoundingClientRect();
    const normalizedY = (clientY - rect.top) / rect.height;

    const topRulerEnd = DATA_VISUALIZATION_HEIGHTS.TOP_RULER / rect.height;
    const trackListEnd = 1 - (DATA_VISUALIZATION_HEIGHTS.TIMELINE + DATA_VISUALIZATION_HEIGHTS.MINIMAP + DATA_VISUALIZATION_HEIGHTS.BOTTOM_RULER) / rect.height;
    const timelineEnd = 1 - (DATA_VISUALIZATION_HEIGHTS.MINIMAP + DATA_VISUALIZATION_HEIGHTS.BOTTOM_RULER) / rect.height;

    if (normalizedY <= topRulerEnd) return 'rulers';
    if (normalizedY <= trackListEnd) return 'tracks';
    if (normalizedY <= timelineEnd) return 'rulers';
    return 'minimap';
  }, [canvasRef]);

  const onPinch = useCallback(
    ({ event, offset: [scale], memo, timeStamp, origin }: FullGestureState<"pinch">) => {
      const activeRegion = getActiveRegion(origin[1]);

      // Minimap doesn't respond to zoom
      if (activeRegion === 'minimap') return memo;

      event.preventDefault();
      event.stopPropagation();

      // Same Safari duplicate event handling as original
      let timestampSet: Set<number> = memo ?? new Set<number>();
      const isRepeatTimestamp = timestampSet.has(timeStamp);
      if (isRepeatTimestamp) {
        return timestampSet;
      } else if (timestampSet.size > 16) {
        timestampSet = new Set([...timestampSet].slice(1));
        timestampSet.add(timeStamp);
      } else {
        timestampSet.add(timeStamp);
      }

      const bounds = getCanvasBounds();
      const newPosition = clamp(
        zoomScale.current.invert((origin[0] - bounds.left) / bounds.width),
        0,
        1,
      );
      const clampedScale = Math.max(1, scale);
      const newDomainWidth = 1 / clampedScale;

      const newDomain = [
        newPosition - newDomainWidth * newPosition,
        newPosition + newDomainWidth * (1 - newPosition),
      ];
      updatePlayerViewport(newDomain[0], newDomain[1]);
      return timestampSet;
    },
    [getCanvasBounds, getActiveRegion, updatePlayerViewport, zoomScale],
  );

  const onWheel = useCallback(
    ({ shiftKey, delta, event }: FullGestureState<"wheel">) => {
      const activeRegion = getActiveRegion(event.clientY);
      const isZoom = event.ctrlKey || event.metaKey;
      const isVertical = !shiftKey && Math.abs(delta[1]) > Math.abs(delta[0]);
      const isHorizontal = shiftKey || Math.abs(delta[0]) > Math.abs(delta[1]);

      // Handle zoom (all regions except minimap)
      if (isZoom && activeRegion !== 'minimap') {
        event.preventDefault();
        event.stopPropagation();

        const bounds = getCanvasBounds();
        const zoomPoint = clamp(
          zoomScale.current.invert((event.clientX - bounds.left) / bounds.width),
          0,
          1,
        );

        const zoomFactor = delta[1] > 0 ? 0.9 : 1.1; // Zoom in/out
        const currentDomain = zoomScale.current.domain();
        const currentWidth = currentDomain[1] - currentDomain[0];
        const newWidth = Math.max(0.01, Math.min(1, currentWidth / zoomFactor));

        const newStart = Math.max(0, Math.min(1 - newWidth, zoomPoint - newWidth * (zoomPoint - currentDomain[0]) / currentWidth));
        const newEnd = newStart + newWidth;

        updatePlayerViewport(newStart, newEnd);
        return;
      }

      // Handle vertical scroll (tracks only)
      if (isVertical && activeRegion === 'tracks') {
        // Let this bubble up to be handled by track-specific scroll logic
        // Don't prevent default here - let the track vertical scroll handler handle it
        return;
      }

      // Handle horizontal pan (all regions)
      if (isHorizontal) {
        event.preventDefault();
        event.stopPropagation();

        const bounds = getCanvasBounds();
        const currentDomain = zoomScale.current.domain();
        const deltaMovement = shiftKey ? delta[1] : delta[0];
        const movement = deltaMovement / bounds.width;
        const proposedStart = currentDomain[0] + movement;
        const proposedEnd = currentDomain[1] + movement;

        if (proposedStart >= 0 && proposedEnd <= 1) {
          updatePlayerViewport(proposedStart, proposedEnd);
        } else if (proposedStart < 0 && proposedEnd <= 1) {
          updatePlayerViewport(0, proposedEnd - proposedStart);
        } else if (proposedStart >= 0 && proposedEnd > 1) {
          updatePlayerViewport(proposedStart - (proposedEnd - 1), 1);
        }
      }
    },
    [getCanvasBounds, getActiveRegion, updatePlayerViewport, zoomScale],
  );

  useGesture(
    {
      ...(otherGestureHandlers ?? {}),
      onPinch,
      onWheel,
    },
    {
      ...(config ?? {}),
      target: canvasRef,
      pinch: {
        scaleBounds: { min: 1, max: duration / 500 },
        rubberband: true,
        modifierKey: ["metaKey", "ctrlKey"],
      },
      wheel: {
        axis: shiftKeyPressed ? "y" : "x",
      },
      eventOptions: { passive: false },
    },
  );
};
```

### 4.4 Track-Specific Vertical Scroll Handler

```tsx
// hooks/use-track-vertical-scroll.ts
export const useTrackVerticalScroll = (
  canvasRef: RefObject<HTMLCanvasElement>,
  scrollY: MotionValue<number>
) => {
  const getActiveRegion = useCallback((clientY: number): 'tracks' | 'other' => {
    if (!canvasRef.current) return 'tracks';

    const rect = canvasRef.current.getBoundingClientRect();
    const normalizedY = (clientY - rect.top) / rect.height;

    const topRulerEnd = DATA_VISUALIZATION_HEIGHTS.TOP_RULER / rect.height;
    const trackListEnd = 1 - (DATA_VISUALIZATION_HEIGHTS.TIMELINE + DATA_VISUALIZATION_HEIGHTS.MINIMAP + DATA_VISUALIZATION_HEIGHTS.BOTTOM_RULER) / rect.height;

    return (normalizedY > topRulerEnd && normalizedY <= trackListEnd) ? 'tracks' : 'other';
  }, [canvasRef]);

  useGesture(
    {
      onWheel: ({ delta, event, shiftKey, ctrlKey, metaKey }) => {
        const isZoom = ctrlKey || metaKey;
        const isVertical = !shiftKey && Math.abs(delta[1]) > Math.abs(delta[0]);
        const activeRegion = getActiveRegion(event.clientY);

        // Only handle vertical scroll in tracks region when not zooming
        if (isVertical && !isZoom && activeRegion === 'tracks') {
          event.preventDefault();
          event.stopPropagation();

          const sensitivity = 0.5;
          const currentScroll = scrollY.get();
          const newScroll = Math.max(0, currentScroll + delta[1] * sensitivity);
          scrollY.set(newScroll);
        }
      },
    },
    {
      target: canvasRef,
      eventOptions: { passive: false },
    }
  );
};
```

### 4.5 Updated Animation Sheet Structure

```tsx
// animation-sheet-3d.tsx
export function InnerSheet3D({
  namespaceId,
  animationInstances,
  onToggleExpand,
  height = MIN_SHEET_HEIGHT,
}: AnimationSheet3DProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollY = useMotionValue(0);

  // Main gesture handling (zoom/pan)
  useCanvasZoomGestures(canvasRef);

  // Track-specific vertical scroll
  useTrackVerticalScroll(canvasRef, scrollY);

  // ... existing state management ...

  return (
    <ColorContextProvider>
      <div className="animation-sheet-container w-full">
        <div
          ref={layoutRef}
          style={{ height, minHeight: MIN_SHEET_HEIGHT }}
          className="grid grid-cols-[302px_1fr] group/sheet w-full pr-0.5 pb-0.5 grid-rows-[32px_1fr_36px_36px_36px]"
        >
          {/* ... existing DOM controls ... */}

          <div className="w-full min-w-0 row-span-5">
            <Canvas
              ref={canvasRef}
              className="w-full h-full"
              orthographic
              camera={{
                position: [0, 0, 100],
                up: [0, 1, 0],
                zoom: 1,
              }}
            >
              <HUDDataEditor
                animationId={currentAnimation}
                namespaceId={namespaceId}
                instanceSettings={instanceSettings}
                scrollY={scrollY}
              />
            </Canvas>
          </div>

          {/* ... existing DOM controls ... */}
        </div>

        {/* Synchronized Track List */}
        <div className="absolute left-0 top-[32px] w-[302px]" style={{ height: height - MIN_SHEET_HEIGHT }}>
          <TrackList3D
            animationId={currentAnimation}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            height={height - MIN_SHEET_HEIGHT}
            trackRender={trackRender}
            scrollY={scrollY}
          />
        </div>
      </div>
    </ColorContextProvider>
  );
}
```

### 4.6 Simplified HUD Timeline Scene

```tsx
// components/three/hud-timeline-scene.tsx
export function HUDDataEditor({
  animationId,
  namespaceId,
  instanceSettings,
  scrollY,
}: HUDDataEditorProps): ReactNode {
  return (
    <>
      {/* Main scene: tracks only */}
      <TrackCamera scrollY={scrollY} />
      <TrackListRegion
        animationId={animationId}
        namespaceId={namespaceId}
        instanceSettings={instanceSettings}
        scrollY={scrollY}
      />

      {/* HUD 1: Top Ruler */}
      <Hud renderPriority={1}>
        <ZoomingCamera height={DATA_VISUALIZATION_HEIGHTS.TOP_RULER} />
        <TopRulerRegion />
      </Hud>

      {/* HUD 2: Timeline */}
      <Hud renderPriority={2}>
        <ZoomingCamera height={DATA_VISUALIZATION_HEIGHTS.TIMELINE} />
        <TimelineRegion />
      </Hud>

      {/* HUD 3: Minimap + Bottom Ruler */}
      <Hud renderPriority={3}>
        <FixedCamera
          height={DATA_VISUALIZATION_HEIGHTS.MINIMAP + DATA_VISUALIZATION_HEIGHTS.BOTTOM_RULER}
        />
        <MinimapRegion />
        <BottomRulerRegion />
      </Hud>

      <ambientLight intensity={1} />
    </>
  );
}
```

### 4.7 Benefits of Adapted useGesture Approach

- **Maintains existing patterns**: Uses same `useGesture` API and player store updates
- **Minimal refactoring**: Most of the existing gesture logic can be reused
- **Clean separation**: Gestures update player store, cameras respond to store changes
- **Future-proof**: Easy to switch from normalized (0-1) to real units (milliseconds) later
- **Familiar debugging**: Same gesture event flow as current implementation

### 4.8 Migration from Normalized to Real Units

When ready to switch from normalized (0-1) viewport to real units:

```tsx
// Instead of viewport: [0.2, 0.8] (20% to 80% of timeline)
// Use viewport: [1000, 4000] (1000ms to 4000ms)

const onWheel = useCallback(({ delta, event }) => {
  const currentDomain = zoomScale.current.domain(); // [1000, 4000]
  const movement = (delta[0] / bounds.width) * duration; // Scale by actual duration
  const proposedStart = currentDomain[0] + movement;
  const proposedEnd = currentDomain[1] + movement;

  // Clamp to [0, duration] instead of [0, 1]
  if (proposedStart >= 0 && proposedEnd <= duration) {
    updatePlayerViewport(proposedStart, proposedEnd);
  }
}, [/* deps */]);
```

## Phase 5: Dummy Content for Testing

### 5.1 Enhanced Top Ruler Region

```tsx
// components/three/regions/top-ruler-region.tsx
export function TopRulerRegion(): ReactNode {
  const { viewport, duration } = usePlayerStore();

  // Generate time markers based on current zoom level
  const markers = useMemo(() => {
    const viewportWidth = viewport[1] - viewport[0];
    const visibleDuration = duration * viewportWidth;
    const markerInterval = visibleDuration < 1000 ? 100 : visibleDuration < 10000 ? 1000 : 5000;

    const startTime = duration * viewport[0];
    const endTime = duration * viewport[1];
    const markers = [];

    for (let time = Math.floor(startTime / markerInterval) * markerInterval;
         time <= endTime;
         time += markerInterval) {
      const normalizedPosition = time / duration;
      const worldX = (normalizedPosition - 0.5) * duration;
      markers.push({ time, worldX });
    }

    return markers;
  }, [viewport, duration]);

  return (
    <group>
      {/* Ruler background */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[duration, DATA_VISUALIZATION_HEIGHTS.TOP_RULER]} />
        <meshBasicMaterial color="cyan" transparent opacity={0.3} />
      </mesh>

      {/* Time markers */}
      {markers.map(({ time, worldX }) => (
        <group key={time} position={[worldX, 0, 0]}>
          {/* Marker line */}
          <mesh position={[0, -8, 0]}>
            <planeGeometry args={[1, 16]} />
            <meshBasicMaterial color="white" />
          </mesh>

          {/* Time label would go here in real implementation */}
        </group>
      ))}
    </group>
  );
}
```

### 5.2 Enhanced Timeline Region

```tsx
// components/three/regions/timeline-region.tsx
export function TimelineRegion(): ReactNode {
  const { viewport, duration } = usePlayerStore();
  const { stamp } = usePlayerStore(); // Current playhead position

  return (
    <group>
      {/* Timeline background */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[duration, DATA_VISUALIZATION_HEIGHTS.TIMELINE]} />
        <meshBasicMaterial color="orange" transparent opacity={0.3} />
      </mesh>

      {/* Playhead indicator */}
      <mesh position={[(stamp - 0.5) * duration, 0, 0.1]}>
        <planeGeometry args={[2, DATA_VISUALIZATION_HEIGHTS.TIMELINE]} />
        <meshBasicMaterial color="red" />
      </mesh>

      {/* Viewport indicators for testing zoom */}
      <mesh position={[(viewport[0] - 0.5) * duration, 8, 0.05]}>
        <planeGeometry args={[4, 8]} />
        <meshBasicMaterial color="yellow" />
      </mesh>
      <mesh position={[(viewport[1] - 0.5) * duration, 8, 0.05]}>
        <planeGeometry args={[4, 8]} />
        <meshBasicMaterial color="yellow" />
      </mesh>
    </group>
  );
}
```

### 5.3 Enhanced Minimap Region

```tsx
// components/three/regions/minimap-region.tsx
export function MinimapRegion(): ReactNode {
  const { viewport, duration } = usePlayerStore();
  const { stamp } = usePlayerStore();

  return (
    <group position={[0, DATA_VISUALIZATION_HEIGHTS.BOTTOM_RULER / 2, 0]}>
      {/* Minimap background */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[duration, DATA_VISUALIZATION_HEIGHTS.MINIMAP]} />
        <meshBasicMaterial color="red" transparent opacity={0.3} />
      </mesh>

      {/* Full timeline representation */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[duration * 0.9, 4]} />
        <meshBasicMaterial color="gray" />
      </mesh>

      {/* Current viewport indicator */}
      <mesh position={[((viewport[0] + viewport[1]) / 2 - 0.5) * duration, 0, 0.1]}>
        <planeGeometry args={[(viewport[1] - viewport[0]) * duration, 8]} />
        <meshBasicMaterial color="white" transparent opacity={0.5} />
      </mesh>

      {/* Playhead in minimap */}
      <mesh position={[(stamp - 0.5) * duration, 0, 0.2]}>
        <planeGeometry args={[1, DATA_VISUALIZATION_HEIGHTS.MINIMAP]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </group>
  );
}
```

### 5.4 Testing Checklist

After implementing all phases, test the following:

#### Gesture Tests
- [ ] **Horizontal scroll/pan**: All regions should pan together
- [ ] **Cmd/Ctrl + vertical scroll (zoom)**: Top ruler, tracks, and timeline should zoom; minimap should stay fixed
- [ ] **Pinch gesture**: Same zoom behavior as Cmd+scroll
- [ ] **Vertical scroll**: Only tracks should scroll vertically; other regions should ignore
- [ ] **Gesture precedence**: HUD elements should capture gestures before they reach tracks

#### Visual Tests
- [ ] **Layering**: Tracks appear behind all other elements
- [ ] **Zoom indicators**: Timeline shows playhead and viewport bounds
- [ ] **Minimap**: Shows full range with current viewport highlighted
- [ ] **Synchronization**: DOM track list scrolls with 3D track content
- [ ] **Camera coordination**: Zoom/pan affects appropriate regions only

#### Performance Tests
- [ ] **Smooth scrolling**: No lag during rapid gestures
- [ ] **Memory usage**: No memory leaks during extended gesture use
- [ ] **Frame rate**: Consistent 60fps during animations

## Migration Notes

1. **Gradual Implementation**: Each phase can be implemented and tested independently
2. **Fallback Strategy**: Keep existing layout system until HUD system is fully tested
3. **Performance Monitoring**: Watch for increased render overhead from multiple HUD layers
4. **Gesture Conflicts**: Ensure proper event propagation between HUD layers
5. **Accessibility**: Maintain keyboard navigation support throughout migration

## Dependencies

- `@react-three/drei` for HUD components
- `@use-gesture/react` for gesture handling
- `motion/react` for motion values
- Existing animation store and player utilities
