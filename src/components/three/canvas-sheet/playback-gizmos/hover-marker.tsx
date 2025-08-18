import { Theme } from "@semio/ui";
import { useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useHoverSpring } from "../../../../hooks";

export interface HoverMarkerProps {
  height?: number;
  width?: number;
  theme?: Theme.Dark | Theme.Light;
}

export function HoverMarker({ height = 36, width = 1.5, theme = Theme.Light }: HoverMarkerProps) {
  const markerRef = useRef<THREE.Mesh>(null);
  const color = theme === Theme.Light ? "#000000" : "#ffffff";
  const { viewport, camera } = useThree();

  const hoverSpring = useHoverSpring();

  // Calculate scale factor to maintain consistent pixel width regardless of zoom
  const calculateScaleFactor = useCallback(() => {
    const baseWidth = viewport.width;
    const currentWidth =
      (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
    return currentWidth / baseWidth;
  }, [viewport.width, camera]);

  // Update scale on each frame to maintain constant pixel size
  useFrame(() => {
    if (markerRef.current) {
      const scaleFactor = calculateScaleFactor();
      markerRef.current.scale.set(scaleFactor, 1, 1);
    }
  });

  hoverSpring.on("change", (h) => {
    if (markerRef.current) {
      if (h !== undefined) {
        (markerRef.current.material as THREE.MeshBasicMaterial).opacity = 1;
        markerRef.current.position.x = h;
      } else {
        (markerRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  });

  return (
    <mesh ref={markerRef as any} position={[0, 0, 15]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent />
    </mesh>
  );
}
