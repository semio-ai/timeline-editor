import { type ReactNode, useState, memo } from "react";
import { animated } from "@react-spring/web";
import { Text } from "@visx/text";
import { useGesture } from "@use-gesture/react";
import { clamp } from "lodash";
import {
  closestFrame,
  // getHexagonPath,
  // getDegenerateHexagonPath,
} from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useWithZoom } from "./hooks/use-with-zoom";
import { usePlayheadSpring } from "./hooks/use-playhead-spring";

const AnimatedText = animated(Text);

export interface PlayheadCartProps {
  side: "top" | "bottom";
  ignoreZoom?: boolean;
}

const cartWidth = 24;

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
    <g {...gestureBindings()}>
      {/* Top triangle */}
      {side === "top" && (
        <animated.path
          d="M-6 24 L0 27.5 L6 24 Z"
          className={getStyle(false, hovered)}
          style={{
            transform: playheadSpring.to(
              (c) => `translateX(${xScale(c).toString()}px`,
            ),
          }}
        />
      )}
      {/* Bottom triangle */}
      {side === "bottom" && (
        <animated.path
          d="M-6 4 L0 0.5 L6 4 Z"
          className={getStyle(false, hovered)}
          style={{
            transform: playheadSpring.to(
              (c) => `translateX(${xScale(c).toString()}px`,
            ),
          }}
        />
      )}
      <animated.rect
        width={cartWidth}
        height="12"
        y={side === "top" ? 12 : 4}
        x={-cartWidth / 2}
        className={getStyle(true, hovered)}
        style={{
          transform: playheadSpring.to(
            (c) =>
              `translateX(${side === "top" ? xScale(c).toString() : clamp(xScale(c), xScale.range()[0] + 6, xScale.range()[1] - 6).toString()}px`,
          ),
        }}
      />
      {false && (
        <AnimatedText
          x={0}
          y={side === "top" ? 30 : -10}
          textAnchor="middle"
          fill="black"
          fontSize={12}
          fontWeight="bold"
        >
          3s
        </AnimatedText>
      )}
    </g>
  );
}

function getStyle(cart: boolean, hovered: boolean): string {
  if (cart && hovered) {
    return "dark:fill-white fill-black dark:stroke-white stroke-black stroke-2";
  } else if (cart) {
    return "dark:fill-white/90 fill-white/90 dark:stroke-white stroke-black stroke-2";
  } else {
    return "dark:fill-white fill-white ";
  }
}

export default memo(PlayheadCart);
