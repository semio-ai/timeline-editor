import { type ReactNode, useState, memo } from "react";
import { animated, SpringValue } from "@react-spring/web";
import { Text } from "@visx/text";
import { useGesture } from "@use-gesture/react";
import { clamp } from "lodash";
import { clsx } from "clsx";
import { closestFrame } from "@semio/utils";
import { stampToVisualTime } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useWithZoom } from "./hooks/use-with-zoom";
import { usePlayheadSpring } from "./hooks/use-playhead-spring";
import { usePlayheadCartPathSpring } from "./hooks/use-playhead-cart-path-spring";
import useAltKeyPressed from "./hooks/use-alt-key-pressed";
import { AnimationActions, AnimationData } from "./store-types";
import { DRAG_X_CONFIG } from "./gesture-config";

export interface PlayheadCartProps {
  side: "top" | "bottom";
  ignoreZoom?: boolean;
}

function PlayheadCart({ side, ignoreZoom }: PlayheadCartProps): ReactNode {
  const {
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
    frameCount,
  } = useTrackBounds();

  const [hovered, setHovered] = useState(false);

  const resetPlayer = useAnimationStore(
    useShallow((state: AnimationActions) => state.resetPlayer),
  );

  const seekPlayer = useAnimationStore(
    useShallow((state: AnimationActions) => state.updatePlayerViewportCenter),
  );

  const withZoom = useWithZoom(ignoreZoom);

  const playheadSpring = usePlayheadSpring(ignoreZoom);

  const { d: playheadCartPath, x } = usePlayheadCartPathSpring(
    side,
    ignoreZoom,
  );

  const gestureBindings = useGesture(
    {
      onDrag: (state) => {
        withZoom((zoomScale) => {
          const newPosition = zoomScale.invert(
            clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
          );
          if (state.altKey) {
            resetPlayer(newPosition);
          } else {
            const closest: number = closestFrame(newPosition, frameCount);
            resetPlayer(closest);
          }
        });
      },
      onHover: (state) => {
        setHovered(state.hovering || false);
      },
      onDoubleClick: (state) => {
        seekPlayer();
        state.event.stopPropagation();
      },
    },
    DRAG_X_CONFIG,
  );

  return (
    <animated.g
      className="touch-none"
      {...gestureBindings()}
      style={{
        transform: playheadSpring.to(
          (c) =>
            `translate(${clamp(xScale(c), xScale(0), xScale(1)).toString()}px, ${side === "top" ? "-3.5" : "3.5"}px)`,
        ),
      }}
    >
      {/* Cart path */}
      <animated.path
        d={playheadCartPath}
        className={clsx("touch-none", getStyle(true, hovered))}
        y={side === "top" ? 20.5 : 0}
      />
      <PlayheadText side={side} x={x} />
    </animated.g>
  );
}

function PlayheadText({
  side,
  x,
}: {
  side: "top" | "bottom";
  x: SpringValue<number>;
}): ReactNode {
  const duration = useAnimationStore(
    useShallow(
      (state: AnimationData) =>
        state.animations[state.activeAnimation].duration,
    ),
  );
  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate),
  );
  const stamp = useAnimationStore(
    useShallow((state: AnimationData) => state.player.stamp),
  );
  const timeDisplay = useAnimationStore(
    useShallow((state: AnimationData) => state.timeDisplay),
  );

  const altPressed = useAltKeyPressed();
  const visualTime = stampToVisualTime(
    stamp,
    duration,
    framerate,
    timeDisplay,
    altPressed,
  );

  return (
    <animated.g
      style={{
        transform: x.to(
          (c) =>
            `translate(${c.toString()}px, ${(side === "top" ? 8.5 : 11.5).toString()}px)`,
        ),
      }}
    >
      <Text
        textAnchor="middle"
        verticalAnchor="start"
        fontSize={10}
        className={clsx("font-mono", "fill-white/75 dark:fill-black/75")}
      >
        {visualTime}
      </Text>
    </animated.g>
  );
}

function getStyle(cart: boolean, hovered: boolean): string {
  if (cart && hovered) {
    return "dark:fill-white/75 fill-black/75";
  } else if (cart) {
    return "dark:fill-white/50 fill-black/50";
  } else {
    return "dark:fill-white fill-black ";
  }
}

export default memo(PlayheadCart);
