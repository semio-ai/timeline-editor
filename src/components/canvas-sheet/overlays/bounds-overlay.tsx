import { Theme } from "@semio/ui";
import { memo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore, PlayerData } from "@semio/utils";
import {
  useMotionValue,
  useSpring,
  useTransform,
  useMotionValueEvent,
  MotionValue,
} from "motion/react";
import { shallow } from "zustand/shallow";
import { useFrame } from "@react-three/fiber";
import { isOrthographicCamera } from "@semio/utils";
import { useInvariantScale, useAnimationStore, usePlayerSubscription } from "../../../hooks";
import { AnimationData } from "../../../store-types";
import { SemanticTime } from "../../../types";
import { TIMELINE_PADDING, Z } from "../../../constants";

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
  const leftOverlayRef = useRef<THREE.Mesh>(null);
  const rightOverlayRef = useRef<THREE.Mesh>(null);

  // Get bounds springs
  const leftSpring = useMotionValue<number>(usePlayerStore.getState().player.bounds[0]);
  const rightSpring = useMotionValue<number>(usePlayerStore.getState().player.bounds[1]);

  usePlayerSubscription(
    (state: PlayerData) => state.player.bounds,
    (bounds: [number, number]) => {
      leftSpring.set(bounds[0]);
      rightSpring.set(bounds[1]);
    },
    shallow,
  );

  // Get invariant scale for zoom-independent sizing
  const invariantScale: MotionValue<number> = useInvariantScale();

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

  // Create overlay color (opposite of theme for deemphasis)
  const overlayColor = theme === Theme.Light ? "#ffffff" : "#000000";
  const overlayOpacity = 0.4;

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

  // Update all positions each frame — bounds markers, fill, and out-of-bounds overlays
  useFrame(({ camera }) => {
    if (!isOrthographicCamera(camera)) return;

    const leftPos = leftSpring.get();
    const rightPos = rightSpring.get();
    const s = invariantScale.get();

    // Bounds markers
    if (markerLeftRef.current) {
      markerLeftRef.current.position.x = leftPos;
      markerLeftRef.current.scale.x = s;
    }
    if (markerRightRef.current) {
      markerRightRef.current.position.x = rightPos;
      markerRightRef.current.scale.x = s;
    }

    // Fill between bounds
    if (fillRef.current) {
      const centerX = (leftPos + rightPos) / 2;
      const width = Math.abs(rightPos - leftPos);
      fillRef.current.position.x = centerX;
      fillRef.current.scale.x = width;
    }

    // Out-of-bounds overlays — extend from frustum edges to bounds
    const leftEdge = camera.left - TIMELINE_PADDING * s;
    const rightEdge = camera.right + TIMELINE_PADDING * s;

    if (leftOverlayRef.current) {
      const centerX = (leftEdge + leftPos) / 2;
      const width = Math.abs(leftPos - leftEdge);
      leftOverlayRef.current.position.x = centerX;
      leftOverlayRef.current.scale.x = width;
    }
    if (rightOverlayRef.current) {
      const centerX = (rightPos + rightEdge) / 2;
      const width = Math.abs(rightEdge - rightPos);
      rightOverlayRef.current.position.x = centerX;
      rightOverlayRef.current.scale.x = width;
    }
  });

  return (
    <>
      {/* Left overlay - deemphasizes content outside bounds */}
      <mesh
        ref={leftOverlayRef as any}
        position={[0, 0, Z.OutOfBoundsOverlay]}
        scale={[1, 1, 1]}
      >
        <planeGeometry args={[1, height]} />
        <meshBasicMaterial
          toneMapped={false}
          color={overlayColor}
          transparent
          opacity={overlayOpacity}
        />
      </mesh>
      {/* Right overlay - deemphasizes content outside bounds */}
      <mesh
        ref={rightOverlayRef as any}
        position={[0, 0, Z.OutOfBoundsOverlay]}
        scale={[1, 1, 1]}
      >
        <planeGeometry args={[1, height]} />
        <meshBasicMaterial
          toneMapped={false}
          color={overlayColor}
          transparent
          opacity={overlayOpacity}
        />
      </mesh>
      {/* Fill rectangle between bounds */}
      <mesh
        ref={fillRef as any}
        position={[(leftSpring.get() + rightSpring.get()) / 2, 0, Z.InBoundsOverlay]}
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
      <mesh ref={markerLeftRef as any} position={[leftSpring.get(), 0, Z.InBoundsOverlay]}>
        <planeGeometry args={[1.5, height]} />
        <meshBasicMaterial
          toneMapped={false}
          color={cartColor.get()}
          transparent
          opacity={anyPreview ? 1 : 0}
        />
      </mesh>
      {/* Right boundary line */}
      <mesh ref={markerRightRef as any} position={[rightSpring.get(), 0, Z.InBoundsOverlay]}>
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
