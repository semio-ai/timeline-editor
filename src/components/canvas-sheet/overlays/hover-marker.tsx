import { Theme } from "@semio/ui";
import { useRef, memo } from "react";
import * as THREE from "three";
import { useMotionValueEvent } from "motion/react";
import { useAnimationStore, useHoverSpring, useInvariantScale } from "../../../hooks";
import { Z } from "../../../constants";

export interface HoverMarkerProps {
  height?: number;
  width?: number;
  theme?: Theme.Dark | Theme.Light;
}

export const HoverMarker = memo(function HoverMarker({
  height = 36,
  width = 1.5,
  theme = Theme.Light,
}: HoverMarkerProps) {
  const markerRef = useRef<THREE.Mesh>(null);
  const color = theme === Theme.Light ? "#000000" : "#ffffff";

  const isDragging = useAnimationStore((state) => state.dragState !== undefined);

  const scaleX = useInvariantScale();
  const hoverSpring = useHoverSpring();

  useMotionValueEvent(scaleX, "change", (s) => {
    if (markerRef.current) {
      markerRef.current.scale.x = s;
      // markerRef.current.scale.set(s, 1, 1);
    }
  });

  useMotionValueEvent(hoverSpring, "change", (h) => {
    if (markerRef.current) {
      if (h !== undefined) {
        (markerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5;
        markerRef.current.position.x = h;
      } else {
        (markerRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  });

  if (isDragging) {
    return null;
  }

  return (
    <mesh ref={markerRef as any} scale={[scaleX.get(), 1, 1]} position={[0, 0, Z.PlayheadCart]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0} />
    </mesh>
  );
});
