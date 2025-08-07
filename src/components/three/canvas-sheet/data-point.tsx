import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Instance } from "@react-three/drei";
import * as THREE from "three";
import type { Color } from "three";

export interface DataPointProps {
  id: string;
  x: number;
  y: number;
  color: string | Color;
}

export function DataPoint({ x, color }: DataPointProps) {
  const instanceRef = useRef<THREE.Object3D>(null);

  useFrame(({ viewport, camera }) => {
    if (instanceRef.current) {
      const baseWidth = viewport.width; // Use actual viewport width as base
      const currentWidth =
        (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
      const scaleFactor = currentWidth / baseWidth;

      instanceRef.current.scale.set(scaleFactor, 1, 1);
    }
  });

  const colorProp: Color | undefined = useMemo(() => {
    if (typeof color === "string") {
      return new THREE.Color(color);
    }
    return color instanceof THREE.Color ? color : undefined;
  }, [color]);

  return (
    <Instance
      ref={instanceRef}
      position={[x, 0, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      // eslint-dissable-next-line
      color={colorProp as any as string}
    />
  );
}
