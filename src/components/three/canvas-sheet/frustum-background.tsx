import { memo, useRef } from "react";
import { useMotionValueEvent } from "motion/react";
import * as THREE from "three";
import { useInvariantScale } from "../../../hooks";
import { TIMELINE_PADDING } from "../../../constants";

interface FrustumBackgroundProps {
  color?: string;
  height: number;
  opacity?: number;
  position?: [number, number, number];
  onHoverChange?: (hovered: boolean) => void;
  pointerEvents?: Record<string, any>;
}

export const FrustumBackground = memo(function FrustumBackground({
  color,
  height,
  opacity = 1,
  position = [0.5, 0, -1],
  onHoverChange,
  pointerEvents = {},
}: FrustumBackgroundProps) {
  const bgRef = useRef<THREE.Mesh>(null);

  const invariantScale = useInvariantScale();

  useMotionValueEvent(invariantScale, "change", (s) => {
    if (bgRef.current) {
      bgRef.current.scale.x = 1 + 2 * TIMELINE_PADDING * s;
    }
  });

  return (
    <mesh
      ref={bgRef as any}
      position={position}
      {...pointerEvents}
      onPointerOver={(e) => {
        onHoverChange?.(true);
        pointerEvents.onPointerOver?.(e);
      }}
      onPointerOut={() => {
        onHoverChange?.(false);
        pointerEvents.onPointerOut?.();
      }}
    >
      {/* Use a width of 3 to ensure full frustum coverage including padding */}
      <planeGeometry args={[1, height]} />
      <meshBasicMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  );
});
