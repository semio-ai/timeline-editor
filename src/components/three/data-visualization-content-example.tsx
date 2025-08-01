import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import {
  LayoutProvider,
  RegionContent,
  RegionBackground,
  RegionBorder,
  LayoutDebug,
} from "./layout";
import {
  DEFAULT_DATA_VISUALIZATION_LAYOUT,
  DATA_VISUALIZATION_REGIONS,
  getDataVisualizationRegionColor,
} from "./data-visualization-layout-config";

// Example ruler component with tick marks
function RulerContent({ regionId }: { regionId: string }) {
  return (
    <RegionContent regionId={regionId} padding={{ left: 8, right: 8 }}>
      {/* Ruler tick marks */}
      <group>
        {Array.from({ length: 20 }, (_, i) => {
          const x = (i - 10) * 20; // Spread ticks across the region
          const isMainTick = i % 5 === 0;
          const tickHeight = isMainTick ? 8 : 4;

          return (
            <group key={i}>
              {/* Tick mark */}
              <mesh position={[x, 0, 1]}>
                <planeGeometry args={[1, tickHeight]} />
                <meshBasicMaterial color="#333333" />
              </mesh>

              {/* Label for main ticks */}
              {isMainTick && (
                <Text
                  position={[x, -8, 1]}
                  fontSize={8}
                  color="#333333"
                  anchorX="center"
                  anchorY="top"
                >
                  {i * 100}ms
                </Text>
              )}
            </group>
          );
        })}
      </group>
    </RegionContent>
  );
}

// Example track list with track items
function TrackListContent() {
  const tracks = [
    { id: "track1", name: "Position X", color: "#ff6b6b" },
    { id: "track2", name: "Position Y", color: "#4ecdc4" },
    { id: "track3", name: "Rotation", color: "#45b7d1" },
    { id: "track4", name: "Scale", color: "#96ceb4" },
    { id: "track5", name: "Opacity", color: "#feca57" },
  ];

  return (
    <RegionContent
      regionId={DATA_VISUALIZATION_REGIONS.TRACK_LIST}
      padding={{ top: 4, bottom: 4, left: 8 }}
    >
      <group>
        {tracks.map((track, index) => {
          const y = (tracks.length - 1) * 15 - index * 30; // Stack tracks vertically

          return (
            <group key={track.id} position={[0, y, 0]}>
              {/* Track background */}
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[280, 25]} />
                <meshBasicMaterial
                  color={index % 2 === 0 ? "#f8f9fa" : "#e9ecef"}
                  transparent
                  opacity={0.8}
                />
              </mesh>

              {/* Track color indicator */}
              <mesh position={[-130, 0, 1]}>
                <planeGeometry args={[4, 20]} />
                <meshBasicMaterial color={track.color} />
              </mesh>

              {/* Track name */}
              <Text
                position={[-120, 0, 1]}
                fontSize={10}
                color="#333333"
                anchorX="left"
                anchorY="middle"
              >
                {track.name}
              </Text>
            </group>
          );
        })}
      </group>
    </RegionContent>
  );
}

// Example timeline with keyframes
function TimelineContent() {
  const keyframes = [
    { time: 0, track: 0 },
    { time: 500, track: 1 },
    { time: 1000, track: 0 },
    { time: 1500, track: 2 },
    { time: 2000, track: 1 },
  ];

  return (
    <RegionContent regionId={DATA_VISUALIZATION_REGIONS.TIMELINE} padding={{ left: 8, right: 8 }}>
      <group>
        {keyframes.map((keyframe, index) => {
          const x = (keyframe.time / 2500) * 200 - 100; // Map time to x position
          const y = 0;

          return (
            <group key={index}>
              {/* Keyframe diamond */}
              <mesh position={[x, y, 1]} rotation={[0, 0, Math.PI / 4]}>
                <planeGeometry args={[6, 6]} />
                <meshBasicMaterial color="#ff9f43" />
              </mesh>

              {/* Connection line to next keyframe */}
              {index < keyframes.length - 1 && (
                <mesh position={[x + 10, y, 0]}>
                  <planeGeometry args={[20, 1]} />
                  <meshBasicMaterial color="#ddd" />
                </mesh>
              )}
            </group>
          );
        })}

        {/* Playhead */}
        <mesh position={[0, 0, 2]}>
          <planeGeometry args={[2, 30]} />
          <meshBasicMaterial color="#e74c3c" />
        </mesh>
      </group>
    </RegionContent>
  );
}

// Example minimap showing overview
function MinimapContent() {
  return (
    <RegionContent regionId={DATA_VISUALIZATION_REGIONS.MINIMAP} padding={{ left: 8, right: 8 }}>
      <group>
        {/* Minimap timeline representation */}
        <mesh position={[0, 0, 1]}>
          <planeGeometry args={[200, 20]} />
          <meshBasicMaterial color="#34495e" transparent opacity={0.3} />
        </mesh>

        {/* Viewport indicator */}
        <mesh position={[0, 0, 2]}>
          <planeGeometry args={[40, 20]} />
          <meshBasicMaterial color="#3498db" transparent opacity={0.5} />
        </mesh>

        {/* Border */}
        <mesh position={[0, 10, 1]}>
          <planeGeometry args={[200, 1]} />
          <meshBasicMaterial color="#2c3e50" />
        </mesh>
        <mesh position={[0, -10, 1]}>
          <planeGeometry args={[200, 1]} />
          <meshBasicMaterial color="#2c3e50" />
        </mesh>
      </group>
    </RegionContent>
  );
}

export interface DataVisualizationContentExampleProps {
  className?: string;
  showDebug?: boolean;
}

export function DataVisualizationContentExample({
  className,
  showDebug = false,
}: DataVisualizationContentExampleProps): ReactNode {
  return (
    <Canvas
      className={className}
      orthographic
      camera={{
        position: [0, 0, 100],
        up: [0, 1, 0],
        zoom: 1,
      }}
    >
      <LayoutProvider config={DEFAULT_DATA_VISUALIZATION_LAYOUT}>
        {/* Background regions for visual structure */}
        <RegionBackground
          regionId={DATA_VISUALIZATION_REGIONS.TOP_RULER}
          color={getDataVisualizationRegionColor(DATA_VISUALIZATION_REGIONS.TOP_RULER)}
          opacity={0.3}
        />
        <RegionBackground
          regionId={DATA_VISUALIZATION_REGIONS.TRACK_LIST}
          color={getDataVisualizationRegionColor(DATA_VISUALIZATION_REGIONS.TRACK_LIST)}
          opacity={0.3}
        />
        <RegionBackground
          regionId={DATA_VISUALIZATION_REGIONS.TIMELINE}
          color={getDataVisualizationRegionColor(DATA_VISUALIZATION_REGIONS.TIMELINE)}
          opacity={0.3}
        />
        <RegionBackground
          regionId={DATA_VISUALIZATION_REGIONS.MINIMAP}
          color={getDataVisualizationRegionColor(DATA_VISUALIZATION_REGIONS.MINIMAP)}
          opacity={0.3}
        />
        <RegionBackground
          regionId={DATA_VISUALIZATION_REGIONS.BOTTOM_RULER}
          color={getDataVisualizationRegionColor(DATA_VISUALIZATION_REGIONS.BOTTOM_RULER)}
          opacity={0.3}
        />

        {/* Borders for visual separation */}
        <RegionBorder
          regionId={DATA_VISUALIZATION_REGIONS.TOP_RULER}
          color="#cccccc"
          thickness={1}
        />
        <RegionBorder
          regionId={DATA_VISUALIZATION_REGIONS.TRACK_LIST}
          color="#cccccc"
          thickness={1}
        />
        <RegionBorder
          regionId={DATA_VISUALIZATION_REGIONS.TIMELINE}
          color="#cccccc"
          thickness={1}
        />
        <RegionBorder regionId={DATA_VISUALIZATION_REGIONS.MINIMAP} color="#cccccc" thickness={1} />
        <RegionBorder
          regionId={DATA_VISUALIZATION_REGIONS.BOTTOM_RULER}
          color="#cccccc"
          thickness={1}
        />

        {/* Content for each region */}
        <RulerContent regionId={DATA_VISUALIZATION_REGIONS.TOP_RULER} />
        <TrackListContent />
        <TimelineContent />
        <MinimapContent />
        <RulerContent regionId={DATA_VISUALIZATION_REGIONS.BOTTOM_RULER} />

        {/* Lighting */}
        <ambientLight intensity={1} />

        {/* Debug overlay */}
        {showDebug && <LayoutDebug />}
      </LayoutProvider>
    </Canvas>
  );
}

// Example of how to create a custom layout variant
export function CompactDataVisualizationExample({ className }: { className?: string }): ReactNode {
  const compactLayout = {
    ...DEFAULT_DATA_VISUALIZATION_LAYOUT,
    rows: [
      { value: 24, unit: "px" }, // Smaller top ruler
      { value: 1, unit: "fr" }, // Track list
      { value: 28, unit: "px" }, // Smaller timeline
    ],
    regions: [
      {
        id: DATA_VISUALIZATION_REGIONS.TOP_RULER,
        gridRow: "1 / 2",
        gridColumn: "1 / 2",
      },
      {
        id: DATA_VISUALIZATION_REGIONS.TRACK_LIST,
        gridRow: "2 / 3",
        gridColumn: "1 / 2",
      },
      {
        id: DATA_VISUALIZATION_REGIONS.TIMELINE,
        gridRow: "3 / 4",
        gridColumn: "1 / 2",
      },
    ],
  } as any;

  return (
    <Canvas
      className={className}
      orthographic
      camera={{
        position: [0, 0, 100],
        up: [0, 1, 0],
        zoom: 1,
      }}
    >
      <LayoutProvider config={compactLayout}>
        <RegionBackground
          regionId={DATA_VISUALIZATION_REGIONS.TOP_RULER}
          color="lightblue"
          opacity={0.5}
        />
        <RegionBackground
          regionId={DATA_VISUALIZATION_REGIONS.TRACK_LIST}
          color="lightyellow"
          opacity={0.5}
        />
        <RegionBackground
          regionId={DATA_VISUALIZATION_REGIONS.TIMELINE}
          color="lightcoral"
          opacity={0.5}
        />

        <RulerContent regionId={DATA_VISUALIZATION_REGIONS.TOP_RULER} />
        <TrackListContent />
        <TimelineContent />

        <ambientLight intensity={1} />
      </LayoutProvider>
    </Canvas>
  );
}
