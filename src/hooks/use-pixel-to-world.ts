import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Hook for converting pixel dimensions to Three.js world units
 * in an orthographic camera setup.
 *
 * @returns Object with pixelsToWorldY and pixelsToWorldX conversion ratios
 */
export function usePixelToWorld() {
  const { camera, size } = useThree();

  return useMemo(() => {
    const orthoCamera = camera as THREE.OrthographicCamera;
    const frustumHeight = orthoCamera.top - orthoCamera.bottom;
    const frustumWidth = orthoCamera.right - orthoCamera.left;

    return {
      pixelsToWorldY: frustumHeight / size.height,
      pixelsToWorldX: frustumWidth / size.width,
    };
  }, [camera, size.height, size.width]);
}
