import { useMemo, useRef, useEffect, memo } from "react";
import { Hud } from "@react-three/drei";
import { useMotionValueEvent, useTransform } from "motion/react";
import { usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/shallow";
import { ThreeEvent, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { usePlayerSubscription } from "../../hooks";
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
        <group
          onWheel={(e) => e.stopPropagation()}
          onClick={(e) => {
            // Only stop propagation for click events that would interfere with pan/zoom
            // Allow pointer events to propagate for tooltip system
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
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

  useEffect(() => {
    camera.updateProjectionMatrix();
    set({ camera: camera as any });
  });

  useMotionValueEvent(size.height, "change", (height) => {
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  });

  useMotionValueEvent(size.width, "change", (width) => {
    const viewport = usePlayerStore.getState().player.viewport;
    if (width > 0) {
      const dataViewport: [number, number] = fixedCamera ? [0, 1] : (viewport as [number, number]);
      const { left, right } = calculatePaddedFrustum(dataViewport, width, fixedCamera);
      camera.left = left;
      camera.right = right;
      camera.updateProjectionMatrix();
    }
  });

  usePlayerSubscription(
    (state) => state.player.viewport,
    (viewport) => {
      if (size.width.get() > 0) {
        const dataViewport: [number, number] = fixedCamera
          ? [0, 1]
          : (viewport as [number, number]);
        const { left, right } = calculatePaddedFrustum(dataViewport, size.width.get(), fixedCamera);
        camera.left = left;
        camera.right = right;
        camera.updateProjectionMatrix();
      }
    },
  );

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
