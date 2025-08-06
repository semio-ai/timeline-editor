import { Canvas, useFrame, useThree, Color as RColor } from "@react-three/fiber";
import { Hud, Instance, Instances, OrthographicCamera } from "@react-three/drei";
import { MotionValue } from "motion";
import { createContext, useContext, useState, useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import type { Color } from "three";
import { useColors } from "../../hooks";
import { PanZoomControls } from "./controls/pan-zoom-controls";
import { useOrthoCameraSetup } from "../../hooks/useOrthoCameraSetup";
import { Theme } from "@semio/ui";

function HudSection({
  position,
  pixelHeight,
  children,
  renderPriority = 0,
  gap = 0,
  backgroundColor,
}: {
  position: "top" | "bottom";
  pixelHeight: number;
  backgroundColor?: string;
  children: React.ReactNode;
  renderPriority?: number;
  gap?: number;
}) {
  useOrthoCameraSetup();
  const { size, camera } = useThree();

  const [y, hudHeight] = useMemo(() => {
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      // Calculate the visible world height
      const worldHeight = orthoCamera.top - orthoCamera.bottom;

      // Convert pixel height and gap to world units
      const hudWorldHeight = (pixelHeight / size.height) * worldHeight;
      const gapWorld = (gap / size.height) * worldHeight;

      // Y position: top HUD is at camera.top - half HUD height - gap, bottom HUD is at camera.bottom + half HUD height + gap
      const y0 =
        position === "top"
          ? orthoCamera.top - hudWorldHeight / 2 - gapWorld
          : orthoCamera.bottom + hudWorldHeight / 2 + gapWorld;

      return [y0, hudWorldHeight];
    } else {
      return [0, pixelHeight];
    }
  }, [camera, pixelHeight, size, position, gap]);

  useEffect(() => {
    console.log("HudSection updated", { position, sizeheight: size.height, hudHeight, y });
  }, [size.height, hudHeight, y, position]);

  return (
    <Hud renderPriority={renderPriority}>
      <group
        position={[0, y, 0]}
        onWheel={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background */}
        <OrthographicCamera
          makeDefault
          position={[0, 0, 100]}
          up={[0, 1, 0]}
          left={0}
          right={1}
          near={0.1}
          far={1000}
          manual
        />
        {backgroundColor && (
          <mesh position={[0.5, y, -1]}>
            <planeGeometry args={[1, hudHeight]} />
            <meshBasicMaterial color={backgroundColor} />
          </mesh>
        )}
        <group position={[0, y, -1]}>{children}</group>
      </group>
    </Hud>
  );
}

export function CanvasSheet({
  tracks = [],
  selection = [],
  scrollValue,
  theme = Theme.Light,
}: {
  tracks?: string[];
  selection?: string[];
  scrollValue?: MotionValue<number>;
  theme?: Theme.Dark | Theme.Light;
}) {
  const bgColor = theme === Theme.Dark ? "#202020" : "#EFEFEF";

  return (
    <DataProvider initial={DEFAULT_DATAPOINTS}>
      <Canvas
        className="w-full h-full"
        flat
        orthographic
        camera={{
          position: [0, 0, 100],
          up: [0, 1, 0],
          left: 0,
          right: 1,
          top: 16,
          bottom: -16,
          near: 0.1,
          far: 1000,
          manual: true,
        }}
        gl={{
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping,
          antialias: true,
        }}
      >
        <ambientLight intensity={1} />
        <TrackList tracks={tracks} scrollValue={scrollValue} topOffsetPx={32} />

        {/* Top HUD: 32px tall */}
        <HudSection position="top" pixelHeight={32} backgroundColor={bgColor} renderPriority={1}>
          <DataPointsRenderer height={32} />
          <PanZoomControls bounds={[0, 1]} />
        </HudSection>

        {/* Timeline HUD: 36px tall */}
        <HudSection
          position="bottom"
          pixelHeight={36}
          backgroundColor={bgColor}
          renderPriority={2}
          gap={72}
        >
          <DataPointsRenderer height={36} tracks={selection} />
          <PanZoomControls bounds={[0, 1]} />
        </HudSection>

        {/* Bottom HUD: 108px tall */}
        <HudSection position="bottom" pixelHeight={72} backgroundColor={bgColor} renderPriority={3}>
          <DataPointsRenderer height={72} />
          {/*<PanZoomControls bounds={[0, 1]} />*/}
        </HudSection>
      </Canvas>
    </DataProvider>
  );
}

function TrackList({
  tracks = [],
  trackHeight = 36,
  scrollValue,
  topOffsetPx = 32, // NEW: pixel offset from top (default 32px for top HUD)
}: {
  tracks?: string[];
  trackHeight?: number;
  scrollValue?: MotionValue<number>;
  topOffsetPx?: number;
}) {
  // Ensure ortho camera bounds are set before layout math
  useOrthoCameraSetup();
  const { size, camera } = useThree();

  // Compute world Y position for the top of the TrackList
  const [y, trackWorldHeight] = useMemo(() => {
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const worldHeight = orthoCamera.top - orthoCamera.bottom;
      const offsetWorld = (topOffsetPx / size.height) * worldHeight;
      const trackWorldHeight0 = (trackHeight / size.height) * worldHeight;
      // Y position is at top minus offset minus half a track (so first track is flush with HUD)
      const y0: number = orthoCamera.top - offsetWorld - trackWorldHeight0 / 2;
      return [y0, trackWorldHeight0];
    } else {
      return [0, trackHeight];
    }
  }, [camera, size, topOffsetPx, trackHeight]);

  return (
    <group position={[0, y, 0]}>
      {tracks.map((track, idx) => (
        <DataPointsRenderer
          key={track}
          height={trackHeight}
          tracks={[track]}
          offset={-trackWorldHeight * idx}
        />
      ))}
      <PanZoomControls bounds={[0, 1]} />
    </group>
  );
}

const PALETTE: (string | Color)[] = [
  // List the tailwind colors we want to use (in hex/rgb format)
  // oklch(63.7% 0.237 25.331)
  // oklch(0.705 0.213 47.604)
  // oklch(0.795 0.184 86.046997)
  // oklch(0.723 0.219 149.578995)
  // oklch(0.588 0.158 241.966003)
  // oklch(0.606 0.25 292.71701)
  // oklch(0.656 0.241 354.308014)
  "#fb2c36",
  "#ff6900",
  "#f0b100",
  "#00c950",
  "#0084d1",
  "#8e51ff",
  new THREE.Color("rgb(246, 51, 154)"),
];

interface Data {
  id: string;
  x: number;
  y: number;
  color: RColor;
}

const DEFAULT_DATAPOINTS: Data[] = [
  { id: "0", x: 0.0, y: 0, color: PALETTE[1] as RColor },
  { id: "1", x: 0.1, y: 0, color: PALETTE[0] as RColor },
  { id: "2", x: 0.125, y: 0, color: PALETTE[4] as RColor },
  { id: "3", x: 0.14, y: 0, color: PALETTE[2] as RColor },
  { id: "4", x: 0.15, y: 0, color: PALETTE[6] as RColor },
  { id: "5", x: 0.16, y: 0, color: PALETTE[4] as RColor },
  { id: "6", x: 0.2, y: 0, color: PALETTE[3] as RColor },
  { id: "7", x: 0.3, y: 0, color: PALETTE[5] as RColor },
  { id: "8", x: 0.4, y: 0, color: PALETTE[2] as RColor },
  { id: "9", x: 0.9, y: 0, color: PALETTE[1] as RColor },
];

export function DataPoint({ x, color }: Data) {
  const instanceRef = useRef<THREE.Object3D>(null);

  useFrame(({ viewport, camera }) => {
    if (instanceRef.current) {
      const baseWidth = viewport.width; // Use actual viewport width as base
      const currentWidth =
        (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
      const scaleFactor = currentWidth / baseWidth;

      instanceRef.current.scale.set(scaleFactor, 1, 1);
    }
  });

  const colorProp: Color | undefined = useMemo(() => {
    if (typeof color === "string") {
      return new THREE.Color(color);
    }
    return color instanceof THREE.Color ? color : undefined;
  }, [color]);

  return (
    <Instance
      ref={instanceRef}
      position={[x, 0, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      // eslint-dissable-next-line
      color={colorProp as RColor | undefined}
    />
  );
}

export function DataPointsRenderer({
  height = 36,
  tracks = [],
  offset = 0,
}: {
  height?: number;
  tracks?: string[];
  offset?: number;
}) {
  const color = useColors(tracks);
  const allData = useData();

  return (
    <group position={[0, offset, 0]}>
      <Instances limit={1000} range={allData.length}>
        {/* Shared geometry and material for all instances */}
        <cylinderGeometry args={[5, 5, 1, 6]} />
        <meshBasicMaterial toneMapped={false} />

        {/* Individual instances */}
        {allData.map((point) => (
          <DataPoint key={point.id} id={point.id} x={point.x} y={point.y} color={color} />
        ))}
      </Instances>
      {tracks.length > 0 && (
        <mesh position={[0.5, 0, -0.5]}>
          <planeGeometry args={[1, height]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  );
}

export interface DataContextType {
  data: Data[];
  setData: (data: Data[]) => void | ((prevData: Data[]) => Data[]);
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

// Function overloads for proper type discrimination
export function useData(): Data[];
export function useData(id: string): Data | undefined;
export function useData(id?: string): Data[] | Data | undefined {
  const context = useContext(DataContext);

  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }

  if (id) {
    return context.data.find((item) => item.id === id);
  }

  return context.data;
}

export function DataProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Data[];
}) {
  const [data, setData] = useState<Data[]>(initial ?? []);

  return <DataContext.Provider value={{ data, setData }}>{children}</DataContext.Provider>;
}
