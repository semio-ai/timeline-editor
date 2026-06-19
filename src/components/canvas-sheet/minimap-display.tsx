import { useRef, useMemo, useState, useEffect, memo, useContext } from "react";
import * as THREE from "three";
import { cubicBezier, MotionValue, useMotionValueEvent } from "motion/react";
import { isOrthographicCamera } from "@semio/utils";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Theme, useCanvasContextMenu } from "@semio/ui";
import {
  useTween,
  usePlaybackGestures,
  useViewportDragGestures,
} from "../../hooks";
import { Z } from "../../constants";
import { AnimationContext } from "../../context";
import {
  viewportMotion,
  setViewport,
  setViewportBound,
} from "../../viewport-state";
import { buildMinimapMenuItems } from "./context-menus";
import { HoverMarker } from "./overlays/hover-marker";
import { PlayheadMarker } from "./overlays/playhead-marker";
import { FrustumBackground } from "./frustum-background";
import { BoundsOverlay } from "./overlays/bounds-overlay";
import { TickBackground } from "./overlays/tick-background";

/**
 * MinimapDisplay renders a minimap rectangle and half-hexagons using react-three/fiber,
 * subscribing to viewport changes via usePlayerStore and updating mesh positions directly.
 *
 * Blender-style clamping: the scroll element is clamped to stay within the
 * minimap camera frustum so it's always visible and grabbable.
 */
export const MinimapDisplay = memo(function MinimapDisplay({
  inactiveHeight = 5,
  activeHeight = 22,
  height = 36,
  theme = Theme.Light,
  minZoom = 100,
}: {
  inactiveHeight?: number;
  activeHeight?: number;
  height?: number; // Total height of the minimap
  theme?: Theme.Dark | Theme.Light;
  minZoom?: number;
}) {
  // Refs for meshes
  const rectRef = useRef<THREE.Mesh>(null);
  const leftHexRef = useRef<THREE.Mesh>(null);
  const rightHexRef = useRef<THREE.Mesh>(null);

  // Store current viewport for drag calculations
  const [currentViewport, setCurrentViewport] = useState<[number, number]>(() => {
    const v = viewportMotion.get();
    return [v[0], v[1]];
  });

  // Interaction state
  const [hovered, setHovered] = useState(false);
  const [hoveredArea, setHoveredArea] = useState<"viewport" | "left" | "right" | null>(null);
  const [dragging, setDragging] = useState<"viewport" | "left" | "right" | null>(null);

  // Get canvas element for cursor container
  const { gl } = useThree();

  // Add playback gestures for seeking and hover preview
  const playbackGestures = usePlaybackGestures();
  const animationStore = useContext(AnimationContext);

  const { onContextMenu } = useCanvasContextMenu({
    items: (ctx) => buildMinimapMenuItems(ctx, animationStore),
  });

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

  // Stable materials
  const rectMaterial = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const hexMaterial = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);

  // Update material colors when active state changes
  useEffect(() => {
    const rectColor = isActive ? colors.rectActive : colors.rectInactive;
    const hexColor = isActive ? colors.hexActive : colors.hexInactive;
    rectMaterial.color.set(rectColor);
    hexMaterial.color.set(hexColor);
  }, [rectMaterial, hexMaterial, colors, isActive]);

  // Use drei's useCursor hook for cursor management
  useCursor(hovered && hoveredArea === "viewport" && !dragging, "grab", "auto", gl.domElement);
  useCursor(
    hovered && (hoveredArea === "left" || hoveredArea === "right") && !dragging,
    "ew-resize",
    "auto",
    gl.domElement,
  );
  useCursor(dragging === "viewport", "grabbing", "auto", gl.domElement);
  useCursor(dragging === "left" || dragging === "right", "ew-resize", "auto", gl.domElement);

  useMotionValueEvent(viewportMotion, "change", (v) => {
    setCurrentViewport([v[0], v[1]]);
  });

  // Blender-style per-edge clamping: each edge independently clamps to the
  // frustum boundary, so the element shrinks as the viewport leaves the range,
  // down to a minimum pixel width (~10px).

  useFrame(({ viewport: threeViewport, camera: frameCamera }) => {
    if (!isOrthographicCamera(frameCamera)) return;

    const fLeft = frameCamera.left;
    const fRight = frameCamera.right;
    const frustumWidth = fRight - fLeft;
    if (frustumWidth <= 0) return;

    const pixelWidth = threeViewport.width;
    const scaleFactor = frustumWidth / pixelWidth;

    // Hex visual radius in world units (unit circle scaled by scaleFactor * hexSize)
    const hexRadius = scaleFactor * (currentHeight / 2);

    // Minimum visual width in world units (~10px), not counting hex caps
    const minWidth = scaleFactor * 10;

    const [vpStart, vpEnd] = currentViewport;

    // Inset the clamping bounds by the hex radius so the hex caps stay fully visible
    const clampLeft = fLeft + hexRadius;
    const clampRight = fRight - hexRadius;

    // Clamp each edge independently
    let clampedStart = Math.max(clampLeft, vpStart);
    let clampedEnd = Math.min(clampRight, vpEnd);

    // If clamped width is below minimum, pin to the nearest frustum edge
    if (clampedEnd - clampedStart < minWidth) {
      if (vpEnd <= clampLeft) {
        // Entire viewport is left of visible range — pin to left
        clampedStart = clampLeft;
        clampedEnd = clampLeft + minWidth;
      } else if (vpStart >= clampRight) {
        // Entire viewport is right of visible range — pin to right
        clampedStart = clampRight - minWidth;
        clampedEnd = clampRight;
      } else if (vpStart < clampLeft) {
        // Left edge is outside
        clampedStart = clampLeft;
        clampedEnd = Math.max(clampLeft + minWidth, clampedEnd);
      } else {
        // Right edge is outside
        clampedEnd = clampRight;
        clampedStart = Math.min(clampRight - minWidth, clampedStart);
      }
    }

    const rectWidth = clampedEnd - clampedStart;

    // Visual rect
    if (rectRef.current) {
      rectRef.current.position.set(clampedStart + rectWidth / 2, 0, Z.Minimap);
      rectRef.current.scale.set(rectWidth, currentHeight, 1);
    }

    // Hex caps — behind the rect so they appear as half-hexagons.
    // Unit circle geometry (radius=1): scale X by scaleFactor * hexSize for frustum invariance,
    // scale Y by hexSize to match the animated height.
    const hexSize = currentHeight / 2;
    if (leftHexRef.current) {
      leftHexRef.current.position.set(clampedStart, 0, Z.Minimap - 0.1);
      leftHexRef.current.scale.set(scaleFactor * hexSize, hexSize, 1);
    }
    if (rightHexRef.current) {
      rightHexRef.current.position.set(clampedEnd, 0, Z.Minimap - 0.1);
      rightHexRef.current.scale.set(scaleFactor * hexSize, hexSize, 1);
    }

    // Grab meshes — in front of visual elements, covering the hex areas.
    // Handle grab extends outward from the rect edge by hexRadius.
    const grabZ = Z.Minimap + 0.5;
    const handleGrabWidth = hexRadius * 2;
    if (leftGrabRef.current) {
      // Centered on the hex: from (clampedStart - hexRadius) to (clampedStart + hexRadius)
      leftGrabRef.current.position.set(clampedStart, 0, grabZ);
      leftGrabRef.current.scale.set(handleGrabWidth, activeHeight, 1);
    }
    if (rectGrabRef.current) {
      rectGrabRef.current.position.set(clampedStart + rectWidth / 2, 0, grabZ);
      rectGrabRef.current.scale.set(Math.max(rectWidth - handleGrabWidth, 1), activeHeight, 1);
    }
    if (rightGrabRef.current) {
      rightGrabRef.current.position.set(clampedEnd, 0, grabZ);
      rightGrabRef.current.scale.set(handleGrabWidth, activeHeight, 1);
    }
  });

  // Gesture bindings — no bounds constraint, timeline is unbounded
  const bindViewportDrag = useViewportDragGestures({
    disabled: false,
    onDragStart: () => {
      setDragging("viewport");
    },
    onDrag: (viewport) => {
      setViewport(viewport[0], viewport[1]);
    },
    onDragEnd: () => {
      setDragging(null);
    },
    initialViewport: currentViewport,
    minWidth: minZoom,
    dragType: "viewport",
  });

  const bindLeftDrag = useViewportDragGestures({
    disabled: false,
    onDragStart: () => {
      setDragging("left");
    },
    onDrag: (viewport) => {
      setViewportBound("start", viewport[0]);
    },
    onDragEnd: () => {
      setDragging(null);
    },
    initialViewport: currentViewport,
    minWidth: minZoom,
    dragType: "left",
  });

  const bindRightDrag = useViewportDragGestures({
    disabled: false,
    onDragStart: () => {
      setDragging("right");
    },
    onDrag: (viewport) => {
      setViewportBound("end", viewport[1]);
    },
    onDragEnd: () => {
      setDragging(null);
    },
    initialViewport: currentViewport,
    minWidth: minZoom,
    dragType: "right",
  });

  // Refs for grab meshes — positioned by useFrame alongside visual elements
  const leftGrabRef = useRef<THREE.Mesh>(null);
  const rectGrabRef = useRef<THREE.Mesh>(null);
  const rightGrabRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      {/* Background gesture plane for playback interactions — behind everything */}
      <FrustumBackground
        height={height}
        visibility="transparent"
        z={Z.Minimap - 1}
        pointerEvents={{ ...playbackGestures, onContextMenu }}
      />

      <TickBackground height={height} theme={theme} opacity={0.1} />
      <HoverMarker height={height} theme={theme} />
      <PlayheadMarker height={height} theme={theme} />
      <BoundsOverlay height={height} theme={theme} />

      {/* Grab meshes — in front of visual elements, positioned by useFrame */}
      <mesh
        ref={leftGrabRef}
        onPointerEnter={() => { setHovered(true); setHoveredArea("left"); }}
        onPointerLeave={() => { setHovered(false); setHoveredArea(null); }}
        {...bindLeftDrag}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <mesh
        ref={rectGrabRef}
        onPointerEnter={() => { setHovered(true); setHoveredArea("viewport"); }}
        onPointerLeave={() => { setHovered(false); setHoveredArea(null); }}
        {...bindViewportDrag}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <mesh
        ref={rightGrabRef}
        onPointerEnter={() => { setHovered(true); setHoveredArea("right"); }}
        onPointerLeave={() => { setHovered(false); setHoveredArea(null); }}
        {...bindRightDrag}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Main rectangle */}
      <mesh ref={rectRef as any} material={rectMaterial as any}>
        <planeGeometry args={[1, 1]} />
      </mesh>

      {/* Left/Right hexagon caps — regular meshes, positioned by useFrame */}
      <mesh ref={leftHexRef as any} material={hexMaterial as any}>
        <circleGeometry args={[1, 6, Math.PI / 6]} />
      </mesh>

      <mesh ref={rightHexRef as any} material={hexMaterial as any}>
        <circleGeometry args={[1, 6, Math.PI / 6]} />
      </mesh>
    </group>
  );
});
