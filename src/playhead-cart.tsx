import { type ReactNode, useState, memo } from "react";
import { animated, SpringValue } from "@react-spring/web";
import { Text } from "@visx/text";
import { useGesture } from "@use-gesture/react";
import { clamp } from "lodash";
import { clsx } from "clsx";
import {
  closestFrame,
  // getHexagonPath,
  // getDegenerateHexagonPath,
} from "@semio/utils";
import { stampToVisualTime } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useWithZoom } from "./hooks/use-with-zoom";
import { usePlayheadSpring } from "./hooks/use-playhead-spring";
import { usePlayheadCartPathSpring } from "./hooks/use-playhead-cart-path-spring";

const AnimatedText = animated(Text);

export interface PlayheadCartProps {
  side: "top" | "bottom";
  ignoreZoom?: boolean;
}

// const cartWidth = 24;

function PlayheadCart({ side, ignoreZoom }: PlayheadCartProps): ReactNode {
  const {
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
    frameCount,
  } = useTrackBounds();

  const [hovered, setHovered] = useState(false);

  const resetPlayer = useAnimationStore(
    useShallow((state) => state.resetPlayer),
  );

  const withZoom = useWithZoom(ignoreZoom);

  const playheadSpring = usePlayheadSpring(ignoreZoom);

  const { d: playheadCartPath, x } = usePlayheadCartPathSpring(ignoreZoom);

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
    },
    {
      drag: {
        axis: "x",
        filterTaps: true,
        pointer: {
          capture: false,
        },
      },
    },
  );

  return (
    <animated.g
      className="touch-none"
      {...gestureBindings()}
      style={{
        transform: playheadSpring.to(
          (c) =>
            `translate(${clamp(xScale(c), xScale(0), xScale(1)).toString()}px, ${side === "top" ? "0.5" : "0"}px)`,
        ),
      }}
    >
      {/* Cart path */}
      <animated.path
        d={playheadCartPath.to((c) => c)}
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
    useShallow((state) => state.animations[state.activeAnimation].duration),
  );
  const framerate = useAnimationStore(useShallow((state) => state.framerate));
  const stamp = useAnimationStore(useShallow((state) => state.player.stamp));
  const timeDisplay = useAnimationStore(
    useShallow((state) => state.timeDisplay),
  );
  const visualTime = stampToVisualTime(stamp, duration, framerate, timeDisplay);
  return (
    <AnimatedText
      textAnchor="start"
      verticalAnchor="start"
      x={x}
      y={side === "top" ? 8.5 : 11.5}
      fontSize={10}
      className={clsx("font-mono", "fill-white/75 dark:fill-black/75")}
    >
      {visualTime}
    </AnimatedText>
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
