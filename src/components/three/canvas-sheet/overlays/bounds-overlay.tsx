import { Theme } from "@semio/ui";
import { memo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore, PlayerData } from "@semio/utils";
import { useMotionValue, useSpring, useTransform, useMotionValueEvent } from "motion/react";
import { shallow } from "zustand/shallow";
import { useInvariantScale, useAnimationStore, usePlayerSubscription } from "../../../../hooks";
import { AnimationData } from "../../../../store-types";
import { SemanticTime } from "../../../../types";

// Theme colors matching the PlayheadCart approach
const BASE_COLORS = {
  dark: {
    active: 0.5,
    inactive: 0.25,
  },
  light: {
    active: 0.5,
    inactive: 0.75,
  },
};

export interface BoundsOverlayProps {
  height?: number;
  theme?: Theme.Dark | Theme.Light;
}

export const BoundsOverlay = memo(function BoundsOverlay({
  height = 36,
  theme = Theme.Light,
}: BoundsOverlayProps) {
  const markerLeftRef = useRef<THREE.Mesh>(null);
  const markerRightRef = useRef<THREE.Mesh>(null);
  const fillRef = useRef<THREE.Mesh>(null);

  // Get bounds springs
  const leftSpring = useMotionValue<number>(usePlayerStore.getState().player.bounds[0]);
  const rightSpring = useMotionValue<number>(usePlayerStore.getState().player.bounds[1]);

  usePlayerSubscription(
    (state: PlayerData) => state.player.bounds,
    (bounds) => {
      leftSpring.set(bounds[0]);
      rightSpring.set(bounds[1]);
    },
    shallow,
  );

  // Get invariant scale for zoom-independent sizing
  const invariantScale = useInvariantScale();

  const anyPreview = useAnimationStore(
    useShallow((state: AnimationData) =>
      Boolean(
        state.previews.find((p) => p.semanticTime === SemanticTime.BoundsStart) !== undefined ||
          state.previews.find((p) => p.semanticTime === SemanticTime.BoundsEnd) !== undefined,
      ),
    ),
  );

  // Create motion values for smooth transitions
  const brightness = useSpring(BASE_COLORS[theme][anyPreview ? "active" : "inactive"], {
    stiffness: 300,
    damping: 30,
  });

  useEffect(() => {
    brightness.set(BASE_COLORS[theme][anyPreview ? "active" : "inactive"]);
  }, [brightness, anyPreview, theme]);

  const cartColor = useTransform(brightness, [0, 1], ["#000000", "#ffffff"]);

  useMotionValueEvent(cartColor, "change", (color) => {
    if (markerLeftRef.current) {
      (markerLeftRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    }
    if (markerRightRef.current) {
      (markerRightRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    }
    if (fillRef.current) {
      (fillRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    }
  });

  // Update left position based on bound spring
  useMotionValueEvent(leftSpring, "change", (pos) => {
    if (markerLeftRef.current) {
      markerLeftRef.current.position.x = pos;
    }
    // Update fill position and scale
    if (fillRef.current) {
      const rightPos = rightSpring.get();
      const centerX = (pos + rightPos) / 2;
      const width = Math.abs(rightPos - pos);
      fillRef.current.position.x = centerX;
      fillRef.current.scale.x = width;
    }
  });

  // Update right position based on bound spring
  useMotionValueEvent(rightSpring, "change", (pos) => {
    if (markerRightRef.current) {
      markerRightRef.current.position.x = pos;
    }
    // Update fill position and scale
    if (fillRef.current) {
      const leftPos = leftSpring.get();
      const centerX = (leftPos + pos) / 2;
      const width = Math.abs(pos - leftPos);
      fillRef.current.position.x = centerX;
      fillRef.current.scale.x = width;
    }
  });

  // Update scale based on invariant scale
  useMotionValueEvent(invariantScale, "change", (s) => {
    if (markerLeftRef.current) {
      markerLeftRef.current.scale.x = s;
    }
    if (markerRightRef.current) {
      markerRightRef.current.scale.x = s;
    }
  });

  return (
    <>
      {/* Fill rectangle between bounds */}
      <mesh
        ref={fillRef as any}
        position={[(leftSpring.get() + rightSpring.get()) / 2, 0, 99]}
        scale={[Math.abs(rightSpring.get() - leftSpring.get()), 1, 1]}
      >
        <planeGeometry args={[1, height]} />
        <meshBasicMaterial
          toneMapped={false}
          color={cartColor.get()}
          transparent
          opacity={anyPreview ? 0.2 : 0}
        />
      </mesh>
      {/* Left boundary line */}
      <mesh ref={markerLeftRef as any} position={[leftSpring.get(), 0, 15]}>
        <planeGeometry args={[1.5, height]} />
        <meshBasicMaterial
          toneMapped={false}
          color={cartColor.get()}
          transparent
          opacity={anyPreview ? 1 : 0}
        />
      </mesh>
      {/* Right boundary line */}
      <mesh ref={markerRightRef as any} position={[rightSpring.get(), 0, 15]}>
        <planeGeometry args={[1.5, height]} />
        <meshBasicMaterial
          toneMapped={false}
          color={cartColor.get()}
          transparent
          opacity={anyPreview ? 1 : 0}
        />
      </mesh>
    </>
  );
});
