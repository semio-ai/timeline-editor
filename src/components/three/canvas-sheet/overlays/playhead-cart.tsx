import { Theme, stampToVisualTime } from "@semio/ui";
import { memo, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { clamp } from "lodash";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore, closestFrame } from "@semio/utils";
import {
  useMotionValue,
  easeOut,
  MotionValue,
  useSpring,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { TrackText } from "../shared";
import { DynamicRoundedRect } from "../shared/rounded-rectangle-geometry";
import {
  usePlayheadSpring,
  useAnimationStore,
  useAltKeyPressed,
  useInvariantScale,
  useTween,
  useDragGestures,
} from "../../../../hooks";
import { TIMELINE_PADDING } from "../../../../constants";
import { AnimationData, AnimationActions } from "../../../../store-types";
import { SemanticTime } from "../../../../types";

const CONE_RADIUS = 4; // Radius of the cone for the vertical pointer

export interface PlayheadCartProps {
  height?: number;
  width?: number;
  theme?: Theme.Dark | Theme.Light;
  side: "top" | "bottom";
  fonts?: {
    mono?: string;
    ui?: string;
  };
}

const BASE_COLORS = {
  dark: {
    active: {
      cart: 1, // white
      text: "#000000", // black
    },
    inactive: {
      cart: 0.7, // light gray
      text: "#000000", // black
    },
  },
  light: {
    active: {
      cart: 0, // black
      text: "#ffffff", // white
    },
    inactive: {
      cart: 0.3, // dark gray
      text: "#ffffff", // white
    },
  },
};

export const PlayheadCart = memo(function PlayheadCart({
  height = 36,
  theme = Theme.Light,
  side = "top",
  fonts,
}: PlayheadCartProps) {
  const cartRef = useRef<THREE.Group>(null);
  const scaleRef = useRef<THREE.Group>(null);
  const boxRef = useRef<THREE.Mesh>(null);
  const textRef = useRef<THREE.Group>(null);
  const arrowVertRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Mesh>(null);
  const leftArrowRef = useRef<THREE.Mesh>(null);
  const rightArrowRef = useRef<THREE.Mesh>(null);
  const dragMeshRef = useRef<THREE.Mesh>(null);

  const cartWidthSpring = useCartWidthSpring();
  const invariantScale = useInvariantScale();
  const {
    position: playheadSpring,
    offset,
    opacity,
  } = usePlayheadCartSprings(cartWidthSpring, invariantScale, side === "top");

  // State for hover
  const altPressed = useAltKeyPressed();

  // Player and animation store actions
  const { resetPlayer, seekPlayer, playing, playerDuration } = usePlayerStore(
    useShallow((state) => ({
      resetPlayer: state.resetPlayer,
      seekPlayer: state.updatePlayerViewportCenter,
      playing: state.player.running,
      playerDuration: state.player.duration,
    })),
  );

  const { framerate, addPreview, removePreview, previewCurrent } = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => ({
      framerate: state.framerate as number,
      addPreview: state.addPreview,
      removePreview: state.removePreview,
      previewCurrent:
        state.previews.find((p) => p.semanticTime === SemanticTime.Current) !== undefined,
    })),
  );
  console.log("previewCurrent", previewCurrent);

  const frameCount = Math.floor(framerate * (playerDuration / 1000));

  // Use drag gestures hook with @use-gesture/react for better drag handling
  const dragHandlers = useDragGestures({
    disabled: playing,
    onDrag: (position, altKey) => {
      if (altKey || altPressed) {
        resetPlayer(position);
      } else {
        const closest = closestFrame(position, frameCount);
        resetPlayer(closest);
      }
    },
  });

  // Create motion values for morph target influences
  const cartHeight = useMotionValue(20);

  // Calculate colors based on state
  const cartBrightness = useSpring(
    previewCurrent ? BASE_COLORS[theme].active.cart : BASE_COLORS[theme].inactive.cart,
    {
      stiffness: 300,
      damping: 30,
    },
  );
  const textColor = previewCurrent
    ? BASE_COLORS[theme].active.text
    : BASE_COLORS[theme].inactive.text;

  useEffect(() => {
    const color: number = previewCurrent
      ? BASE_COLORS[theme].active.cart
      : BASE_COLORS[theme].inactive.cart;
    console.log("updating cart color", color);
    cartBrightness.set(color);
  }, [cartBrightness, theme, previewCurrent]);

  const cartColor = useTransform(cartBrightness, [0, 1], ["#000000", "#ffffff"]);

  const cartDepth = 10;

  // Calculate cart elements' y positions based on side
  const cartY = side === "top" ? -height / 2 + 19 : height / 2 - 19;
  const pointerY = side === "top" ? -height / 2 + 9 : height / 2 - 9;

  useMotionValueEvent(cartColor, "change", (value) => {
    if (lineRef.current) {
      (lineRef.current.material as THREE.MeshBasicMaterial).color.set(value);
    }
    if (arrowVertRef.current) {
      (arrowVertRef.current.material as THREE.MeshBasicMaterial).color.set(value);
    }
    if (leftArrowRef.current) {
      (leftArrowRef.current.material as THREE.MeshBasicMaterial).color.set(value);
    }
    if (rightArrowRef.current) {
      (rightArrowRef.current.material as THREE.MeshBasicMaterial).color.set(value);
    }
  });

  playheadSpring.on("change", (ph) => {
    if (cartRef.current) {
      cartRef.current.position.x = ph;
    }
  });

  invariantScale.on("change", (s) => {
    if (scaleRef.current) {
      scaleRef.current.scale.x = s;
    }
    if (textRef.current) {
      textRef.current.position.x = s * offset.get();
    }
  });

  offset.on("change", (s) => {
    if (boxRef.current) {
      boxRef.current.position.x = s;
    }
    if (textRef.current) {
      textRef.current.position.x = s * invariantScale.get();
    }
    const leftOpacity = getOpacity("left", opacity.get(), s);
    const rightOpacity = getOpacity("right", opacity.get(), s);

    if (leftArrowRef.current) {
      (leftArrowRef.current.material as THREE.MeshBasicMaterial).opacity = leftOpacity;
    }
    if (rightArrowRef.current) {
      (rightArrowRef.current.material as THREE.MeshBasicMaterial).opacity = rightOpacity;
    }
  });

  opacity.on("change", (o) => {
    if (arrowVertRef.current) {
      (arrowVertRef.current.material as THREE.MeshBasicMaterial).opacity = o;
      (arrowVertRef.current.material as THREE.MeshBasicMaterial).transparent = o < 1;
    }
    if (lineRef.current) {
      (lineRef.current.material as THREE.MeshBasicMaterial).opacity = o;
      (lineRef.current.material as THREE.MeshBasicMaterial).transparent = o < 1;
    }
    const leftOpacity = getOpacity("left", o, offset.get());
    const rightOpacity = getOpacity("right", o, offset.get());
    if (leftArrowRef.current) {
      leftArrowRef.current.position.x = -cartWidthSpring.get() / 2 - 1 + 4 * o;
      (leftArrowRef.current.material as THREE.MeshBasicMaterial).opacity = leftOpacity;
    }
    if (rightArrowRef.current) {
      rightArrowRef.current.position.x = cartWidthSpring.get() / 2 + 1 - 4 * o;
      (rightArrowRef.current.material as THREE.MeshBasicMaterial).opacity = rightOpacity;
    }
  });

  // Update drag handle mesh when cart width changes
  cartWidthSpring.on("change", (w: number) => {
    if (leftArrowRef.current) {
      leftArrowRef.current.position.x = -w / 2 - 1 + 4 * opacity.get();
    }
    if (rightArrowRef.current) {
      rightArrowRef.current.position.x = w / 2 + 1 - 4 * opacity.get();
    }
    if (dragMeshRef.current) {
      dragMeshRef.current.scale.x = w + 5;
      // const geometry = new THREE.PlaneGeometry(w + 20, height * 0.8);
      // dragMeshRef.current.geometry.dispose();
      // dragMeshRef.current.geometry = geometry;
    }
  });

  // Double-click handler
  const handleDoubleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (playing) return;
      seekPlayer();
      event.stopPropagation();
    },
    [playing, seekPlayer],
  );

  // Hover handlers
  const handlePointerEnter = useCallback(() => {
    if (!previewCurrent && !playing) {
      addPreview({ semanticTime: SemanticTime.Current, stamp: 0, label: "Current" });
    }
  }, [previewCurrent, playing, addPreview]);

  const handlePointerLeave = useCallback(() => {
    removePreview((p) => p.semanticTime === SemanticTime.Current);
  }, [removePreview]);

  const initialLeftOpacity = getOpacity("left", opacity.get(), offset.get());
  const initialRightOpacity = getOpacity("right", opacity.get(), offset.get());

  return (
    <group ref={cartRef as any}>
      {/* Cart body */}
      <group ref={scaleRef as any} scale={[invariantScale.get(), 1, 1]}>
        {/* Dynamic rounded rect version for comparison */}
        <group ref={boxRef as any} position={[0, 0, 0]}>
          <DynamicRoundedRect
            position={[0, cartY, cartDepth]}
            widthMotion={cartWidthSpring}
            heightMotion={cartHeight}
            radius={3}
            // segments={16}
            color={cartColor}
          />

          {/* A horizontal arrow on each side of the cart. These are fixed so that when the cart applies its offset they are exposed */}
          <mesh
            ref={leftArrowRef as any}
            position={[
              -cartWidthSpring.get() / 2 - 1 + 4 * opacity.get(),
              cartY,
              cartDepth - CONE_RADIUS,
            ]}
            scale={[1, 1, 0.1]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <coneGeometry args={[10, 5, cartDepth + 2]} />
            <meshBasicMaterial
              color={cartColor.get()}
              toneMapped={false}
              transparent
              opacity={initialLeftOpacity}
            />
          </mesh>
          <mesh
            ref={rightArrowRef as any}
            position={[
              cartWidthSpring.get() / 2 + 1 - 4 * opacity.get(),
              cartY,
              cartDepth - CONE_RADIUS,
            ]}
            scale={[1, 1, 0.1]}
            rotation={[0, 0, -Math.PI / 2]}
          >
            <coneGeometry args={[10, 5, cartDepth + 2]} />
            <meshBasicMaterial
              color={cartColor.get()}
              toneMapped={false}
              transparent
              opacity={initialRightOpacity}
            />
          </mesh>

          {/* Invisible drag handle mesh */}
          <mesh
            ref={dragMeshRef as any}
            position={[0, cartY, cartDepth + 10]}
            onPointerDown={dragHandlers.onPointerDown}
            onPointerMove={dragHandlers.onPointerMove}
            onPointerUp={dragHandlers.onPointerUp}
            onPointerCancel={dragHandlers.onPointerCancel}
            onDoubleClick={handleDoubleClick}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            scale={[cartWidthSpring.get() + 5, 1, 1]}
          >
            <planeGeometry args={[1, height * 0.8]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        </group>

        {/* Vertical pointer (triangle pointing up/down) */}
        {/* Always centered relative to the line */}
        <mesh
          ref={arrowVertRef as any}
          position={[0, side === "top" ? pointerY - 2 : pointerY + 2, cartDepth + 1]}
          scale={[1, side === "top" ? -1 : 1, 1]}
        >
          <coneGeometry args={[CONE_RADIUS, 5, 4]} />
          <meshBasicMaterial
            color={cartColor.get()}
            toneMapped={false}
            transparent
            opacity={opacity.get()}
          />
        </mesh>

        {/* A line to continue the line from the normal playhead marker */}
        <mesh ref={lineRef as any} position={[0, pointerY, cartDepth + 1]}>
          <planeGeometry args={[1.5, 18]} />
          <meshBasicMaterial
            color={cartColor.get()}
            toneMapped={false}
            transparent
            opacity={opacity.get()}
          />
        </mesh>
      </group>

      {/* Time text */}
      <group
        ref={textRef as any}
        position={[offset.get() * invariantScale.get(), cartY, cartDepth * 2]}
      >
        <PlayheadTime color={textColor} fonts={fonts} />
      </group>
    </group>
  );
});

function getOpacity(side: "left" | "right", opacity: number, offset: number): number {
  if (side === "left" && offset > 0) {
    return 1 - opacity;
  } else if (side === "right" && offset < 0) {
    return 1 - opacity;
  } else {
    return 0;
  }
}

function useCartWidthSpring() {
  const fontSize = 8; // Font size for the time display

  const altPressed = useAltKeyPressed();
  const [framerate, timeDisplay] = useAnimationStore(
    useShallow((s) => [s.framerate, s.timeDisplay]),
  );
  const [stamp, duration] = usePlayerStore(useShallow((s) => [s.player.stamp, s.player.duration]));

  const visualTime = stampToVisualTime(stamp, duration, framerate, timeDisplay, altPressed);

  const size = (visualTime.length + 1) * fontSize;

  const width = useMotionValue(size);
  const widthTween = useTween(width, { duration: 0.07, ease: easeOut });

  useEffect(() => {
    width.set(size);
  }, [size, width]);

  return widthTween;
}

function computeClampedPosition(
  value: number,
  left: number,
  right: number,
  bound: boolean,
): number {
  const bounds = bound ? [Math.max(left, 0), Math.min(right, 1)] : [0, 1];
  return clamp(value, bounds[0], bounds[1]);
}

function computeBoxOffset(
  // Value in [0-1] space,
  value: number,
  // Width of the cart in screen space
  cartWidth: number,
  // Left and right viewport bounds in [0-1] space
  left: number,
  right: number,
  // Scaling factor (multiply to convert to world)
  scale: number,
): [number, number] {
  // Convert to world units
  const l = left / scale;
  const r = right / scale;
  const v = value / scale;
  const halfCart = cartWidth / 2;
  // Radius is 3, so we require that the end of the rounding is where it has to align with the bounds.
  const boxBounds = [l + TIMELINE_PADDING - 7, r - TIMELINE_PADDING + 7];
  // Compute the offset needed to put the box within the bounds, given the clamped position.
  // Calculations assume that the cart is otherwise centered at the clamped position;
  if (v - halfCart < boxBounds[0]) {
    const offset = boxBounds[0] - v + halfCart;
    return [offset, Math.abs(offset) - halfCart + CONE_RADIUS <= 0 ? 1 : 0];
  } else if (v + halfCart > boxBounds[1]) {
    const offset = boxBounds[1] - v - halfCart;
    return [offset, Math.abs(offset) - halfCart + CONE_RADIUS <= 0 ? 1 : 0];
  } else {
    return [0, 1];
  }
}

function usePlayheadCartSprings(
  widthSpring: MotionValue<number>,
  scaleSpring: MotionValue<number>,
  boundWithViewport = false,
): { position: MotionValue<number>; offset: MotionValue<number>; opacity: MotionValue<number> } {
  const [left, right] = useThree(
    useShallow((t) => [
      (t.camera as THREE.OrthographicCamera).left,
      (t.camera as THREE.OrthographicCamera).right,
    ]),
  );

  const defaultPlayheadSpring = usePlayheadSpring();
  const playheadCartSpring = useMotionValue(
    computeClampedPosition(defaultPlayheadSpring.get(), left, right, boundWithViewport),
  );

  const [initialClampedPos, initialOpacity] = computeBoxOffset(
    playheadCartSpring.get(),
    widthSpring.get(),
    left,
    right,
    scaleSpring.get(),
  );

  const boxOffsetSpring = useMotionValue(initialClampedPos);

  const offset = useTween(boxOffsetSpring, {
    duration: 0.07,
    ease: easeOut,
  });

  const opacitySpring = useMotionValue(initialOpacity);

  const opacity = useTween(opacitySpring, {
    duration: 0.07,
    ease: easeOut,
  });

  useFrame(({ camera }) => {
    const [l, r] = [
      (camera as THREE.OrthographicCamera).left,
      (camera as THREE.OrthographicCamera).right,
    ];
    const clampedPosition = computeClampedPosition(
      defaultPlayheadSpring.get(),
      l,
      r,
      boundWithViewport,
    );
    playheadCartSpring.set(clampedPosition);
    const [offsetVal, opacityVal] = computeBoxOffset(
      clampedPosition,
      widthSpring.get(),
      l,
      r,
      scaleSpring.get(), // Offset to keep the box within bounds
    );
    boxOffsetSpring.set(offsetVal);
    opacitySpring.set(opacityVal);
  });

  return { position: playheadCartSpring, offset, opacity };
}

const PlayheadTime = memo(function PlayheadTime({
  color,
  fonts,
}: {
  color: string;
  fonts?: {
    mono?: string;
    ui?: string;
  };
}) {
  const altPressed = useAltKeyPressed();
  const [framerate, timeDisplay] = useAnimationStore(
    useShallow((s) => [s.framerate, s.timeDisplay]),
  );
  const [stamp, duration] = usePlayerStore(useShallow((s) => [s.player.stamp, s.player.duration]));

  const visualTime = stampToVisualTime(stamp, duration, framerate, timeDisplay, altPressed);

  return (
    <TrackText
      text={visualTime}
      color={color}
      name="cart-time-display"
      characters="0123456789:.-sf"
      font={fonts?.mono}
    />
  );
});
