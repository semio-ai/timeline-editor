# UI Integration Guide for Three.js Migration

## Overview

This guide outlines the strategy for integrating React UI components with the Three.js-based animation system, focusing on maintaining the existing UI elements as React components while leveraging Three.js for visualization.

## Architecture Principles

### Hybrid Approach
- **React UI Layer**: Controls, settings, tooltips remain as HTML/React components
- **Three.js Visualization Layer**: Track data, animations, and interactive elements
- **Clear Separation**: UI overlays positioned above the canvas, visualization within

## Text Rendering Strategy

### Option 1: drei's Text Component (Recommended for In-Scene Text)

```tsx
import { Text } from '@react-three/drei';

interface SceneTextProps {
  font?: string; // Font URL or path
  fontSize?: number;
  color?: string;
}

function TimeLabel({ time, font, position }: SceneTextProps & { time: number; position: [number, number, number] }) {
  return (
    <Text
      position={position}
      fontSize={10}
      font={font}
      anchorX="center"
      anchorY="middle"
      color="#666"
    >
      {formatTime(time)}
    </Text>
  );
}
```

**Pros:**
- Renders as part of the scene (proper depth, occlusion)
- Scales with zoom naturally
- Better performance for many labels
- Consistent rendering across platforms

**Cons:**
- Limited typography options
- Requires font loading
- Less flexible styling

### Option 2: drei's Html Component (Recommended for Complex UI)

```tsx
import { Html } from '@react-three/drei';

function ValueTooltip({ value, position }: { value: number; position: [number, number, number] }) {
  return (
    <Html
      position={position}
      center
      distanceFactor={10}
      style={{
        transition: 'opacity 0.2s',
        pointerEvents: 'none'
      }}
    >
      <div className="value-tooltip">
        {value.toFixed(2)}
      </div>
    </Html>
  );
}
```

**Pros:**
- Full CSS styling capabilities
- Inherits app typography
- Rich text formatting
- Accessibility features

**Cons:**
- Rendering overhead
- Z-indexing complexities
- Not truly part of 3D scene

### Recommendation: Hybrid Text Approach

```tsx
interface AnimationSheet3DProps {
  // Optional font for all drei Text components
  font?: string;
  fontUrl?: string;
}

// Create a context for font propagation
const FontContext = createContext<{ font?: string }>({ font: undefined });

export function AnimationSheet3D({ font = '/fonts/Inter-Regular.woff', fontUrl }: AnimationSheet3DProps) {
  // Preload font for drei Text components
  const loadedFont = useFont(fontUrl || font);
  
  return (
    <FontContext.Provider value={{ font: loadedFont || font }}>
      <div className="animation-sheet-3d">
        {/* React UI Layer */}
        <div className="ui-overlay">
          <ControlPanel />
          <PlaybackControls />
        </div>
        
        {/* Three.js Visualization */}
        <Canvas>
          <TimeRuler3D />
          <TrackList3D />
        </Canvas>
      </div>
    </FontContext.Provider>
  );
}

// Use font from context
function TimeRuler3D() {
  const { font } = useContext(FontContext);
  const ticks = useTimelineTicks();
  
  return (
    <group>
      {ticks.map(tick => (
        <Text key={tick.time} font={font} position={[tick.x, 0, 0]}>
          {tick.label}
        </Text>
      ))}
    </group>
  );
}
```

## UI Component Integration

### Layout Structure

```tsx
function AnimationSheet3D() {
  return (
    <div className="relative w-full h-full">
      {/* Canvas takes full space */}
      <Canvas className="absolute inset-0">
        <View.Port />
      </Canvas>
      
      {/* UI overlays with pointer-events */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top controls */}
        <div className="pointer-events-auto">
          <ToggleGroup />
          <PlaybackSettings />
        </div>
        
        {/* Left panel - track controls */}
        <div className="absolute left-0 top-0 w-[298px] pointer-events-auto">
          <ControlWidgetList />
        </div>
        
        {/* Timeline controls */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
          <TimelineControl />
          <TimeControls />
        </div>
      </div>
    </div>
  );
}
```

### Control Widget Integration

```tsx
function TrackRow3D({ trackId, index }) {
  const ref = useRef();
  
  return (
    <div className="grid grid-cols-[298px_1fr] h-[36px]">
      {/* React control widget */}
      <ControlWidget 
        animationId={animationId}
        animatableId={trackObject.animatableId}
        namespace={namespaceId}
      />
      
      {/* Three.js visualization */}
      <div ref={ref} className="relative">
        <View track={ref}>
          <TrackVisualization trackId={trackId} />
        </View>
      </div>
    </div>
  );
}
```

## Tooltip Implementation

### Enhanced TrackedTooltip Pattern

Building on the scene.tsx reference, create a specialized tooltip system:

```tsx
interface TooltipState {
  type: 'frame' | 'violation' | 'value' | null;
  data: any;
  trackId?: string;
  position: { x: number; y: number };
}

function AnimationTooltipProvider({ children }) {
  const [tooltipState, setTooltipState] = useState<TooltipState>({ type: null, data: null, position: { x: 0, y: 0 } });
  const canvasRef = useRef<HTMLCanvasElement>();
  const tooltipRef = useRef<HTMLDivElement>();
  
  const { floatingStyles, elementRefs, context, updateHoverState } = useTrackedTooltip(
    canvasRef,
    tooltipRef,
    'top', // Default to top for timeline
    'x',   // Track horizontal movement primarily
    8      // Offset
  );
  
  return (
    <TooltipContext.Provider value={{ setTooltipState }}>
      <Canvas ref={canvasRef}>
        {children}
      </Canvas>
      
      <TrackedTooltip
        ref={tooltipRef}
        containerStyles={floatingStyles}
        open={context.open && tooltipState.type !== null}
      >
        <AnimationTooltipContent state={tooltipState} />
      </TrackedTooltip>
    </TooltipContext.Provider>
  );
}

// Tooltip content renderer
function AnimationTooltipContent({ state }: { state: TooltipState }) {
  switch (state.type) {
    case 'frame':
      return <FrameTooltip frame={state.data} />;
    case 'violation':
      return <ViolationTooltip violations={state.data} />;
    case 'value':
      return <ValueTooltip value={state.data} />;
    default:
      return null;
  }
}

// Use in 3D components
function Keyframe3D({ frame, position }) {
  const { setTooltipState } = useContext(TooltipContext);
  
  return (
    <mesh
      position={position}
      onPointerEnter={(e) => {
        setTooltipState({
          type: 'frame',
          data: frame,
          position: { x: e.clientX, y: e.clientY }
        });
      }}
      onPointerLeave={() => {
        setTooltipState({ type: null, data: null, position: { x: 0, y: 0 } });
      }}
    >
      <octahedronGeometry args={[8, 0]} />
      <meshBasicMaterial color={frame.color} />
    </mesh>
  );
}
```

## Selection System

### Multi-Track Selection Architecture

```tsx
interface SelectionState {
  tracks: Set<string>;
  frames: Map<string, Set<string>>; // trackId -> frameIds
  mode: 'single' | 'multi' | 'range';
}

const useSelectionStore = create<SelectionState & SelectionActions>((set, get) => ({
  tracks: new Set(),
  frames: new Map(),
  mode: 'single',
  
  selectTrack: (trackId: string, additive = false) => {
    set(state => {
      const tracks = additive ? new Set(state.tracks) : new Set();
      tracks.add(trackId);
      return { tracks };
    });
  },
  
  selectFrame: (trackId: string, frameId: string, additive = false) => {
    set(state => {
      const frames = new Map(state.frames);
      if (!additive) {
        frames.clear();
      }
      
      const trackFrames = frames.get(trackId) || new Set();
      trackFrames.add(frameId);
      frames.set(trackId, trackFrames);
      
      return { frames };
    });
  },
  
  selectRange: (startTrack: string, endTrack: string, startFrame: string, endFrame: string) => {
    // Implement range selection logic
  },
  
  clearSelection: () => {
    set({ tracks: new Set(), frames: new Map() });
  }
}));
```

### Visual Selection Implementation

```tsx
function SelectionOverlay() {
  const selection = useSelectionStore();
  const { camera, size } = useThree();
  
  // Render selection rectangles in screen space
  return (
    <Html fullscreen>
      <svg className="absolute inset-0 pointer-events-none">
        {/* Track selection highlights */}
        {Array.from(selection.tracks).map(trackId => (
          <TrackSelectionRect key={trackId} trackId={trackId} />
        ))}
        
        {/* Frame selection highlights */}
        {Array.from(selection.frames.entries()).map(([trackId, frameIds]) => (
          <FrameSelectionGroup key={trackId} trackId={trackId} frameIds={frameIds} />
        ))}
      </svg>
    </Html>
  );
}
```

### Selection Interaction Patterns

```tsx
function useSelectionGestures() {
  const { selectFrame, selectRange, clearSelection } = useSelectionStore();
  const [dragStart, setDragStart] = useState<{ track: string; frame: string } | null>(null);
  
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    const { trackId, frameId } = e.object.userData;
    
    if (e.shiftKey) {
      // Range selection
      if (dragStart) {
        selectRange(dragStart.track, trackId, dragStart.frame, frameId);
        setDragStart(null);
      } else {
        setDragStart({ track: trackId, frame: frameId });
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Additive selection
      selectFrame(trackId, frameId, true);
    } else {
      // Single selection
      selectFrame(trackId, frameId, false);
    }
  }, [dragStart, selectFrame, selectRange]);
  
  return { handlePointerDown };
}
```

### Cross-Track Selection Capabilities

1. **Box Selection**: Draw rectangle to select multiple frames across tracks
2. **Range Selection**: Shift-click to select range
3. **Track Selection**: Click track header to select all frames in track
4. **Time Selection**: Vertical selection across all tracks at specific time

```tsx
function BoxSelection() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [box, setBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  useGesture({
    onDrag: ({ initial, xy, first, last }) => {
      if (first) {
        setIsSelecting(true);
        setBox({ x: initial[0], y: initial[1], width: 0, height: 0 });
      } else if (last) {
        // Perform selection based on box
        selectFramesInBox(box);
        setIsSelecting(false);
      } else {
        // Update box dimensions
        setBox({
          x: Math.min(initial[0], xy[0]),
          y: Math.min(initial[1], xy[1]),
          width: Math.abs(xy[0] - initial[0]),
          height: Math.abs(xy[1] - initial[1])
        });
      }
    }
  }, { target: canvasRef });
  
  return isSelecting ? (
    <div 
      className="absolute border-2 border-blue-500 bg-blue-500/20"
      style={box}
    />
  ) : null;
}
```

## Best Practices

### 1. Performance Optimization
- Use React.memo for UI components
- Implement viewport culling for tooltips
- Batch selection updates
- Use CSS transforms for UI animations

### 2. Accessibility
- Maintain keyboard navigation for UI controls
- Provide ARIA labels for 3D elements via Html overlays
- Ensure tooltip content is screen-reader accessible

### 3. Responsive Design
- UI components use CSS Grid/Flexbox
- Three.js views respond to container size
- Tooltips adjust position based on viewport bounds

### 4. State Management
- Keep UI state in React/Zustand stores
- Sync with Three.js objects via effects
- Use subscriptions for efficient updates

## Implementation Checklist

- [ ] Set up font loading system for Text components
- [ ] Create tooltip context and provider
- [ ] Implement selection store with multi-track support
- [ ] Build UI overlay structure
- [ ] Create Html-based accessibility layer
- [ ] Test cross-browser compatibility
- [ ] Optimize tooltip performance
- [ ] Implement keyboard shortcuts for selection