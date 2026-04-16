import { memo, useEffect, useRef } from "react";
import { MotionValue, useMotionValueEvent, useSpring } from "motion/react";
import { useShallow } from "zustand/shallow";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Theme } from "@semio/ui";
import { isOrthographicCamera } from "@semio/utils";
import { useAnimationStore } from "../../hooks";
import { getBackgroundElementProps, getEmphasisOpacity, ThemeMode } from "../../functions";

interface FrustumBackgroundProps {
  color?: string;
  height: number;
  visibility?: "opaque" | "transparent" | "responsive";
  y?: MotionValue<number>;
  z?: number;
  onHoverChange?: (hovered: boolean) => void;
  onTrackClick?: (modifiers: { ctrl: boolean; shift: boolean }) => void;
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
  onTrackClick,
  pointerEvents = {},
  emphasis = false,
  theme = Theme.Light,
}: FrustumBackgroundProps) {
  const bgRef = useRef<THREE.Mesh>(null);

  const clearSelection = useAnimationStore(useShallow((state) => state.clearSelection));
  const dragState = useAnimationStore(useShallow((state) => state.dragState));

  // Track if we just finished dragging to prevent clearing selection on drag end
  const justFinishedDraggingRef = useRef(false);

  useEffect(() => {
    // If dragState becomes undefined (drag ended), mark that we just finished dragging
    if (!dragState && justFinishedDraggingRef.current) {
      // Clear the flag after a short delay to allow the click event to be ignored
      const timer = setTimeout(() => {
        justFinishedDraggingRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
    // If dragState is active, mark that we're dragging
    if (dragState) {
      justFinishedDraggingRef.current = true;
    }
  }, [dragState]);

  // Use useFrame to position/scale the background to fill the camera frustum.
  // This runs once per frame and is more efficient than motion value listeners.
  useFrame(({ camera }) => {
    if (!bgRef.current || !isOrthographicCamera(camera)) return;
    const width = camera.right - camera.left;
    if (width <= 0) return;
    bgRef.current.position.x = (camera.left + camera.right) / 2;
    bgRef.current.scale.x = width;
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
      position={[0, y.get(), z]}
      {...pointerEvents}
      onPointerOver={(e) => {
        onHoverChange?.(true);
        pointerEvents.onPointerOver?.(e);
      }}
      onPointerOut={() => {
        onHoverChange?.(false);
        pointerEvents.onPointerOut?.();
      }}
      onClick={(e) => {
        // Don't handle clicks that ended a drag
        if (justFinishedDraggingRef.current) {
          pointerEvents.onClick?.(e);
          return;
        }
        // Delegate track selection to caller if provided
        if (onTrackClick) {
          onTrackClick({ ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
          e.stopPropagation();
        } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          clearSelection();
        }
        pointerEvents.onClick?.(e);
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
