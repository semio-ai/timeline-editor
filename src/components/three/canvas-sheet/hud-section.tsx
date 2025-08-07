import { Hud, OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useOrthoCameraSetup } from "../../../hooks";

interface HudSectionProps {
  position: "top" | "bottom";
  pixelHeight: number;
  backgroundColor?: string;
  children: React.ReactNode;
  renderPriority?: number;
  gap?: number;
}

export function HudSection({
  position,
  pixelHeight,
  children,
  renderPriority = 0,
  gap = 0,
  backgroundColor,
}: HudSectionProps) {
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
