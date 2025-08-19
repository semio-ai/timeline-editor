import { Theme } from "@semio/ui";
import { useRef, memo } from "react";
import * as THREE from "three";
import { useHoverSpring, useInvariantScale } from "../../../../hooks";

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

  const scaleX = useInvariantScale();
  const hoverSpring = useHoverSpring();

  scaleX.on("change", (s) => {
    if (markerRef.current) {
      markerRef.current.scale.set(s, 1, 1);
    }
  });

  hoverSpring.on("change", (h) => {
    if (markerRef.current) {
      if (h !== undefined) {
        (markerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5;
        markerRef.current.position.x = h;
      } else {
        (markerRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  });

  return (
    <mesh ref={markerRef as any} position={[0, 0, 15]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0} />
    </mesh>
  );
});
