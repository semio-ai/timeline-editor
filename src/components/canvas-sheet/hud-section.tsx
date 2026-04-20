import { useEffect, useMemo, useRef, memo } from "react";
import { Hud } from "@react-three/drei";
import { useMotionValueEvent, useTransform } from "motion/react";
import { usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/shallow";
import { ThreeEvent, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Z } from "../../constants";
import { calculatePaddedFrustum } from "../../viewport-utils";
import { FrustumBackground } from "./frustum-background";
import { MotionCanvasProvider } from "./shared/motion-canvas-provider";
import { useMotionCanvas } from "./shared/motion-canvas-context";

interface HudSectionProps {
  label?: string;
  position: "top" | "bottom";
  pixelHeight: number;
  backgroundColor?: string;
  children?: React.ReactNode;
  renderPriority?: number;
  gap?: number;
  fixedCamera?: boolean;
}

export const HudSection = memo(function HudSection({
  label,
  position,
  pixelHeight,
  children,
  renderPriority = 0,
  gap = 0,
  backgroundColor,
  fixedCamera = false,
}: HudSectionProps) {
  return (
    <Hud renderPriority={renderPriority}>
      <MotionCanvasProvider label={label ?? `Hud-${renderPriority.toString()}`}>
        <group onWheel={(e) => e.stopPropagation()}>
          {/* Specialized Camera for HUDs */}
          <HudCamera
            fixedCamera={fixedCamera}
            label={label ?? `Hud-${renderPriority.toString()}`}
          />
          {/* Content */}
          <HudContent
            backgroundColor={backgroundColor}
            pixelHeight={pixelHeight}
            gap={gap}
            position={position}
          >
            {children}
          </HudContent>
        </group>
      </MotionCanvasProvider>
    </Hud>
  );
});

const HudContent = memo(function HudContent({
  children,
  backgroundColor,
  pixelHeight,
  gap,
  position,
}: {
  children?: React.ReactNode;
  backgroundColor?: string;
  pixelHeight: number;
  gap: number;
  position: "top" | "bottom";
}) {
  const { frustum, size } = useMotionCanvas();
  const groupRef = useRef<THREE.Group>(null);

  const y = useTransform(() => {
    return getY(
      frustum.top.get(),
      frustum.bottom.get(),
      size.height.get(),
      gap,
      pixelHeight,
      position,
    );
  });

  useMotionValueEvent(y, "change", (yVal) => {
    if (groupRef.current) {
      groupRef.current.position.y = yVal;
    }
  });

  return (
    <>
      {backgroundColor && (
        <FrustumBackground
          color={backgroundColor}
          height={pixelHeight}
          visibility="opaque"
          z={Z.Hud}
          y={y}
          pointerEvents={{ onPointerOver: (e: ThreeEvent<MouseEvent>) => e.stopPropagation() }}
        />
      )}
      <group ref={groupRef as any} position={[0, y.get(), 0]}>
        {children}
      </group>
    </>
  );
});

const HudCamera = memo(function HudCamera({
  fixedCamera = false,
  label,
}: {
  fixedCamera?: boolean;
  label: string;
  hudHeight?: number;
}) {
  const { size } = useMotionCanvas();

  const camera: THREE.OrthographicCamera & { manual?: boolean } = useMemo(() => {
    const height = size.height.get();
    const cam = new THREE.OrthographicCamera(0, 1, height / 2, -height / 2, 0.1, 1000);
    cam.position.set(0, 0, 100);
    cam.up.set(0, 1, 0);
    cam.updateProjectionMatrix();
    cam.name = label;
    (cam as any).manual = true;
    return cam;
  }, [size, label]);

  const set = useThree(useShallow((state) => state.set));

  // Set the camera once on mount
  useEffect(() => {
    camera.updateProjectionMatrix();
    set({ camera: camera as any });
  }, [camera, set]);

  useMotionValueEvent(size.height, "change", (height) => {
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  });

  // Store fixedCamera in a ref so the subscription callback is stable
  const fixedCameraRef = useRef(fixedCamera);
  fixedCameraRef.current = fixedCamera;

  const sizeRef = useRef(size);
  sizeRef.current = size;

  // Single effect for all player store subscriptions — stable callbacks
  useEffect(() => {
    const updateCam = () => {
      const width = sizeRef.current.width.get();
      if (width <= 0) return;
      let dataViewport: [number, number];
      if (fixedCameraRef.current) {
        const dur = usePlayerStore.getState().player.duration;
        dataViewport = [0, Math.max(dur, 1000)];
      } else {
        dataViewport = usePlayerStore.getState().player.viewport as [number, number];
      }
      const { left, right } = calculatePaddedFrustum(dataViewport, width, fixedCameraRef.current);
      camera.left = left;
      camera.right = right;
      camera.updateProjectionMatrix();
    };

    // Initial update
    updateCam();

    // Subscribe to viewport and duration changes
    const unsub1 = usePlayerStore.subscribe(
      (state) => state.player.viewport,
      () => {
        // Dynamic cameras track the viewport; fixed cameras don't need to update
        if (!fixedCameraRef.current) updateCam();
      },
    );
    const unsub2 = usePlayerStore.subscribe(
      (state) => state.player.duration,
      () => updateCam(),
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [camera]);

  useMotionValueEvent(size.width, "change", () => {
    const width = size.width.get();
    if (width <= 0) return;
    let dataViewport: [number, number];
    if (fixedCameraRef.current) {
      const dur = usePlayerStore.getState().player.duration;
      dataViewport = [0, Math.max(dur, 1000)];
    } else {
      dataViewport = usePlayerStore.getState().player.viewport as [number, number];
    }
    const { left, right } = calculatePaddedFrustum(dataViewport, width, fixedCameraRef.current);
    camera.left = left;
    camera.right = right;
    camera.updateProjectionMatrix();
  });

  return <primitive object={camera} />;
});

const getY = (
  top: number,
  bottom: number,
  height: number,
  gap: number,
  pixelHeight: number,
  position: "top" | "bottom",
): number => {
  const worldHeight = top - bottom;

  // Convert pixel height and gap to world units
  const hudWorldHeight = (pixelHeight / height) * worldHeight;
  const gapWorld = (gap / height) * worldHeight;

  // Y position: gap is always from the edge of the canvas
  return position === "top"
    ? top - gapWorld - hudWorldHeight / 2
    : bottom + gapWorld + hudWorldHeight / 2;
};
