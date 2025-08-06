import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

/**
 * Ensures the orthographic camera's top and bottom bounds are set
 * based on the current canvas size, both immediately (for initial render)
 * and on subsequent resizes.
 *
 * Call this hook at the top of any component that relies on correct
 * camera bounds for layout calculations.
 */
export function useOrthoCameraSetup() {
  const { size, camera } = useThree();

  // Set camera bounds immediately for initial render
  if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    const orthoCamera = camera as THREE.OrthographicCamera;
    orthoCamera.top = size.height / 2;
    orthoCamera.bottom = -size.height / 2;
    orthoCamera.updateProjectionMatrix();
  }

  // Also set on resize (for subsequent renders)
  useEffect(() => {
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      orthoCamera.top = size.height / 2;
      orthoCamera.bottom = -size.height / 2;
      orthoCamera.updateProjectionMatrix();
    }
  }, [camera, size]);
}
