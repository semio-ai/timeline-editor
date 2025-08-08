import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { useGesture } from "@use-gesture/react";
import { cubicBezier, MotionValue, useMotionValueEvent } from "motion/react";
import { PlayerData, usePlayerStore } from "@semio/utils";
import { Instance, Instances, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Theme } from "@semio/ui";
import { usePlayerSubscription, useTween } from "../../../hooks";

/**
 * MinimapDisplay renders a minimap rectangle and half-hexagons using react-three/fiber,
 * subscribing to viewport changes via usePlayerStore and updating mesh positions directly.
 */
export function MinimapDisplay({
  inactiveHeight = 5,
  activeHeight = 22,
  theme = Theme.Light,
  minZoom = 0.05,
}: {
  inactiveHeight?: number;
  activeHeight?: number;
  theme?: Theme.Dark | Theme.Light;
  minZoom?: number;
}) {
  // Refs for meshes
  const rectRef = useRef<THREE.Mesh>(null);
  const leftHexRef = useRef<THREE.Object3D>(null);
  const rightHexRef = useRef<THREE.Object3D>(null);

  // Player store for updating viewport
  const { updatePlayerViewport, updatePlayerViewportBound } = usePlayerStore();

  // Three.js context for coordinate conversion
  const { camera, size } = useThree();

  // Store current viewport for drag calculations
  const [currentViewport, setCurrentViewport] = useState<[number, number]>([0, 1]);
  const [currentBounds, setCurrentBounds] = useState<[number, number]>([0, 1]);

  // Interaction state
  const [hovered, setHovered] = useState(false);
  const [hoveredArea, setHoveredArea] = useState<"viewport" | "left" | "right" | null>(null);
  const [dragging, setDragging] = useState<"viewport" | "left" | "right" | null>(null);

  // Determine if component is active
  const isActive = hovered || dragging !== null;

  // Theme colors - full opacity for proper layering
  const colors = useMemo(() => {
    if (theme === Theme.Dark) {
      return {
        rectInactive: "#353535",
        rectActive: "#4A4A4A",
        hexInactive: "#606060",
        hexActive: "#737373",
      };
    } else {
      return {
        rectInactive: "#E5E5E5",
        rectActive: "#A5A5A5",
        hexInactive: "#C0C0C0",
        hexActive: "#888888",
      };
    }
  }, [theme]);

  // Height animation using useTween
  const heightMotion = useRef(new MotionValue(inactiveHeight));
  const heightTween = useTween(heightMotion.current, {
    ease: cubicBezier(0.645, 0.045, 0.355, 1.0),
    duration: 0.03,
  });

  // Current height for geometry updates
  const [currentHeight, setCurrentHeight] = useState(inactiveHeight);

  // Update height target when active state changes
  useEffect(() => {
    heightMotion.current.set(isActive ? activeHeight : inactiveHeight);
  }, [isActive, activeHeight, inactiveHeight]);

  // Listen to height changes
  useMotionValueEvent(heightTween, "change", (newHeight) => {
    setCurrentHeight(newHeight);
  });

  // Stable geometries and materials
  const rectGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const rectMaterial = useMemo(() => new THREE.MeshBasicMaterial(), []);
  const hexMaterial = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);

  // Update material colors when active state changes
  useEffect(() => {
    const rectColor = isActive ? colors.rectActive : colors.rectInactive;
    const hexColor = isActive ? colors.hexActive : colors.hexInactive;
    rectMaterial.color.set(rectColor);
    hexMaterial.color.set(hexColor);
  }, [rectMaterial, hexMaterial, colors, isActive]);

  // Use drei's useCursor hook for cursor management
  useCursor(hovered && hoveredArea === "viewport" && !dragging, "grab", "auto");
  useCursor(
    hovered && (hoveredArea === "left" || hoveredArea === "right") && !dragging,
    "ew-resize",
    "auto",
  );
  useCursor(dragging === "viewport", "grabbing", "auto");
  useCursor(dragging === "left" || dragging === "right", "ew-resize", "auto");

  usePlayerSubscription(
    (state: PlayerData) => state.player.viewport,
    (viewport) => {
      setCurrentViewport(viewport);
      // Calculate width in 0-1 units
      const rectWidth = viewport[1] - viewport[0];

      if (rectRef.current) {
        rectRef.current.position.set(viewport[0] + rectWidth / 2, 0, 0);
        rectRef.current.scale.set(rectWidth, currentHeight, 1);
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

  useFrame(({ viewport, camera: frameCamera }) => {
    if (leftHexRef.current && rightHexRef.current) {
      const baseWidth = viewport.width;
      const currentWidth =
        (frameCamera as THREE.OrthographicCamera).right -
        (frameCamera as THREE.OrthographicCamera).left;
      const scaleFactor = currentWidth / baseWidth;

      // Apply scaling for frustum invariance - same pattern as data points
      leftHexRef.current.scale.set(scaleFactor, 1, 1);
      rightHexRef.current.scale.set(scaleFactor, 1, 1);
    }
  });

  // Gesture bindings for each area
  const bindViewportDrag = useGesture(
    {
      onDrag: ({ movement: [mx], first, memo, event }) => {
        event?.stopPropagation();
        if (first) {
          setDragging("viewport");
          return [...currentViewport];
        }

        // Convert screen movement to normalized coordinate space
        const orthoCam = camera as THREE.OrthographicCamera;
        const worldWidth = orthoCam.right - orthoCam.left;
        const deltaX = (mx / size.width) * worldWidth;

        const initialViewport = memo as [number, number];
        const viewportWidth = currentViewport[1] - currentViewport[0];
        const newStart = Math.max(
          currentBounds[0],
          Math.min(currentBounds[1] - viewportWidth, initialViewport[0] + deltaX),
        );
        const newEnd = newStart + viewportWidth;
        updatePlayerViewport(newStart, newEnd);
        return memo as [number, number];
      },
      onDragEnd: () => {
        setDragging(null);
      },
    },
    {
      eventOptions: { passive: false },
    },
  );

  const bindLeftDrag = useGesture(
    {
      onDrag: ({ movement: [mx], first, memo, event }) => {
        event?.stopPropagation();
        if (first) {
          setDragging("left");
          return [...currentViewport];
        }

        // Convert screen movement to normalized coordinate space
        const orthoCam = camera as THREE.OrthographicCamera;
        const worldWidth = orthoCam.right - orthoCam.left;
        const deltaX = (mx / size.width) * worldWidth;

        const initialViewport = memo as [number, number];
        const potentialNewStart = Math.max(
          currentBounds[0],
          Math.min(initialViewport[1], initialViewport[0] + deltaX),
        );

        // Ensure viewport doesn't get smaller than minZoom
        const newStart = Math.min(potentialNewStart, initialViewport[1] - minZoom);
        updatePlayerViewportBound("start", newStart);
        return memo as [number, number];
      },
      onDragEnd: () => {
        setDragging(null);
      },
    },
    {
      eventOptions: { passive: false },
    },
  );

  const bindRightDrag = useGesture(
    {
      onDrag: ({ movement: [mx], first, memo, event }) => {
        event?.stopPropagation();
        if (first) {
          setDragging("right");
          return [...currentViewport];
        }

        // Convert screen movement to normalized coordinate space
        const orthoCam = camera as THREE.OrthographicCamera;
        const worldWidth = orthoCam.right - orthoCam.left;
        const deltaX = (mx / size.width) * worldWidth;

        const initialViewport = memo as [number, number];
        const potentialNewEnd = Math.min(
          currentBounds[1],
          Math.max(initialViewport[0], initialViewport[1] + deltaX),
        );

        // Ensure viewport doesn't get smaller than minZoom
        const newEnd = Math.max(potentialNewEnd, initialViewport[0] + minZoom);
        updatePlayerViewportBound("end", newEnd);
        return memo as [number, number];
      },
      onDragEnd: () => {
        setDragging(null);
      },
    },
    {
      eventOptions: { passive: false },
    },
  );

  return (
    <group>
      {/* Left hexagon gesture area */}
      <mesh
        position={[currentViewport[0] - 0.015, 0, 0.2]}
        onPointerEnter={() => {
          setHovered(true);
          setHoveredArea("left");
        }}
        onPointerLeave={() => {
          setHovered(false);
          setHoveredArea(null);
        }}
        {...(bindLeftDrag() as any)}
      >
        <boxGeometry args={[0.03, activeHeight, 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Rectangle gesture area */}
      <mesh
        position={[(currentViewport[0] + currentViewport[1]) / 2, 0, 0.2]}
        onPointerEnter={() => {
          setHovered(true);
          setHoveredArea("viewport");
        }}
        onPointerLeave={() => {
          setHovered(false);
          setHoveredArea(null);
        }}
        {...(bindViewportDrag() as any)}
      >
        <boxGeometry args={[currentViewport[1] - currentViewport[0], activeHeight, 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Right hexagon gesture area */}
      <mesh
        position={[currentViewport[1] + 0.015, 0, 0.2]}
        onPointerEnter={() => {
          setHovered(true);
          setHoveredArea("right");
        }}
        onPointerLeave={() => {
          setHovered(false);
          setHoveredArea(null);
        }}
        {...(bindRightDrag() as any)}
      >
        <boxGeometry args={[0.03, activeHeight, 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Main rectangle */}
      <mesh ref={rectRef as any} geometry={rectGeometry as any} material={rectMaterial as any} />

      {/* Left/Right hexagon approximations using cylinders */}
      <Instances limit={2} range={2}>
        <cylinderGeometry args={[currentHeight / 2, currentHeight / 2, 0.1, 6]} />
        <primitive object={hexMaterial} />

        <Instance ref={leftHexRef} rotation={[Math.PI / 2, 0, 0]} />

        <Instance ref={rightHexRef} rotation={[Math.PI / 2, 0, 0]} />
      </Instances>
    </group>
  );
}
