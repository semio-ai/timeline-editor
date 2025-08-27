import { memo, useEffect, useRef } from "react";
import { useMotionValueEvent, useSpring } from "motion/react";
import * as THREE from "three";
import { useInvariantScale } from "../../../hooks";
import { TIMELINE_PADDING } from "../../../constants";

interface FrustumBackgroundProps {
  color?: string;
  height: number;
  visibility?: "opaque" | "transparent" | "responsive";
  position?: [number, number, number];
  onHoverChange?: (hovered: boolean) => void;
  pointerEvents?: Record<string, any>;
  emphasis?: boolean;
}

export const FrustumBackground = memo(function FrustumBackground({
  color,
  height,
  visibility = "responsive",
  position = [0.5, 0, -1],
  onHoverChange,
  pointerEvents = {},
  emphasis = false,
}: FrustumBackgroundProps) {
  const bgRef = useRef<THREE.Mesh>(null);

  const invariantScale = useInvariantScale();

  useMotionValueEvent(invariantScale, "change", (s) => {
    if (bgRef.current) {
      bgRef.current.scale.x = 1 + 2 * TIMELINE_PADDING * s;
    }
  });

  const targetOpacity = getTargetOpacity(visibility, emphasis);
  const opacityMotion = useSpring(targetOpacity, {
    stiffness: 300,
    damping: 30,
  });

  useEffect(() => {
    opacityMotion.set(targetOpacity);
  }, [emphasis, opacityMotion, targetOpacity]);

  useMotionValueEvent(opacityMotion, "change", (newValue) => {
    if (bgRef.current?.material as THREE.MeshBasicMaterial) {
      (bgRef.current?.material as THREE.MeshBasicMaterial).opacity = newValue;
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
        transparent={visibility !== "opaque"}
        opacity={opacityMotion.get()}
        toneMapped={false}
      />
    </mesh>
  );
});

function getTargetOpacity(
  visibility: "opaque" | "transparent" | "responsive",
  emphasis: boolean,
): number {
  if (visibility === "opaque") return 1;
  if (visibility === "transparent") return 0;
  // responsive
  return emphasis ? 0.3 : 0.1;
}
