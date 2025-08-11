import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instance } from "@react-three/drei";
import * as THREE from "three";
import { InstancedFrameInfo } from "../../../types";
import { useColors } from "../../../hooks";

export interface DataPointProps {
  data: InstancedFrameInfo;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function DataPoint({ data }: DataPointProps) {
  const instanceRef = useRef<THREE.Object3D>(null);

  const { stamp, points } = data;

  const color = useColors(points.map((p) => p.trackId));

  useFrame(({ viewport, camera }) => {
    if (instanceRef.current) {
      const baseWidth = viewport.width; // Use actual viewport width as base
      const currentWidth =
        (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
      const scaleFactor = currentWidth / baseWidth;

      instanceRef.current.scale.set(scaleFactor, 1, 1);
    }
  });

  return (
    <Instance
      ref={instanceRef}
      position={[stamp, 0, 10]}
      rotation={[Math.PI / 2, 0, 0]}
      // eslint-dissable-next-line
      color={color}
    />
  );
}
