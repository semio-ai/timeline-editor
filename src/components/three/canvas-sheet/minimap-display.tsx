import { useRef, useMemo } from "react";
import * as THREE from "three";
import { PlayerData } from "@semio/utils";
import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { usePlayerSubscription } from "../../../hooks";

/**
 * Helper to create a half-hexagon shape geometry.
 */
function createHalfHexGeometry(height: number, direction: "left" | "right") {
  const w = height / Math.sqrt(3);
  const shape = new THREE.Shape();
  if (direction === "left") {
    shape.moveTo(0, 0);
    shape.lineTo(w, height / 2);
    shape.lineTo(0, height);
    shape.lineTo(0, 0);
  } else {
    shape.moveTo(0, 0);
    shape.lineTo(-w, height / 2);
    shape.lineTo(0, height);
    shape.lineTo(0, 0);
  }
  return new THREE.ShapeGeometry(shape);
}

/**
 * MinimapDisplay renders a minimap rectangle and half-hexagons using react-three/fiber,
 * subscribing to viewport changes via usePlayerStore and updating mesh positions directly.
 */
export function MinimapDisplay({
  height = 22,
  color = "#888",
}: {
  height?: number;
  color?: string;
}) {
  // Refs for meshes
  const rectRef = useRef<THREE.Mesh>(null);
  const leftHexRef = useRef<THREE.Mesh>(null);
  const rightHexRef = useRef<THREE.Mesh>(null);

  // Geometry for rectangle and half-hexagons
  const hexW = height / Math.sqrt(3);
  const _leftHexGeometry = createHalfHexGeometry(height, "left");
  const _rightHexGeometry = createHalfHexGeometry(height, "right");

  // Material (shared)
  const rectMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 });
  const hexMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });

  // Rectangle geometry: use a unit box, scale in updatePositions
  const rectGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  usePlayerSubscription(
    (state: PlayerData) => state.player.viewport,
    (viewport) => {
      // Calculate width in 0-1 units
      const rectWidth = viewport[1] - viewport[0];

      if (rectRef.current) {
        rectRef.current.position.set(viewport[0] + rectWidth / 2, 0, 0);
        rectRef.current.scale.set(rectWidth, height, 1);
      }

      if (leftHexRef.current && rightHexRef.current) {
        leftHexRef.current.position.set(viewport[0] - hexW / 2, 0, 0);
        rightHexRef.current.position.set(viewport[1] + hexW / 2, 0, 0);
      }
    },
  );

  useFrame(({ viewport, camera }) => {
    if (leftHexRef.current && rightHexRef.current) {
      const baseWidth = viewport.width; // Use actual viewport width as base
      const currentWidth =
        (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
      const scaleFactor = currentWidth / baseWidth;

      leftHexRef.current.scale.set(scaleFactor, 1, 1);
      rightHexRef.current.scale.set(scaleFactor, 1, 1);
    }
  });

  return (
    <>
      {/* Main rectangle */}
      <mesh ref={rectRef as any} geometry={rectGeometry as any} material={rectMaterial as any} />
      {/* Left/Right half-hexagons */}
      <Instances limit={2} range={2}>
        {/* Shared geometry and material for all instances */}
        <cylinderGeometry args={[5, 5, 1, 6]} />
        <meshBasicMaterial toneMapped={false} />

        <Instance
          ref={leftHexRef}
          rotation={[Math.PI / 2, 0, 0]}
          // eslint-dissable-next-line
          color={color}
        />

        <Instance ref={rightHexRef} rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={hexMaterial} attach="material" />
        </Instance>
      </Instances>
    </>
  );
}
