import { Hud, OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useMemo, useRef, useEffect, memo } from "react";
import * as THREE from "three";
import { useOrthoCameraSetup, usePlayerSubscription } from "../../../hooks";
import { calculatePaddedFrustum } from "../../../viewport-utils";
import { FrustumBackground } from "./frustum-background";

interface HudSectionProps {
  position: "top" | "bottom";
  pixelHeight: number;
  backgroundColor?: string;
  children?: React.ReactNode;
  renderPriority?: number;
  gap?: number;
  fixedCamera?: boolean;
}

export const HudSection = memo(function HudSection({
  position,
  pixelHeight,
  children,
  renderPriority = 0,
  gap = 0,
  backgroundColor,
  fixedCamera = false,
}: HudSectionProps) {
  const { size } = useThree();

  const cameraRef = useRef<THREE.OrthographicCamera>(null);

  useOrthoCameraSetup(cameraRef.current ?? undefined);

  // Initialize camera bounds immediately on mount to prevent timing issues
  useEffect(() => {
    if (cameraRef.current && size.width > 0) {
      const orthoCamera = cameraRef.current;
      const dataViewport: [number, number] = fixedCamera ? [0, 1] : [0, 1]; // Use default viewport for initial setup
      const { left, right } = calculatePaddedFrustum(dataViewport, size.width, fixedCamera);
      orthoCamera.left = left;
      orthoCamera.right = right;
      orthoCamera.updateProjectionMatrix();
    }
  }, [size.width, fixedCamera]); // Run when canvas size is available

  usePlayerSubscription(
    (state) => state.player.viewport,
    (viewport) => {
      if (cameraRef.current && size.width > 0) {
        const orthoCamera = cameraRef.current;
        const dataViewport: [number, number] = fixedCamera
          ? [0, 1]
          : (viewport as [number, number]);
        const { left, right } = calculatePaddedFrustum(dataViewport, size.width, fixedCamera);
        orthoCamera.left = left;
        orthoCamera.right = right;
        orthoCamera.updateProjectionMatrix();
      }
    },
  );

  const [top, bottom] = [cameraRef.current?.top ?? 0, cameraRef.current?.bottom ?? 0];

  const [y, hudHeight] = useMemo(() => {
    if (cameraRef.current) {
      // Calculate the visible world height
      const worldHeight = top - bottom;

      // Convert pixel height and gap to world units
      const hudWorldHeight = (pixelHeight / size.height) * worldHeight;
      const gapWorld = (gap / size.height) * worldHeight;

      // Y position: gap is always from the edge of the canvas
      const y0 =
        position === "top"
          ? top - gapWorld - hudWorldHeight / 2
          : bottom + gapWorld + hudWorldHeight / 2;

      return [y0, hudWorldHeight];
    } else {
      return [0, pixelHeight];
    }
  }, [top, bottom, pixelHeight, size.height, position, gap]);

  return (
    <Hud renderPriority={renderPriority}>
      <group
        position={[0, y, 0]}
        onWheel={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background */}
        <OrthographicCamera
          ref={cameraRef as any}
          makeDefault
          position={[0, 0, 100]}
          up={[0, 1, 0]}
          near={0.1}
          far={1000}
          manual
        />
        {backgroundColor && (
          <FrustumBackground
            color={backgroundColor}
            height={hudHeight}
            opacity={1}
            position={[0.5, y, -1]}
          />
        )}
        <group position={[0, y, -1]}>{children}</group>
      </group>
    </Hud>
  );
});
