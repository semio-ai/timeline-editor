import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";

import * as THREE from "three";
import { type Data } from "./data-context";
import { DataProvider } from "./data-provider";
import { DataPointsRenderer } from "./data-points-renderer";
import { GridBackground } from "./grid-background";
import { PanZoomControls } from "./controls";

const PALETTE: (string | THREE.Color)[] = [
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

const DEFAULT_DATAPOINTS: Data[] = [
  { id: "0", x: -300, y: 0, color: PALETTE[1] },
  { id: "1", x: -100, y: 0, color: PALETTE[0] },
  { id: "2", x: -50, y: 0, color: PALETTE[4] },
  { id: "3", x: 0, y: 0, color: PALETTE[2] },
  { id: "4", x: 50, y: 0, color: PALETTE[6] },
  { id: "5", x: 160, y: 0, color: PALETTE[4] },
  { id: "6", x: 200, y: 0, color: PALETTE[3] },
  { id: "7", x: 300, y: 0, color: PALETTE[5] },
  { id: "8", x: 400, y: 0, color: PALETTE[2] },
  { id: "9", x: 500, y: 0, color: PALETTE[1] },
];

export function Track() {
  return (
    <DataProvider initial={DEFAULT_DATAPOINTS}>
      <div style={{ width: "100%", height: "100%" }}>
        <Canvas
          flat
          orthographic
          camera={{
            position: [0, 0, 100],
            up: [0, 1, 0],
            left: -350,
            right: 550,
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
            // legacy: false,
          }}
        >
          <TrackScene />
        </Canvas>
      </div>
    </DataProvider>
  );
}

function CameraManager() {
  const { camera } = useThree();

  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      // Ensure camera is set to manual mode to prevent R3F auto-resizing
      if ("manual" in camera) {
        (camera as THREE.OrthographicCamera & { manual?: boolean }).manual =
          true;
      }

      // Explicitly initialize camera frustum to match Canvas props
      camera.left = -350;
      camera.right = 550;
      camera.top = 16;
      camera.bottom = -16;
      camera.near = 0.1;
      camera.far = 1000;

      // Ensure camera position and orientation
      camera.position.set(0, 0, 100);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);

      // Force update projection matrix
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  return null;
}

function TrackScene() {
  return (
    <>
      <CameraManager />

      {/* Pan/Zoom Controls for timeline navigation
          - Only horizontal wheel scrolling triggers panning (vertical scrolling is ignored)
          - Touch pinch gestures handle zooming
          - panSpeed: controls horizontal scroll sensitivity
          - zoomSpeed: controls pinch zoom sensitivity
          - minZoom/maxZoom: limits how far you can zoom in/out */}
      <PanZoomControls
        enabled={true}
        enablePan={true}
        enableZoom={true}
        panSpeed={2.0} // Slightly more responsive for smooth timeline navigation
        zoomSpeed={1.2} // Slightly more responsive zoom
        minZoom={0.05} // Allow zooming out further to see more timeline
        maxZoom={20} // Allow zooming in closer for precision
      />
      {/* Add your track components here */}
      <ambientLight intensity={1} />
      <GridBackground />
      <DataPointsRenderer />
    </>
  );
}
