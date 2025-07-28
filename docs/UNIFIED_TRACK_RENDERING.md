# Unified Track Rendering Architecture

## Overview

This document explores a performance-optimized approach where all tracks render in a single Three.js View rather than individual Views per track. This architecture leverages drei's Select component for efficient selection handling while maintaining the visual pairing between control widgets and track visualizations.

## Current vs Proposed Architecture

### Current: Multiple Views
```tsx
// Each track gets its own View
{tracks.map(track => (
  <div className="track-row grid grid-cols-[298px_1fr]">
    <ControlWidget trackId={track.id} />
    <View track={trackRef}>
      <TrackVisualization trackId={track.id} />
    </View>
  </div>
))}
```

### Proposed: Single Unified View
```tsx
// All tracks render in one View
<div className="grid grid-cols-[298px_1fr]">
  <div className="track-controls">
    {tracks.map(track => (
      <ControlWidget 
        key={track.id}
        trackId={track.id} 
        onExpandChange={(expanded) => handleExpandChange(track.id, expanded)}
      />
    ))}
  </div>
  
  <View className="unified-track-view">
    <Select>
      <UnifiedTrackScene tracks={tracks} expandedTracks={expandedTracks} />
    </Select>
  </View>
</div>
```

## Performance Benefits

### 1. Reduced Draw Calls
- Single scene traversal instead of N traversals
- Shared geometries and materials across all tracks
- Single camera and lighting setup

### 2. Simplified Viewport Management
- One set of viewport calculations
- Unified frustum culling
- Single render pass

### 3. Memory Efficiency
- Shared WebGL context resources
- Reduced React component overhead
- Single event listener setup

## Track Organization Architecture

### Scene Structure
```tsx
function UnifiedTrackScene({ tracks, expandedTracks }) {
  const trackLayout = useTrackLayout(tracks, expandedTracks);
  
  return (
    <group name="all-tracks">
      {tracks.map((track, index) => (
        <group 
          key={track.id}
          name={`track-${track.id}`}
          position={[0, trackLayout.getY(track.id), 0]}
        >
          <TrackContent 
            track={track}
            expanded={expandedTracks.has(track.id)}
            height={trackLayout.getHeight(track.id)}
          />
        </group>
      ))}
    </group>
  );
}
```

### Dynamic Track Layout
```tsx
function useTrackLayout(tracks: Track[], expandedTracks: Set<string>) {
  return useMemo(() => {
    const COLLAPSED_HEIGHT = 36;
    const EXPANDED_HEIGHT = 144; // 36px per attribute line
    const GAP = 2;
    
    let y = 0;
    const positions = new Map<string, number>();
    const heights = new Map<string, number>();
    
    tracks.forEach(track => {
      const height = expandedTracks.has(track.id) ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
      positions.set(track.id, y);
      heights.set(track.id, height);
      y -= (height + GAP);
    });
    
    return {
      getY: (trackId: string) => positions.get(trackId) ?? 0,
      getHeight: (trackId: string) => heights.get(trackId) ?? COLLAPSED_HEIGHT,
      totalHeight: Math.abs(y)
    };
  }, [tracks, expandedTracks]);
}
```

## Selection with drei's Select

### Basic Selection Setup
```tsx
import { Select, useCursor } from '@react-three/drei';

function UnifiedTrackScene() {
  const [hovered, setHovered] = useState<string | null>(null);
  const { selected, select, deselect } = useSelection();
  
  useCursor(hovered !== null);
  
  return (
    <Select
      box
      multiple
      onChange={(objects) => {
        const frameIds = objects.map(obj => obj.userData.frameId).filter(Boolean);
        select(frameIds);
      }}
    >
      {tracks.map(track => (
        <TrackContent 
          key={track.id}
          track={track}
          onHover={setHovered}
        />
      ))}
    </Select>
  );
}
```

### Enhanced Selection with Metadata
```tsx
function Keyframe({ frame, trackId, position }) {
  return (
    <Select.Item>
      <mesh
        position={position}
        userData={{
          frameId: frame.id,
          trackId: trackId,
          timestamp: frame.timestamp,
          value: frame.value,
          type: 'keyframe'
        }}
      >
        <octahedronGeometry args={[8, 0]} />
        <meshBasicMaterial color={frame.color} />
      </mesh>
    </Select.Item>
  );
}
```

### Advanced Selection Patterns
```tsx
// Time-based vertical selection
function selectAtTime(timestamp: number, tolerance: number = 0.01) {
  const { scene } = useThree();
  const frames: Object3D[] = [];
  
  scene.traverse((obj) => {
    if (obj.userData.type === 'keyframe' && 
        Math.abs(obj.userData.timestamp - timestamp) < tolerance) {
      frames.push(obj);
    }
  });
  
  return frames;
}

// Track-based selection
function selectTrack(trackId: string) {
  const { scene } = useThree();
  const frames: Object3D[] = [];
  
  scene.traverse((obj) => {
    if (obj.userData.trackId === trackId && obj.userData.type === 'keyframe') {
      frames.push(obj);
    }
  });
  
  return frames;
}
```

## Control-Track Synchronization

### Shared State Management
```tsx
const useTrackUIStore = create((set, get) => ({
  expandedTracks: new Set<string>(),
  hoveredTrack: null as string | null,
  selectedTracks: new Set<string>(),
  
  toggleExpanded: (trackId: string) => {
    set(state => {
      const expanded = new Set(state.expandedTracks);
      if (expanded.has(trackId)) {
        expanded.delete(trackId);
      } else {
        expanded.add(trackId);
      }
      return { expandedTracks: expanded };
    });
  },
  
  setHoveredTrack: (trackId: string | null) => {
    set({ hoveredTrack: trackId });
  }
}));
```

### Visual Feedback Coordination
```tsx
function ControlWidget({ trackId, onExpandChange }) {
  const { expandedTracks, hoveredTrack, toggleExpanded } = useTrackUIStore();
  const isExpanded = expandedTracks.has(trackId);
  const isHovered = hoveredTrack === trackId;
  
  return (
    <div 
      className={clsx(
        "control-widget",
        isHovered && "bg-gray-100",
        isExpanded && "expanded"
      )}
      onMouseEnter={() => useTrackUIStore.setState({ hoveredTrack: trackId })}
      onMouseLeave={() => useTrackUIStore.setState({ hoveredTrack: null })}
    >
      <button onClick={() => toggleExpanded(trackId)}>
        {isExpanded ? '▼' : '▶'}
      </button>
      {/* Rest of control UI */}
    </div>
  );
}

// In 3D scene
function TrackContent({ track, expanded, height }) {
  const hoveredTrack = useTrackUIStore(state => state.hoveredTrack);
  const isHovered = hoveredTrack === track.id;
  
  return (
    <group>
      {/* Background that responds to hover */}
      <mesh position={[0, height/2, -1]}>
        <planeGeometry args={[1000, height]} />
        <meshBasicMaterial 
          color={isHovered ? "#f0f0f0" : "#ffffff"}
          transparent
          opacity={0.1}
        />
      </mesh>
      
      {/* Track content */}
      {expanded ? (
        <ExpandedTrackContent track={track} />
      ) : (
        <CollapsedTrackContent track={track} />
      )}
    </group>
  );
}
```

## Scroll Synchronization

### Virtual Scrolling
```tsx
function UnifiedTrackView() {
  const scrollY = useRef(0);
  const { camera } = useThree();
  
  const handleScroll = useCallback((e: WheelEvent) => {
    if (!e.shiftKey) { // Vertical scroll when shift not pressed
      scrollY.current += e.deltaY * 0.1;
      
      // Update camera position
      camera.position.y = scrollY.current;
      camera.updateProjectionMatrix();
      
      // Update control panel scroll
      controlPanelRef.current.scrollTop = scrollY.current * PIXEL_RATIO;
    }
  }, [camera]);
  
  return (
    <group>
      <ScrollableTrackContent />
    </group>
  );
}
```

### Synchronized Scrollbars
```tsx
function AnimationSheet3D() {
  const [scrollTop, setScrollTop] = useState(0);
  
  return (
    <div className="grid grid-cols-[298px_1fr]">
      {/* Control panel with native scroll */}
      <div 
        className="overflow-y-auto"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{ height: '100%' }}
      >
        {tracks.map(track => (
          <ControlWidget key={track.id} track={track} />
        ))}
      </div>
      
      {/* 3D view with simulated scroll */}
      <View>
        <CameraController scrollTop={scrollTop} />
        <UnifiedTrackScene />
      </View>
    </div>
  );
}
```

## Performance Optimizations

### 1. Instanced Rendering
```tsx
function OptimizedKeyframes({ tracks }) {
  const allFrames = useMemo(() => {
    return tracks.flatMap(track => 
      track.frames.map(frame => ({
        ...frame,
        trackId: track.id,
        y: getTrackY(track.id)
      }))
    );
  }, [tracks]);
  
  return (
    <Instances limit={10000}>
      <octahedronGeometry args={[8, 0]} />
      <meshBasicMaterial />
      
      {allFrames.map(frame => (
        <Instance
          key={frame.id}
          position={[frame.x, frame.y, 0]}
          color={frame.color}
          userData={frame}
        />
      ))}
    </Instances>
  );
}
```

### 2. LOD Based on Track State
```tsx
function TrackContent({ track, expanded }) {
  const lod = useRef(new THREE.LOD());
  
  useEffect(() => {
    // High detail when expanded
    const highDetail = createDetailedTrack(track);
    lod.current.addLevel(highDetail, 0);
    
    // Low detail when collapsed
    const lowDetail = createSimplifiedTrack(track);
    lod.current.addLevel(lowDetail, 100);
    
    return () => {
      lod.current.clear();
    };
  }, [track, expanded]);
  
  return <primitive object={lod.current} />;
}
```

### 3. Viewport Culling
```tsx
function useViewportCulling() {
  const { camera, size } = useThree();
  
  useFrame((state, delta) => {
    const cam = camera as OrthographicCamera;
    const visibleTop = cam.position.y + cam.top;
    const visibleBottom = cam.position.y + cam.bottom;
    
    // Update track visibility based on viewport
    state.scene.traverse((obj) => {
      if (obj.userData.trackId) {
        const y = obj.position.y;
        obj.visible = y <= visibleTop && y >= visibleBottom;
      }
    });
  });
}
```

## Benefits of Unified Rendering

1. **Performance**: 60+ FPS with hundreds of tracks
2. **Selection**: Efficient multi-track selection with Select component
3. **Coordination**: Seamless UI-3D synchronization
4. **Scalability**: Better handling of large datasets
5. **Maintainability**: Simpler architecture with single scene

## Implementation Roadmap

1. **Phase 1**: Create unified scene structure
2. **Phase 2**: Implement Select-based selection
3. **Phase 3**: Add expand/collapse with transitions
4. **Phase 4**: Optimize with instancing and LOD
5. **Phase 5**: Fine-tune scroll synchronization

This architecture provides significant performance improvements while maintaining the visual relationship between controls and tracks, and enables powerful selection capabilities across the entire timeline.