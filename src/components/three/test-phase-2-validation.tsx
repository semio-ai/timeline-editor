import type { ReactNode } from "react";
import { useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Hud } from "@react-three/drei";
import { LayoutProvider, useRegion } from "./layout";
import {
  DEFAULT_DATA_VISUALIZATION_LAYOUT,
  DATA_VISUALIZATION_REGIONS,
} from "./data-visualization-layout-config";
import { MainSceneCameraController, HUDCameraController } from "./cameras";
import { useCameraSync, useCanvasZoomGestures } from "../../hooks";
import type { RegionBounds } from "./layout/types";

/**
 * Phase 2 Validation Test Component
 *
 * This component validates the camera synchronization and gesture integration
 * implemented in Phase 2. It provides visual feedback for:
 *
 * 1. Camera sync state (zoom, pan, viewport)
 * 2. Gesture handling (zoom/pan gestures)
 * 3. HUD region synchronization
 * 4. Visual content that responds to camera changes
 */
export function Phase2ValidationTest(): ReactNode {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [trackListBounds, setTrackListBounds] = useState<RegionBounds | null>(null);

  return (
    <div className="w-full h-96 border-2 border-blue-500 relative">
      <div className="absolute top-2 left-2 z-10 bg-white p-2 rounded shadow text-xs">
        <h3 className="font-bold">Phase 2 Validation</h3>
        <CameraStateDisplay />
      </div>

      <div ref={canvasRef} className="w-full h-full">
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
            {/* Main Scene Camera Controller */}
            <MainSceneCameraController enabled={true} />

            {/* Main Scene Content */}
            <TestTrackContent />

            {/* HUD Layer 1 - Top Test Region */}
            <Hud renderPriority={1}>
              <HUDCameraController enabled={true} />
              <TestHUDContent layer={1} color="cyan" />
            </Hud>

            {/* HUD Layer 2 - Timeline Test Region */}
            <Hud renderPriority={2}>
              <HUDCameraController enabled={true} />
              <TestHUDContent layer={2} color="orange" />
            </Hud>

            <ambientLight intensity={1} />

            {/* Bounds provider - gets layout bounds and updates state */}
            <TestBoundsProvider onBoundsChange={setTrackListBounds} />
          </LayoutProvider>
        </Canvas>

        <GestureHandler canvasRef={canvasRef} bounds={trackListBounds} />
      </div>
    </div>
  );
}

/**
 * Displays current camera sync state for debugging
 */
function CameraStateDisplay(): ReactNode {
  const { zoom, pan, viewport } = useCameraSync();

  return (
    <div className="space-y-1">
      <div>Zoom: {zoom.toFixed(2)}x</div>
      <div>Pan X: {pan.x.toFixed(3)}</div>
      <div>
        Viewport: [{viewport[0].toFixed(3)}, {viewport[1].toFixed(3)}]
      </div>
      <div className="text-xs text-gray-600 mt-2">Try: Mouse wheel to pan, Ctrl+wheel to zoom</div>
    </div>
  );
}

/**
 * Main scene content that responds to camera changes
 */
function TestTrackContent(): ReactNode {
  const trackListBounds = useRegion(DATA_VISUALIZATION_REGIONS.TRACK_LIST);
  const { viewport } = useCameraSync();

  if (!trackListBounds) {
    return null;
  }

  return (
    <>
      {/* Test background */}
      <mesh position={[0, 0, -1]}>
        <planeGeometry
          args={[trackListBounds.dimensions.width, trackListBounds.dimensions.height]}
        />
        <meshBasicMaterial color="#f0f0f0" transparent opacity={0.5} />
      </mesh>

      {/* Grid of test objects that should move with camera */}
      {Array.from({ length: 20 }, (_, i) => {
        const x =
          (i % 10) * (trackListBounds.dimensions.width / 10) - trackListBounds.dimensions.width / 2;
        const y = Math.floor(i / 10) * 50 - 25;

        return (
          <mesh key={i} position={[x, y, 0]}>
            <boxGeometry args={[20, 20, 10]} />
            <meshBasicMaterial color={`hsl(${(i * 36) % 360}, 70%, 50%)`} />
          </mesh>
        );
      })}

      {/* Viewport indicator */}
      <group position={[0, trackListBounds.dimensions.height / 2 - 20, 5]}>
        <mesh>
          <boxGeometry
            args={[trackListBounds.dimensions.width * (viewport[1] - viewport[0]), 10, 2]}
          />
          <meshBasicMaterial color="red" transparent opacity={0.7} />
        </mesh>
      </group>
    </>
  );
}

/**
 * HUD content that should sync horizontally with main camera
 */
function TestHUDContent({ layer, color }: { layer: number; color: string }): ReactNode {
  const bounds = useRegion(
    layer === 1 ? DATA_VISUALIZATION_REGIONS.TOP_RULER : DATA_VISUALIZATION_REGIONS.TIMELINE,
  );

  if (!bounds) {
    return null;
  }

  return (
    <>
      {/* HUD Background */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>

      {/* Synchronized ruler marks */}
      {Array.from({ length: 12 }, (_, i) => {
        const spacing = bounds.dimensions.width / 13;
        const x = -bounds.dimensions.width / 2 + (i + 1) * spacing;

        return (
          <mesh key={i} position={[x, 0, 0.1]}>
            <boxGeometry args={[1, bounds.dimensions.height * 0.6, 0.1]} />
            <meshBasicMaterial color="black" />
          </mesh>
        );
      })}

      {/* Layer identifier */}
      <mesh position={[-bounds.dimensions.width / 2 + 50, 0, 0.2]}>
        <boxGeometry args={[30, bounds.dimensions.height * 0.8, 0.1]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </>
  );
}

/**
 * Test bounds provider component - runs inside LayoutProvider and updates parent state
 */
function TestBoundsProvider({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: RegionBounds | null) => void;
}): ReactNode {
  const trackListBounds = useRegion(DATA_VISUALIZATION_REGIONS.TRACK_LIST);

  useEffect(() => {
    onBoundsChange(trackListBounds || null);
  }, [trackListBounds, onBoundsChange]);

  return null;
}

/**
 * Gesture handler for the test canvas
 */
function GestureHandler({
  canvasRef,
  bounds,
}: {
  canvasRef: React.RefObject<HTMLDivElement>;
  bounds: RegionBounds | null;
}): ReactNode {
  const gestureState = useCanvasZoomGestures(canvasRef, {
    bounds: bounds || {
      position: { x: 0, y: 0 },
      dimensions: { width: 800, height: 400 },
      center: { x: 0, y: 0 },
    },
    enabled: !!bounds,
  });

  return null;
}

/**
 * Simple validation checklist component
 */
export function Phase2ValidationChecklist(): ReactNode {
  const [checks, setChecks] = useState({
    cameraSync: false,
    gestureZoom: false,
    gesturePan: false,
    hudSync: false,
    visualFeedback: false,
  });

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3 className="font-bold mb-2">Phase 2 Validation Checklist</h3>
      <div className="space-y-2">
        {Object.entries(checks).map(([key, checked]) => (
          <label key={key} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleCheck(key as keyof typeof checks)}
            />
            <span className={checked ? "line-through text-green-600" : ""}>
              {getCheckDescription(key)}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <strong>All Checks Complete: </strong>
        <span className={Object.values(checks).every(Boolean) ? "text-green-600" : "text-red-600"}>
          {Object.values(checks).every(Boolean) ? "✅ PASS" : "❌ IN PROGRESS"}
        </span>
      </div>
    </div>
  );
}

function getCheckDescription(key: string): string {
  const descriptions = {
    cameraSync: "Camera sync hook provides correct zoom/pan/viewport state",
    gestureZoom: "Ctrl+wheel gesture controls zoom level",
    gesturePan: "Mouse wheel controls horizontal pan",
    hudSync: "HUD regions sync horizontally with main content",
    visualFeedback: "Visual content responds to camera changes",
  };

  return descriptions[key as keyof typeof descriptions] || key;
}
