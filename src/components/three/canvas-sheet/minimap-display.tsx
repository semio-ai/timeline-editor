import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { useGesture } from "@use-gesture/react";
import { PlayerData, usePlayerStore } from "@semio/utils";
import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { usePlayerSubscription } from "../../../hooks";

/**
 * MinimapDisplay renders a minimap rectangle and half-hexagons using react-three/fiber,
 * subscribing to viewport changes via usePlayerStore and updating mesh positions directly.
 */
export function MinimapDisplay({
  height = 22,
  color = "#888888",
}: {
  height?: number;
  color?: string;
}) {
  // Refs for meshes
  const rectRef = useRef<THREE.Mesh>(null);
  const leftHexRef = useRef<THREE.Object3D>(null);
  const rightHexRef = useRef<THREE.Object3D>(null);

  // Player store for updating viewport
  const { updatePlayerViewport, updatePlayerViewportBound } = usePlayerStore();

  // Materials
  const rectMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
      }),
    [color],
  );

  // Rectangle geometry: use a unit box, scale in updatePositions
  const rectGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // Store current viewport for drag calculations
  const [currentViewport, setCurrentViewport] = useState<[number, number]>([0, 1]);
  const [currentBounds, setCurrentBounds] = useState<[number, number]>([0, 1]);

  usePlayerSubscription(
    (state: PlayerData) => state.player.viewport,
    (viewport) => {
      setCurrentViewport(viewport);
      // Calculate width in 0-1 units
      const rectWidth = viewport[1] - viewport[0];

      if (rectRef.current) {
        rectRef.current.position.set(viewport[0] + rectWidth / 2, 0, 0);
        rectRef.current.scale.set(rectWidth, height, 1);
        rectRef.current.renderOrder = 1; // Render on top
      }

      if (leftHexRef.current && rightHexRef.current) {
        // Position cylinders at rectangle edges, same Z but lower render order
        leftHexRef.current.position.set(viewport[0], 0, 0);
        rightHexRef.current.position.set(viewport[1], 0, 0);
        leftHexRef.current.renderOrder = 0; // Render behind
        rightHexRef.current.renderOrder = 0; // Render behind
      }
    },
  );

  usePlayerSubscription(
    (state: PlayerData) => state.player.bounds,
    (bounds) => {
      setCurrentBounds(bounds);
    },
  );

  useFrame(({ viewport, camera }) => {
    if (leftHexRef.current && rightHexRef.current) {
      const baseWidth = viewport.width;
      const currentWidth =
        (camera as THREE.OrthographicCamera).right - (camera as THREE.OrthographicCamera).left;
      const scaleFactor = currentWidth / baseWidth;

      // Apply scaling for frustum invariance - same pattern as data points
      leftHexRef.current.scale.set(scaleFactor, 1, 1);
      rightHexRef.current.scale.set(scaleFactor, 1, 1);
    }
  });

  // Gesture handlers for viewport drag
  useGesture(
    {
      onDrag: ({ movement: [mx], first, memo }) => {
        if (first) {
          return [...currentViewport];
        }
        const deltaX = mx * 0.001;
        const initialViewport = memo as [number, number];
        const viewportWidth = currentViewport[1] - currentViewport[0];
        const newStart = Math.max(
          currentBounds[0],
          Math.min(currentBounds[1] - viewportWidth, initialViewport[0] + deltaX),
        );
        const newEnd = newStart + viewportWidth;
        updatePlayerViewport(newStart, newEnd);
        return memo;
      },
    },
    {
      target: rectRef as any,
      eventOptions: { passive: false },
    },
  );

  // Gesture handlers for left hexagon
  useGesture(
    {
      onDrag: ({ movement: [mx], first, memo }) => {
        if (first) {
          return [...currentViewport];
        }
        const deltaX = mx * 0.001;
        const initialViewport = memo as [number, number];
        const newStart = Math.max(
          currentBounds[0],
          Math.min(initialViewport[1], initialViewport[0] + deltaX),
        );
        updatePlayerViewportBound("start", newStart);
        return memo;
      },
    },
    {
      target: leftHexRef as any,
      eventOptions: { passive: false },
    },
  );

  // Gesture handlers for right hexagon
  useGesture(
    {
      onDrag: ({ movement: [mx], first, memo }) => {
        if (first) {
          return [...currentViewport];
        }
        const deltaX = mx * 0.001;
        const initialViewport = memo as [number, number];
        const newEnd = Math.min(
          currentBounds[1],
          Math.max(initialViewport[0], initialViewport[1] + deltaX),
        );
        updatePlayerViewportBound("end", newEnd);
        return memo;
      },
    },
    {
      target: rightHexRef as any,
      eventOptions: { passive: false },
    },
  );

  return (
    <group>
      {/* Main rectangle */}
      <mesh ref={rectRef as any} geometry={rectGeometry as any} material={rectMaterial as any} />

      {/* Left/Right hexagon approximations using cylinders */}
      <Instances limit={2} range={2}>
        <cylinderGeometry args={[height / 2, height / 2, 0.1, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />

        <Instance ref={leftHexRef} rotation={[Math.PI / 2, 0, 0]} color={color} />

        <Instance ref={rightHexRef} rotation={[Math.PI / 2, 0, 0]} color={color} />
      </Instances>
    </group>
  );
}
