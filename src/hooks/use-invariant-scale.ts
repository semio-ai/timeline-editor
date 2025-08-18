import { useFrame, type Size } from "@react-three/fiber";
import { MotionValue, useMotionValue } from "motion/react";
import * as THREE from "three";

export function useInvariantScale(): MotionValue<number> {
  // Create a motion value that represents an invariant scale
  const invariantScale = useMotionValue(1);

  // Update scale on each frame to maintain constant pixel size
  useFrame(({ viewport, camera }) => {
    const scaleFactor = calculateScaleFactor(camera as THREE.OrthographicCamera, viewport);
    invariantScale.set(scaleFactor);
  });

  return invariantScale;
}

const calculateScaleFactor = (camera: THREE.OrthographicCamera, viewport: Size) => {
  const baseWidth = viewport.width;
  const currentWidth =
    (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
  return currentWidth / baseWidth;
};
