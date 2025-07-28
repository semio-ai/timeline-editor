import { useFrame } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { gridMaterial } from "./materials/grid-material";

export function GridBackground() {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const prevFrustum = useRef({ left: 0, right: 0, top: 0, bottom: 0 });

  const updateGrid = useCallback(() => {
    if (!(camera instanceof THREE.OrthographicCamera) || !meshRef.current)
      return;

    const prev = prevFrustum.current;
    const current = {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
    };

    // Check if frustum actually changed
    const changed =
      prev.left !== current.left ||
      prev.right !== current.right ||
      prev.top !== current.top ||
      prev.bottom !== current.bottom;

    if (changed) {
      // Update material uniforms
      gridMaterial.uniforms.uFrustumLeft.value = current.left;
      gridMaterial.uniforms.uFrustumRight.value = current.right;
      gridMaterial.uniforms.uFrustumTop.value = current.top;
      gridMaterial.uniforms.uFrustumBottom.value = current.bottom;

      // Calculate frustum dimensions
      const width = current.right - current.left;
      const height = current.top - current.bottom;

      // Update mesh geometry only if size changed
      if (
        prev.right - prev.left !== width ||
        prev.top - prev.bottom !== height
      ) {
        meshRef.current.geometry.dispose();
        meshRef.current.geometry = new THREE.PlaneGeometry(width, height);
      }

      // Position mesh at center of frustum
      meshRef.current.position.set(
        (current.left + current.right) / 2,
        (current.top + current.bottom) / 2,
        -1,
      );

      prevFrustum.current = current;
    }
  }, [camera, prevFrustum]);

  // Initialize grid immediately when camera is available
  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera && meshRef.current) {
      updateGrid();
    }
  }, [camera, updateGrid]);

  // Update grid on camera changes
  useFrame(() => {
    updateGrid();
  });

  // Dynamic plane that matches camera frustum
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[300, 32]} />
      <primitive object={gridMaterial} />
    </mesh>
  );
}
