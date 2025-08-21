import { Theme, stampToVisualTime } from "@semio/ui";
import { memo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import { usePlayerStore } from "@semio/utils";
import { useMotionValue, easeOut, MotionValue, useTransform, useSpring } from "motion/react";
import { TrackText } from "../shared";
import { DynamicRoundedRect } from "../shared/rounded-rectangle-geometry";
import {
  usePlayheadSpring,
  useAnimationStore,
  useAltKeyPressed,
  usePixelToWorld,
  useInvariantScale,
  useTween,
} from "../../../../hooks";
import { useFrame, useThree } from "@react-three/fiber";
import { clamp } from "lodash";
import { TIMELINE_PADDING } from "../../../../constants";

const CONE_RADIUS = 7; // Radius of the cone for the vertical pointer

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

export const PlayheadCart = memo(function PlayheadCart({
  height = 36,
  theme = Theme.Light,
  side = "top",
  fonts,
}: PlayheadCartProps) {
  const { pixelsToWorldX, pixelsToWorldY } = usePixelToWorld();

  const cartRef = useRef<THREE.Group>(null);
  const scaleRef = useRef<THREE.Group>(null);
  const textRef = useRef<THREE.Group>(null);
  const arrowVertRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Mesh>(null);

  const cartWidthSpring = useCartWidthSpring();
  const invariantScale = useInvariantScale();
  const {
    position: playheadSpring,
    offset,
    opacity,
  } = usePlayheadCartSprings(cartWidthSpring, invariantScale, side === "top");

  // Create motion values for morph target influences
  const cartHeight = useMotionValue(20);

  // Calculate dimensions in world space
  const timelineHeight = height * pixelsToWorldY;

  // Get positioning springs
  // const playheadSpring = usePlayheadSpring();
  // const scaleX = useInvariantScale();
  // const {
  //   width: widthSpring,
  //   offset: offsetSpring,
  //   visibility: visibilitySpring,
  // } = usePlayheadCartSprings(duration, 10, ignoreZoom);

  // Calculate colors based on state
  const colors = {
    cart: theme === Theme.Dark ? "#ffffff" : "#000000", // white/black
    line: theme === Theme.Dark ? "#ffffff" : "#000000",
    text: theme === Theme.Dark ? "#000000" : "#ffffff", // inverted for contrast
  };

  const cartDepth = 10;

  // Calculate cart elements' y positions based on side
  const cartY = side === "top" ? -height / 2 + 19 : height / 2 - 19;
  const pointerY = side === "top" ? -height / 2 + 9 : height / 2 - 9;

  playheadSpring.on("change", (ph) => {
    if (cartRef.current) {
      cartRef.current.position.x = ph;
    }
  });

  const boxRef = useRef<THREE.Mesh>(null);

  // cartWidthSpring.on("change", (w: number) => {
  //   if (boxRef.current) {
  //     console.log("new width", w);
  //     boxRef.current.scale.x = w;
  //   }
  // });

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
  });

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
            color={colors.cart}
          />
        </group>

        {/* Vertical pointer (triangle pointing up/down) */}
        {/* Always centered relative to the line */}
        <mesh
          ref={arrowVertRef as any}
          position={[0, pointerY, cartDepth + 1]}
          scale={[1, side === "top" ? -1 : 1, 1]}
        >
          <coneGeometry args={[CONE_RADIUS, 7, 4]} />
          <meshBasicMaterial
            // color={colors.cart}
            color="red"
            toneMapped={false}
            transparent
            opacity={opacity.get()}
          />
        </mesh>

        {/* A line to continue the line from the normal playhead marker */}
        <mesh ref={lineRef as any} position={[0, pointerY, cartDepth + 1]}>
          <planeGeometry args={[1.5, 18]} />
          <meshBasicMaterial
            color={colors.cart}
            toneMapped={false}
            transparent
            opacity={opacity.get()}
          />
        </mesh>

        {/* A horizontal arrow on each side of the cart. These are fixed so that when the cart applies its offset they are exposed */}
        <mesh
          name="horizontal-pointer"
          position={[-TIMELINE_PADDING + 3, cartY, cartDepth]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <coneGeometry args={[10, 5, cartDepth + 2]} />
          <meshBasicMaterial color="cyan" toneMapped={false} transparent />
        </mesh>
      </group>

      {/* Horizontal pointer (wider triangle) */}

      {/* Vertical line */}
      {/*<mesh name="vertical-line" position={[0, 0, -cartDepth]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={colors.line} toneMapped={false} />
      </mesh>*/}

      {/* Time text */}
      <group
        ref={textRef as any}
        position={[offset.get() * invariantScale.get(), cartY, cartDepth * 2]}
      >
        <PlayheadTime color={colors.text} fonts={fonts} />
      </group>
    </group>
  );
});

function useCartWidthSpring() {
  const fontSize = 8; // Font size for the time display
  // const { pixelsToWorldX } = usePixelToWorld();
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
    return [offset, Math.abs(offset) - halfCart + CONE_RADIUS < 1 ? 1 : 0];
  } else if (v + halfCart > boxBounds[1]) {
    const offset = boxBounds[1] - v - halfCart;
    return [offset, Math.abs(offset) - halfCart + CONE_RADIUS < 1 ? 1 : 0];
  } else {
    return [0, 1];
  }
}

function usePlayheadCartSprings(
  widthSpring: MotionValue<number>,
  scaleSpring: MotionValue<number>,
  boundWithViewport = false,
): { position: MotionValue<number>; offset: MotionValue<number>; opacity: MotionValue<number> } {
  const { pixelsToWorldX } = usePixelToWorld();
  console.log("p2w", pixelsToWorldX, scaleSpring.get());
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
  // const opacitySpring

  // useEffect(() => {
  //   console.log("new bounds", [left, right]);
  // }, [left, right]);
  // const defaultPlayheadSpring = usePlayheadSpring();
  // const playheadSpring = useTransform(defaultPlayheadSpring, (v: number) => {
  //   if (boundWithViewport) {
  //     return clamp(v, left, right);
  //   } else {
  //     return v;
  //   }
  // });

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

// Separate component to handle the cart rendering and animation
// const CartGroup = memo(function CartGroup({
//   playheadSpring,
//   scaleX,
//   offsetSpring,
//   widthSpring,
//   visibilitySpring,
//   pixelsToWorldX,
//   colors,
//   cartY,
//   cartHeight,
//   cartDepth,
//   pointerY,
//   pointerHeight,
//   lineWidth,
//   timelineHeight,
// }: {
//   playheadSpring: any;
//   scaleX: any;
//   offsetSpring: any;
//   widthSpring: any;
//   visibilitySpring: any;
//   pixelsToWorldX: number;
//   colors: { cart: string; line: string; text: string };
//   cartY: number;
//   cartHeight: number;
//   cartDepth: number;
//   pointerY: number;
//   pointerHeight: number;
//   lineWidth: number;
//   timelineHeight: number;
// }) {
//   // Use useFrame to update positions directly
//   // useFrame(({ scene }) => {
//   //   const cartGroup = scene.getObjectByName("playhead-cart-group");
//   //   if (!cartGroup) return;

//   //   const currentPlayhead = Number(playheadSpring.get());
//   //   const currentOffset = Number(offsetSpring.get()) * pixelsToWorldX;
//   //   const currentWidth = Number(widthSpring.get()) * pixelsToWorldX;
//   //   const currentVisibility = Number(visibilitySpring.get());
//   //   const currentScaleX = Number(scaleX.get());

//   //   // Update main cart group position
//   //   cartGroup.position.x = currentPlayhead;

//   //   // Update cart body
//   //   const cartBody = cartGroup.getObjectByName("cart-body");
//   //   if (cartBody) {
//   //     cartBody.position.x = currentOffset + currentWidth / 2;
//   //     cartBody.scale.set(currentWidth, cartHeight, cartDepth);
//   //   }

//   //   // Update pointers based on visibility
//   //   const isHorizontalMode = Math.abs(currentVisibility) > 0.5;

//   //   const verticalPointer = cartGroup.getObjectByName("vertical-pointer");
//   //   if (verticalPointer) {
//   //     const scale = isHorizontalMode ? 0 : 1;
//   //     verticalPointer.scale.set(currentScaleX * scale, scale, scale);
//   //     verticalPointer.position.set(0, pointerY, cartDepth);
//   //   }

//   //   const horizontalPointer = cartGroup.getObjectByName("horizontal-pointer");
//   //   if (horizontalPointer) {
//   //     const scale = isHorizontalMode ? 1 : 0;
//   //     horizontalPointer.scale.set(currentScaleX * scale, scale, scale);
//   //     horizontalPointer.position.set(0, pointerY, cartDepth);
//   //   }

//   //   // Update vertical line
//   //   const verticalLine = cartGroup.getObjectByName("vertical-line");
//   //   if (verticalLine) {
//   //     const lineHeight = isHorizontalMode ? 0 : timelineHeight;
//   //     verticalLine.scale.set(currentScaleX * lineWidth, lineHeight, 1);
//   //     verticalLine.position.set(0, 0, -cartDepth);
//   //   }

//   //   // Update text position
//   //   const textGroup = cartGroup.getObjectByName("text-group");
//   //   if (textGroup) {
//   //     textGroup.position.set(currentOffset + currentWidth / 2, cartY, cartDepth * 2);
//   //   }
//   // });

//   return (
//     <group name="playhead-cart-group">
//       {/* Cart body */}
//       <mesh name="cart-body" position={[0, cartY, cartDepth]}>
//         <planeGeometry args={[1, 1]} />
//         <meshBasicMaterial color={colors.cart} toneMapped={false} />
//       </mesh>

//       {/* Vertical pointer (triangle pointing up/down) */}
//       {/*<mesh name="vertical-pointer" position={[0, pointerY, cartDepth]}>
//         <coneGeometry args={[4 * pixelsToWorldX, pointerHeight, 3]} />
//         <meshBasicMaterial color={colors.cart} toneMapped={false} />
//       </mesh>*/}

//       {/* Horizontal pointer (wider triangle) */}
//       {/*<mesh name="horizontal-pointer" position={[0, pointerY, cartDepth]}>
//         <coneGeometry args={[8 * pixelsToWorldX, pointerHeight * 0.6, 3]} />
//         <meshBasicMaterial color={colors.cart} toneMapped={false} />
//       </mesh>*/}

//       {/* Vertical line */}
//       {/*<mesh name="vertical-line" position={[0, 0, -cartDepth]}>
//         <planeGeometry args={[1, 1]} />
//         <meshBasicMaterial color={colors.line} toneMapped={false} />
//       </mesh>*/}

//       {/* Time text */}
//       <group name="text-group" position={[0, cartY, cartDepth * 2]}>
//         <PlayheadTime color={colors.text} />
//       </group>
//     </group>
//   );
// });

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
