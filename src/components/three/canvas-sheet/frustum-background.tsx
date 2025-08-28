import { memo, useEffect, useRef } from "react";
import { MotionValue, useMotionValueEvent, useSpring } from "motion/react";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { useInvariantScale } from "../../../hooks";
import { TIMELINE_PADDING } from "../../../constants";
import { getBackgroundElementProps, getEmphasisOpacity, ThemeMode } from "../../../functions";

interface FrustumBackgroundProps {
  color?: string;
  height: number;
  visibility?: "opaque" | "transparent" | "responsive";
  y?: MotionValue<number>;
  z?: number;
  onHoverChange?: (hovered: boolean) => void;
  pointerEvents?: Record<string, any>;
  emphasis?: boolean;
  theme?: ThemeMode;
}

export const FrustumBackground = memo(function FrustumBackground({
  color,
  height,
  visibility = "responsive",
  y = new MotionValue(0),
  z = -1,
  onHoverChange,
  pointerEvents = {},
  emphasis = false,
  theme = Theme.Light,
}: FrustumBackgroundProps) {
  const bgRef = useRef<THREE.Mesh>(null);

  const invariantScale = useInvariantScale();

  useMotionValueEvent(invariantScale, "change", (s) => {
    if (bgRef.current) {
      bgRef.current.scale.x = 1 + 2 * TIMELINE_PADDING * s;
    }
  });

  const targetOpacity = getTargetOpacity(visibility, emphasis, theme);
  const opacityMotion = useSpring(targetOpacity, {
    stiffness: 300,
    damping: 30,
  });

  // Get theme-aware color
  const { color: finalColor } = getBackgroundElementProps(
    color || "#888888",
    1.0, // We'll handle opacity separately for animation
    theme,
    false, // Use highlight color processing
  );

  useEffect(() => {
    opacityMotion.set(targetOpacity);
  }, [emphasis, opacityMotion, targetOpacity, theme]);

  useMotionValueEvent(opacityMotion, "change", (newValue) => {
    if (bgRef.current?.material as THREE.MeshBasicMaterial) {
      (bgRef.current?.material as THREE.MeshBasicMaterial).opacity = newValue;
    }
  });

  useMotionValueEvent(y, "change", (yVal) => {
    if (bgRef.current) {
      bgRef.current.position.y = yVal;
    }
  });

  return (
    <mesh
      ref={bgRef as any}
      position={[0.5, y.get(), z]}
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
        color={finalColor}
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
  theme: ThemeMode,
): number {
  if (visibility === "opaque") return 1;
  if (visibility === "transparent") return 0;

  // Use theme-aware opacity calculation
  return getEmphasisOpacity(0.1, 0.3, emphasis, theme);
}
