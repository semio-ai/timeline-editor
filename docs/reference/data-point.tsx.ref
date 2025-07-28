import { Instance } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Object3D, OrthographicCamera } from "three";

import type { Data } from "./data-context";

export function DataPoint({ x, color }: Data) {
  const instanceRef = useRef<Object3D>(null);

  useFrame(({ viewport, camera }) => {
    if (instanceRef.current) {
      const baseWidth = viewport.width; // Use actual viewport width as base
      const currentWidth =
        (camera as OrthographicCamera).right -
        (camera as OrthographicCamera).left;
      const scaleFactor = currentWidth / baseWidth;

      instanceRef.current.scale.set(scaleFactor, 1, 1);
    }
  });

  return (
    <Instance
      ref={instanceRef}
      position={[x, 0, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      color={color}
    />
  );
}
