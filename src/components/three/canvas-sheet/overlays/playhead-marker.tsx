import { Theme } from "@semio/ui";
import { useRef, memo } from "react";
import * as THREE from "three";
import { usePlayheadSpring, useInvariantScale } from "../../../../hooks";

export interface PlayheadMarkerProps {
  height?: number;
  width?: number;
  theme?: Theme.Dark | Theme.Light;
}

export const PlayheadMarker = memo(function PlayheadMarker({
  height = 36,
  width = 1.5,
  theme = Theme.Light,
}: PlayheadMarkerProps) {
  const markerRef = useRef<THREE.Mesh>(null);
  const color = theme === Theme.Light ? "#000000" : "#ffffff";

  const scaleX = useInvariantScale();
  const playheadSpring = usePlayheadSpring();

  scaleX.on("change", (s) => {
    if (markerRef.current) {
      markerRef.current.scale.set(s, 1, 1);
    }
  });

  playheadSpring.on("change", (h) => {
    console.log("Playhead Changed", h);
    if (markerRef.current) {
      markerRef.current.position.x = h;
    }
  });

  return (
    <mesh ref={markerRef as any} position={[0, 0, 15]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} toneMapped={false} opacity={1} />
    </mesh>
  );
});
