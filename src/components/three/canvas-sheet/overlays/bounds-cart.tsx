import { Theme } from "@semio/ui";
import { memo, useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore, closestFrame, PlayerData } from "@semio/utils";
import { useMotionValue, useSpring, useTransform, useMotionValueEvent } from "motion/react";
import { useCursor } from "@react-three/drei";
import { shallow } from "zustand/shallow";
import { DynamicRoundedRect } from "../shared/rounded-rectangle-geometry";
import {
  useInvariantScale,
  useAnimationStore,
  useDragGestures,
  useAltKeyPressed,
  usePlayerSubscription,
} from "../../../../hooks";
import { AnimationData, AnimationActions } from "../../../../store-types";
import { SemanticTime } from "../../../../types";

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

const CONE_RADIUS = 4; // Radius of the cone for the vertical pointer

export interface BoundsCartProps {
  side: "top" | "bottom";
  end: "left" | "right";
  height?: number;
  theme?: Theme.Dark | Theme.Light;
}

export const BoundsCart = memo(function BoundsCart({
  side = "top",
  end = "left",
  height = 36,
  theme = Theme.Light,
}: BoundsCartProps) {
  const cartRef = useRef<THREE.Group>(null);
  const scaleRef = useRef<THREE.Group>(null);
  const dragMeshRef = useRef<THREE.Mesh>(null);
  const arrowVertRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Mesh>(null);

  // State for dragging
  const [isDragging, setIsDragging] = useState(false);
  const altPressed = useAltKeyPressed();

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
  const boundSpring = end === "left" ? leftSpring : rightSpring;

  // Get invariant scale for zoom-independent sizing
  const invariantScale = useInvariantScale();

  // Player and animation store
  const { updateBounds, playing, playerDuration } = usePlayerStore(
    useShallow((state) => ({
      updateBounds: state.updatePlayerBounds,
      playing: state.player.running,
      playerDuration: state.player.duration,
    })),
  );

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

  // Check if this specific bound has a preview
  const hasPreview = end === "left" ? previewLeft !== undefined : previewRight !== undefined;
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

  useMotionValueEvent(cartColor, "change", (color) => {
    if (arrowVertRef.current) {
      (arrowVertRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    }
    if (lineRef.current) {
      (lineRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    }
  });

  // Use drag gestures hook
  const dragHandlers = useDragGestures({
    disabled: playing,
    onDragStart: () => {
      setIsDragging(true);
      const semanticTime = end === "left" ? SemanticTime.BoundsStart : SemanticTime.BoundsEnd;
      const label = end === "left" ? "Bounds Start" : "Bounds End";

      addPreview({
        semanticTime,
        stamp: end === "left" ? leftSpring.get() : rightSpring.get(),
        label,
      });
    },
    onDrag: (position, altKey) => {
      const newValue = altKey || altPressed ? position : closestFrame(position, frameCount);
      if (end === "left") {
        // Flip the bounds if the left bound is dragged past the right bound
        const newBounds =
          newValue >= rightSpring.get()
            ? [rightSpring.get(), newValue]
            : [newValue, rightSpring.get()];
        updateBounds(newBounds[0], newBounds[1]);
      } else {
        // Flip the bounds if the right bound is dragged past the left bound
        const newBounds =
          newValue <= leftSpring.get()
            ? [newValue, leftSpring.get()]
            : [leftSpring.get(), newValue];
        updateBounds(newBounds[0], newBounds[1]);
      }
    },
    onDragEnd: () => {
      setIsDragging(false);
      removePreview(
        (p) =>
          p.semanticTime === SemanticTime.BoundsStart || p.semanticTime === SemanticTime.BoundsEnd,
      );
    },
  });

  // Hover handlers
  const handlePointerEnter = useCallback(() => {
    if (!playing && !anyPreview) {
      const semanticTime = end === "left" ? SemanticTime.BoundsStart : SemanticTime.BoundsEnd;
      const label = end === "left" ? "Bounds Start" : "Bounds End";
      addPreview({
        semanticTime,
        stamp: end === "left" ? leftSpring.get() : rightSpring.get(),
        label,
      });
    }
  }, [playing, anyPreview, end, addPreview, leftSpring, rightSpring]);

  const handlePointerLeave = useCallback(() => {
    if (!isDragging) {
      removePreview(
        (p) =>
          p.semanticTime === SemanticTime.BoundsStart || p.semanticTime === SemanticTime.BoundsEnd,
      );
    }
  }, [isDragging, removePreview]);

  // Double-click handler
  const handleDoubleClick = useCallback((event: any) => {
    event.stopPropagation();
  }, []);

  // Cursor feedback
  useCursor(hasPreview && !playing && !isDragging, "ew-resize", "auto");
  useCursor(isDragging, "ew-resize", "auto");

  // Update position based on bound spring
  useMotionValueEvent(boundSpring, "change", (pos) => {
    if (cartRef.current) {
      cartRef.current.position.x = pos;
    }
  });

  // Update scale based on invariant scale
  useMotionValueEvent(invariantScale, "change", (s) => {
    if (scaleRef.current) {
      scaleRef.current.scale.x = s;
    }
  });

  // Cart dimensions
  const cartWidth = useMotionValue(11);
  const cartHeight = useMotionValue(20);
  const cartDepth = 0;
  const cartY = side === "top" ? -height / 2 + 19 : height / 2 - 19;
  const pointerY = side === "top" ? -height / 2 + 9 : height / 2 - 9;

  return (
    <group ref={cartRef as any} position={[boundSpring.get(), 0, anyPreview ? cartDepth + 12 : 0]}>
      {/* Visual cart with scaling group */}
      <group ref={scaleRef as any} scale={[invariantScale.get(), 1, 1]}>
        {/* Invisible drag handle mesh */}
        <mesh
          ref={dragMeshRef as any}
          position={[0, cartY, 0]}
          {...dragHandlers}
          onDoubleClick={handleDoubleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <planeGeometry args={[cartWidth.get() + 2, height * 0.8]} />
          <meshBasicMaterial transparent opacity={0} color="lime" />
        </mesh>

        {/* Cart body with rounded rectangle */}
        <DynamicRoundedRect
          position={[0, cartY, 0]}
          widthMotion={cartWidth}
          heightMotion={cartHeight}
          radius={3}
          // segments={16}
          color={cartColor}
        />

        {/* Vertical Arrow */}
        <mesh
          ref={arrowVertRef as any}
          position={[0, side === "top" ? pointerY - 2 : pointerY + 2, 0]}
          scale={[1, side === "top" ? -1 : 1, 0.1]}
        >
          <coneGeometry args={[CONE_RADIUS, 5, 4]} />
          <meshBasicMaterial color={cartColor.get()} toneMapped={false} />
        </mesh>

        {/* A line to continue the line from the normal playhead marker */}
        <mesh ref={lineRef as any} position={[0, pointerY, 0]}>
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
  );
});
