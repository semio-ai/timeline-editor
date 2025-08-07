import { useRef, useMemo } from "react";
import * as THREE from "three";
import { PlayerData } from "@semio/utils";
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
  height = 36,
  barHeight = 22,
  color = "#888",
}: {
  height?: number;
  barHeight?: number;
  color?: string;
}) {
  // Refs for meshes
  const rectRef = useRef<THREE.Mesh>(null);
  const leftHexRef = useRef<THREE.Mesh>(null);
  const rightHexRef = useRef<THREE.Mesh>(null);

  // Geometry for rectangle and half-hexagons
  const hexW = barHeight / Math.sqrt(3);
  const leftHexGeometry = createHalfHexGeometry(barHeight, "left");
  const rightHexGeometry = createHalfHexGeometry(barHeight, "right");

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
        rectRef.current.position.set(viewport[0] + rectWidth / 2, height / 2, 0);
        rectRef.current.scale.set(rectWidth, height, 1);
      }

      if (leftHexRef.current && rightHexRef.current) {
        leftHexRef.current.position.set(viewport[0] - hexW / 2, height / 2, 0);
        rightHexRef.current.position.set(viewport[1] + hexW / 2, height / 2, 0);
      }
    },
  );

  return (
    <>
      {/* Main rectangle */}
      <mesh ref={rectRef as any} geometry={rectGeometry as any} material={rectMaterial as any} />
      {/* Left half-hexagon */}
      {/*<mesh
        ref={leftHexRef as any}
        geometry={leftHexGeometry as any}
        material={hexMaterial as THREE.Material}
      />*/}
      {/* Right half-hexagon */}
      {/*<mesh
        ref={rightHexRef as any}
        geometry={rightHexGeometry as any}
        material={hexMaterial as THREE.Material}
      />*/}
    </>
  );
}
