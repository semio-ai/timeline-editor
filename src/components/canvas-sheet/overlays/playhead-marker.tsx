import { Theme } from "@semio/ui";
import { useRef, memo, useEffect } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/shallow";
import { useMotionValueEvent, useSpring, useTransform } from "motion/react";
import { usePlayheadSpring, useInvariantScale, useAnimationStore } from "../../../../hooks";
import { SemanticTime } from "../../../../types";
import { AnimationData } from "../../../../store-types";
import { Z } from "../../../../constants";

export interface PlayheadMarkerProps {
  height?: number;
  width?: number;
  theme?: Theme.Dark | Theme.Light;
}

const BASE_COLORS = {
  dark: {
    active: 1,
    inactive: 0.7,
  },
  light: {
    active: 0,
    inactive: 0.3,
  },
};

export const PlayheadMarker = memo(function PlayheadMarker({
  height = 36,
  width = 1.5,
  theme = Theme.Light,
}: PlayheadMarkerProps) {
  const markerRef = useRef<THREE.Mesh>(null);

  const previewCurrent = useAnimationStore(
    useShallow(
      (state: AnimationData) =>
        state.previews.find((p) => p.semanticTime === SemanticTime.Current) !== undefined,
    ),
  );

  // Calculate colors based on state
  const cartBrightness = useSpring(
    previewCurrent ? BASE_COLORS[theme].active : BASE_COLORS[theme].inactive,
    {
      stiffness: 300,
      damping: 30,
    },
  );

  useEffect(() => {
    const color: number = previewCurrent ? BASE_COLORS[theme].active : BASE_COLORS[theme].inactive;
    cartBrightness.set(color);
  }, [cartBrightness, theme, previewCurrent]);

  const cartColor = useTransform(cartBrightness, [0, 1], ["#000000", "#ffffff"]);

  const scaleX = useInvariantScale();
  const playheadSpring = usePlayheadSpring();

  useMotionValueEvent(scaleX, "change", (s) => {
    if (markerRef.current) {
      markerRef.current.scale.x = s;
    }
  });

  useMotionValueEvent(playheadSpring, "change", (h) => {
    if (markerRef.current) {
      markerRef.current.position.x = h;
    }
  });

  useMotionValueEvent(cartColor, "change", (c) => {
    if (markerRef.current) {
      (markerRef.current.material as THREE.MeshBasicMaterial).color.set(c);
    }
  });

  return (
    <mesh
      ref={markerRef as any}
      scale={[scaleX.get(), 1, 1]}
      position={[playheadSpring.get(), 0, Z.PlayheadCart]}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial toneMapped={false} color={cartColor.get()} />
    </mesh>
  );
});
