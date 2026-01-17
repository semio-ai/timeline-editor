import { Theme } from "@semio/ui";
import { memo, useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore, closestFrame, PlayerData } from "@semio/utils";
import { useMotionValue, useSpring, useTransform, useMotionValueEvent } from "motion/react";
import { useCursor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { shallow } from "zustand/shallow";
import { DynamicRoundedRect } from "../shared/rounded-rectangle-geometry";
import { useTriangleCaretGeometry } from "../shared/triangle-caret";
import {
  useInvariantScale,
  useAnimationStore,
  useDragGestures,
  useAltKeyPressed,
  usePlayerSubscription,
} from "../../../hooks";
import { AnimationData, AnimationActions } from "../../../store-types";
import { SemanticTime } from "../../../types";
import { TIMELINE_PADDING, Z } from "../../../constants";

// Theme colors matching the PlayheadCart approach
const BASE_COLORS = {
  dark: {
    active: 0.5,
    inactive: 0.25,
  },
  light: {
    active: 0.5,
    inactive: 0.75,
  },
};

export interface BoundsCartProps {
  side: "top" | "bottom";
  height?: number;
  theme?: Theme.Dark | Theme.Light;
}

const getConfig = (
  side: "top" | "bottom",
  end: "left" | "right",
  height: number,
): { cartY: number; cartX: number; pointerY: number; caretX: number } => {
  const cartY = side === "top" ? -height / 2 + 19 : height / 2 - 19;
  const cartX = end === "left" ? 4.75 : -4.75;
  const pointerY = side === "top" ? -height / 2 + 9 : height / 2 - 9;
  const caretX = end === "left" ? 1.25 : -1.25;

  return { cartY, cartX, pointerY, caretX };
};

export const BoundsCart = memo(function BoundsCart({
  side = "top",
  height = 36,
  theme = Theme.Light,
}: BoundsCartProps) {
  // Refs for left cart
  const leftCartRef = useRef<THREE.Group>(null);
  const leftScaleRef = useRef<THREE.Group>(null);
  const leftDragMeshRef = useRef<THREE.Mesh>(null);
  const leftArrowVertRef = useRef<THREE.Mesh>(null);
  const leftLineRef = useRef<THREE.Mesh>(null);

  // Refs for right cart
  const rightCartRef = useRef<THREE.Group>(null);
  const rightScaleRef = useRef<THREE.Group>(null);
  const rightDragMeshRef = useRef<THREE.Mesh>(null);
  const rightArrowVertRef = useRef<THREE.Mesh>(null);
  const rightLineRef = useRef<THREE.Mesh>(null);

  // Refs for overlays
  const leftOverlayRef = useRef<THREE.Mesh>(null);
  const rightOverlayRef = useRef<THREE.Mesh>(null);

  const leftConfig = getConfig(side, "left", height);
  const rightConfig = getConfig(side, "right", height);

  // State for dragging
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const altPressed = useAltKeyPressed();

  // Get canvas element for cursor container
  const { gl } = useThree();

  const { updateBounds, playing, playerDuration } = usePlayerStore(
    useShallow((state) => ({
      updateBounds: state.updatePlayerBounds,
      playing: state.player.running,
      playerDuration: state.player.duration,
    })),
  );

  // Get bounds springs
  const leftSpring = useMotionValue<number>(usePlayerStore.getState().player.bounds[0]);
  const rightSpring = useMotionValue<number>(usePlayerStore.getState().player.bounds[1]);

  usePlayerSubscription(
    (state: PlayerData) => state.player.bounds,
    (bounds) => {
      leftSpring.set(bounds[0]);
      rightSpring.set(bounds[1]);
    },
    shallow,
  );

  // Get invariant scale for zoom-independent sizing
  const invariantScale = useInvariantScale();

  // Player and animation store
  const { framerate, addPreview, removePreview, previewLeft, previewRight } = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => ({
      framerate: state.framerate as number,
      addPreview: state.addPreview,
      removePreview: state.removePreview,
      previewLeft: state.previews.find((p) => p.semanticTime === SemanticTime.BoundsStart),
      previewRight: state.previews.find((p) => p.semanticTime === SemanticTime.BoundsEnd),
    })),
  );

  const frameCount = Math.floor(framerate * (playerDuration / 1000));

  // Create caret geometries using hook
  const leftCaretGeometry = useTriangleCaretGeometry({
    height: 4,
    direction: "right",
    leftSideSize: 5,
    rightSideSize: 5,
  });

  const rightCaretGeometry = useTriangleCaretGeometry({
    height: 4,
    direction: "left",
    leftSideSize: 5,
    rightSideSize: 5,
  });

  // Check if bounds have previews
  const hasLeftPreview = previewLeft !== undefined;
  const hasRightPreview = previewRight !== undefined;
  const anyPreview = previewLeft !== undefined || previewRight !== undefined;

  // Create motion values for smooth transitions
  const brightness = useSpring(BASE_COLORS[theme][anyPreview ? "active" : "inactive"], {
    stiffness: 300,
    damping: 30,
  });

  useEffect(() => {
    brightness.set(BASE_COLORS[theme][anyPreview ? "active" : "inactive"]);
  }, [brightness, anyPreview, theme]);

  const cartColor = useTransform(brightness, [0, 1], ["#000000", "#ffffff"]);

  // Create overlay color (opposite of theme for deemphasis)
  const overlayColor = theme === Theme.Light ? "#ffffff" : "#000000";
  const overlayOpacity = 0.3;

  useMotionValueEvent(cartColor, "change", (color) => {
    if (leftArrowVertRef.current) {
      (leftArrowVertRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    }
    if (leftLineRef.current) {
      (leftLineRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    }
    if (rightArrowVertRef.current) {
      (rightArrowVertRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    }
    if (rightLineRef.current) {
      (rightLineRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    }
  });

  // Left drag gestures
  const leftDragHandlers = useDragGestures({
    disabled: playing,
    onDragStart: () => {
      setIsDraggingLeft(true);
      addPreview({
        semanticTime: SemanticTime.BoundsStart,
        stamp: leftSpring.get(),
      });
    },
    onDrag: (position, altKey) => {
      const newValue = altKey || altPressed ? position : closestFrame(position, frameCount);
      const newBounds =
        newValue >= rightSpring.get()
          ? [rightSpring.get(), newValue]
          : [newValue, rightSpring.get()];
      updateBounds(newBounds[0], newBounds[1]);
    },
    onDragEnd: () => {
      setIsDraggingLeft(false);
      removePreview(
        (p) =>
          p.semanticTime === SemanticTime.BoundsStart || p.semanticTime === SemanticTime.BoundsEnd,
      );
    },
  });

  // Right drag gestures
  const rightDragHandlers = useDragGestures({
    disabled: playing,
    onDragStart: () => {
      setIsDraggingRight(true);
      addPreview({
        semanticTime: SemanticTime.BoundsEnd,
        stamp: rightSpring.get(),
      });
    },
    onDrag: (position, altKey) => {
      const newValue = altKey || altPressed ? position : closestFrame(position, frameCount);
      const newBounds =
        newValue <= leftSpring.get() ? [newValue, leftSpring.get()] : [leftSpring.get(), newValue];
      updateBounds(newBounds[0], newBounds[1]);
    },
    onDragEnd: () => {
      setIsDraggingRight(false);
      removePreview(
        (p) =>
          p.semanticTime === SemanticTime.BoundsStart || p.semanticTime === SemanticTime.BoundsEnd,
      );
    },
  });

  // Left hover handlers
  const handleLeftPointerEnter = useCallback(() => {
    if (!playing && !anyPreview) {
      addPreview({
        semanticTime: SemanticTime.BoundsStart,
        stamp: leftSpring.get(),
      });
    }
  }, [playing, anyPreview, addPreview, leftSpring]);

  const handleLeftPointerLeave = useCallback(() => {
    if (!isDraggingLeft) {
      removePreview(
        (p) =>
          p.semanticTime === SemanticTime.BoundsStart || p.semanticTime === SemanticTime.BoundsEnd,
      );
    }
  }, [isDraggingLeft, removePreview]);

  // Right hover handlers
  const handleRightPointerEnter = useCallback(() => {
    if (!playing && !anyPreview) {
      addPreview({
        semanticTime: SemanticTime.BoundsEnd,
        stamp: rightSpring.get(),
      });
    }
  }, [playing, anyPreview, addPreview, rightSpring]);

  const handleRightPointerLeave = useCallback(() => {
    if (!isDraggingRight) {
      removePreview(
        (p) =>
          p.semanticTime === SemanticTime.BoundsStart || p.semanticTime === SemanticTime.BoundsEnd,
      );
    }
  }, [isDraggingRight, removePreview]);

  // Double-click handler
  const handleDoubleClick = useCallback((event: any) => {
    event.stopPropagation();
  }, []);

  // Cursor feedback
  useCursor(hasLeftPreview && !playing && !isDraggingLeft, "ew-resize", "auto", gl.domElement);
  useCursor(hasRightPreview && !playing && !isDraggingRight, "ew-resize", "auto", gl.domElement);
  useCursor(isDraggingLeft || isDraggingRight, "ew-resize", "auto", gl.domElement);

  // Update left position
  useMotionValueEvent(leftSpring, "change", (pos) => {
    if (leftCartRef.current) {
      leftCartRef.current.position.x = pos;
    }
    // Update left overlay
    if (leftOverlayRef.current) {
      const scale = invariantScale.get();
      const leftEdge = -TIMELINE_PADDING * scale;
      const centerX = (leftEdge + pos) / 2;
      const width = Math.abs(pos - leftEdge);
      leftOverlayRef.current.position.x = centerX;
      leftOverlayRef.current.scale.x = width;
    }
  });

  // Update right position
  useMotionValueEvent(rightSpring, "change", (pos) => {
    if (rightCartRef.current) {
      rightCartRef.current.position.x = pos;
    }
    // Update right overlay
    if (rightOverlayRef.current) {
      const scale = invariantScale.get();
      const rightEdge = 1 + TIMELINE_PADDING * scale;
      const centerX = (pos + rightEdge) / 2;
      const width = Math.abs(rightEdge - pos);
      rightOverlayRef.current.position.x = centerX;
      rightOverlayRef.current.scale.x = width;
    }
  });

  // Update scale based on invariant scale
  useMotionValueEvent(invariantScale, "change", (s) => {
    if (leftScaleRef.current) {
      leftScaleRef.current.scale.x = s;
    }
    if (rightScaleRef.current) {
      rightScaleRef.current.scale.x = s;
    }

    // Update overlay positions when scale changes
    const leftPos = leftSpring.get();
    const rightPos = rightSpring.get();

    // Update left overlay
    if (leftOverlayRef.current) {
      const leftEdge = -TIMELINE_PADDING * s;
      const centerX = (leftEdge + leftPos) / 2;
      const width = Math.abs(leftPos - leftEdge);
      leftOverlayRef.current.position.x = centerX;
      leftOverlayRef.current.scale.x = width;
    }

    // Update right overlay
    if (rightOverlayRef.current) {
      const rightEdge = 1 + TIMELINE_PADDING * s;
      const centerX = (rightPos + rightEdge) / 2;
      const width = Math.abs(rightEdge - rightPos);
      rightOverlayRef.current.position.x = centerX;
      rightOverlayRef.current.scale.x = width;
    }
  });

  // Cart dimensions
  const cartWidth = useMotionValue(11);
  const cartHeight = useMotionValue(20);
  const cartDepth = anyPreview ? Z.ActiveBoundsCart : Z.InactiveBoundsCart;

  return (
    <>
      {/* Left overlay - deemphasizes content outside bounds */}
      <mesh
        ref={leftOverlayRef as any}
        position={[
          (-TIMELINE_PADDING * invariantScale.get() + leftSpring.get()) / 2,
          0,
          Z.OutOfBoundsOverlay,
        ]}
        scale={[Math.abs(leftSpring.get() - -TIMELINE_PADDING * invariantScale.get()), 1, 1]}
      >
        <planeGeometry args={[1, height]} />
        <meshBasicMaterial
          toneMapped={false}
          color={overlayColor}
          transparent
          opacity={overlayOpacity}
        />
      </mesh>

      {/* Right overlay - deemphasizes content outside bounds */}
      <mesh
        ref={rightOverlayRef as any}
        position={[
          (rightSpring.get() + 1 + TIMELINE_PADDING * invariantScale.get()) / 2,
          0,
          Z.OutOfBoundsOverlay,
        ]}
        scale={[Math.abs(1 + TIMELINE_PADDING * invariantScale.get() - rightSpring.get()), 1, 1]}
      >
        <planeGeometry args={[1, height]} />
        <meshBasicMaterial
          toneMapped={false}
          color={overlayColor}
          transparent
          opacity={overlayOpacity}
        />
      </mesh>

      {/* Left Cart */}
      <group ref={leftCartRef as any} position={[leftSpring.get(), 0, cartDepth]}>
        <group ref={leftScaleRef as any} scale={[invariantScale.get(), 1, 1]}>
          {/* Invisible drag handle mesh */}
          <mesh
            ref={leftDragMeshRef as any}
            position={[leftConfig.cartX, leftConfig.cartY, 0.1]}
            {...leftDragHandlers}
            onDoubleClick={handleDoubleClick}
            onPointerEnter={handleLeftPointerEnter}
            onPointerLeave={handleLeftPointerLeave}
          >
            <planeGeometry args={[cartWidth.get() + 2, height * 0.8]} />
            <meshBasicMaterial transparent opacity={0} color="lime" />
          </mesh>

          {/* Cart body with rounded rectangle */}
          <DynamicRoundedRect
            position={[leftConfig.cartX, leftConfig.cartY, 0]}
            widthMotion={cartWidth}
            heightMotion={cartHeight}
            radius={3}
            color={cartColor}
          />

          {/* Pointer triangle (caret) */}
          <mesh
            ref={leftArrowVertRef as any}
            position={[leftConfig.caretX, leftConfig.pointerY, 0]}
          >
            <primitive object={leftCaretGeometry} />
            <meshBasicMaterial color={cartColor.get()} toneMapped={false} />
          </mesh>

          {/* A line to continue the line from the normal playhead marker */}
          <mesh ref={leftLineRef as any} position={[0, leftConfig.pointerY, 0]}>
            <planeGeometry args={[1.5, 18]} />
            <meshBasicMaterial
              color={cartColor.get()}
              toneMapped={false}
              opacity={anyPreview ? 1 : 0}
              transparent
            />
          </mesh>
        </group>
      </group>

      {/* Right Cart */}
      <group ref={rightCartRef as any} position={[rightSpring.get(), 0, cartDepth]}>
        <group ref={rightScaleRef as any} scale={[invariantScale.get(), 1, 1]}>
          {/* Invisible drag handle mesh */}
          <mesh
            ref={rightDragMeshRef as any}
            position={[rightConfig.cartX, rightConfig.cartY, 0.1]}
            {...rightDragHandlers}
            onDoubleClick={handleDoubleClick}
            onPointerEnter={handleRightPointerEnter}
            onPointerLeave={handleRightPointerLeave}
          >
            <planeGeometry args={[cartWidth.get() + 2, height * 0.8]} />
            <meshBasicMaterial transparent opacity={0} color="lime" />
          </mesh>

          {/* Cart body with rounded rectangle */}
          <DynamicRoundedRect
            position={[rightConfig.cartX, rightConfig.cartY, 0]}
            widthMotion={cartWidth}
            heightMotion={cartHeight}
            radius={3}
            color={cartColor}
          />

          {/* Pointer triangle (caret) */}
          <mesh
            ref={rightArrowVertRef as any}
            position={[rightConfig.caretX, rightConfig.pointerY, 0]}
          >
            <primitive object={rightCaretGeometry} />
            <meshBasicMaterial color={cartColor.get()} toneMapped={false} />
          </mesh>

          {/* A line to continue the line from the normal playhead marker */}
          <mesh ref={rightLineRef as any} position={[0, rightConfig.pointerY, 0]}>
            <planeGeometry args={[1.5, 18]} />
            <meshBasicMaterial
              color={cartColor.get()}
              toneMapped={false}
              opacity={anyPreview ? 1 : 0}
              transparent
            />
          </mesh>
        </group>
      </group>
    </>
  );
});
