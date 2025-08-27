import { useRef, useMemo, useState, useEffect, memo } from "react";
import * as THREE from "three";
import { cubicBezier, MotionValue, useMotionValueEvent } from "motion/react";
import { PlayerData, usePlayerStore } from "@semio/utils";
import { Instance, Instances, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Theme } from "@semio/ui";
import {
  usePlayerSubscription,
  useTween,
  usePlaybackGestures,
  useViewportDragGestures,
} from "../../../hooks";
import { Z } from "../../../constants";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadMarker } from "./overlays/playhead-marker";
import { FrustumBackground } from "./frustum-background";
import { BoundsOverlay } from "./overlays/bounds-overlay";
import { TickBackground } from "./overlays/tick-background";

/**
 * MinimapDisplay renders a minimap rectangle and half-hexagons using react-three/fiber,
 * subscribing to viewport changes via usePlayerStore and updating mesh positions directly.
 */
export const MinimapDisplay = memo(function MinimapDisplay({
  inactiveHeight = 5,
  activeHeight = 22,
  height = 36,
  theme = Theme.Light,
  minZoom = 0.05,
}: {
  inactiveHeight?: number;
  activeHeight?: number;
  height?: number; // Total height of the minimap
  theme?: Theme.Dark | Theme.Light;
  minZoom?: number;
}) {
  // Refs for meshes
  const rectRef = useRef<THREE.Mesh>(null);
  const leftHexRef = useRef<THREE.Object3D>(null);
  const rightHexRef = useRef<THREE.Object3D>(null);

  // Player store for updating viewport
  const { updatePlayerViewport, updatePlayerViewportBound } = usePlayerStore();

  // Store current viewport for drag calculations
  const [currentViewport, setCurrentViewport] = useState<[number, number]>([0, 1]);

  // Interaction state
  const [hovered, setHovered] = useState(false);
  const [hoveredArea, setHoveredArea] = useState<"viewport" | "left" | "right" | null>(null);
  const [dragging, setDragging] = useState<"viewport" | "left" | "right" | null>(null);

  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();

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
        rectRef.current.position.set(viewport[0] + rectWidth / 2, 0, Z.Minimap);
        rectRef.current.scale.set(rectWidth, currentHeight, 1);
        rectRef.current.renderOrder = 1; // Render on top
      }

      if (leftHexRef.current && rightHexRef.current) {
        // Position cylinders at rectangle edges, same Z but lower render order
        leftHexRef.current.position.set(viewport[0], 0, Z.Minimap);
        rightHexRef.current.position.set(viewport[1], 0, Z.Minimap);
        leftHexRef.current.renderOrder = 0; // Render behind
        rightHexRef.current.renderOrder = 0; // Render behind
      }
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

  // Gesture bindings for each area using the new hook
  const bindViewportDrag = useViewportDragGestures({
    disabled: false,
    onDragStart: () => {
      setDragging("viewport");
    },
    onDrag: (viewport) => {
      updatePlayerViewport(viewport[0], viewport[1]);
    },
    onDragEnd: () => {
      setDragging(null);
    },
    initialViewport: currentViewport,
    bounds: [0, 1],
    minWidth: minZoom,
    dragType: "viewport",
  });

  const bindLeftDrag = useViewportDragGestures({
    disabled: false,
    onDragStart: () => {
      setDragging("left");
    },
    onDrag: (viewport) => {
      updatePlayerViewportBound("start", viewport[0]);
    },
    onDragEnd: () => {
      setDragging(null);
    },
    initialViewport: currentViewport,
    bounds: [0, 1],
    minWidth: minZoom,
    dragType: "left",
  });

  const bindRightDrag = useViewportDragGestures({
    disabled: false,
    onDragStart: () => {
      setDragging("right");
    },
    onDrag: (viewport) => {
      updatePlayerViewportBound("end", viewport[1]);
    },
    onDragEnd: () => {
      setDragging(null);
    },
    initialViewport: currentViewport,
    bounds: [0, 1],
    minWidth: minZoom,
    dragType: "right",
  });

  return (
    <group>
      {/* Background gesture plane for playback interactions */}
      <FrustumBackground
        height={height}
        visibility="transparent"
        position={[0.5, 0, -0.5]}
        pointerEvents={playbackGestures}
      />

      <TickBackground height={height} theme={theme} />
      <HoverMarker height={height} theme={theme} />
      <PlayheadMarker height={height} theme={theme} />
      <BoundsOverlay height={height} theme={theme} />

      {/* Left hexagon gesture area */}
      <mesh
        position={[currentViewport[0] - 0.015, 0, Z.Minimap]}
        onPointerEnter={() => {
          setHovered(true);
          setHoveredArea("left");
        }}
        onPointerLeave={() => {
          setHovered(false);
          setHoveredArea(null);
        }}
        {...bindLeftDrag}
      >
        <boxGeometry args={[0.03, activeHeight, 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Rectangle gesture area */}
      <mesh
        position={[(currentViewport[0] + currentViewport[1]) / 2, 0, Z.Minimap]}
        onPointerEnter={() => {
          setHovered(true);
          setHoveredArea("viewport");
        }}
        onPointerLeave={() => {
          setHovered(false);
          setHoveredArea(null);
        }}
        {...bindViewportDrag}
      >
        <boxGeometry args={[currentViewport[1] - currentViewport[0], activeHeight, 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Right hexagon gesture area */}
      <mesh
        position={[currentViewport[1] + 0.015, 0, Z.Minimap]}
        onPointerEnter={() => {
          setHovered(true);
          setHoveredArea("right");
        }}
        onPointerLeave={() => {
          setHovered(false);
          setHoveredArea(null);
        }}
        {...bindRightDrag}
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
});
