import { type ReactNode, useState, memo } from "react";
import { animated } from "@react-spring/web";
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
          if (state.shiftKey) {
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
      style={{
        transform: playheadSpring.to(
          (c) => `translateX(${xScale(c).toString()}px`,
        ),
      }}
      {...gestureBindings()}
    >
      {/* Top triangle */}
      {side === "top" && (
        <path d="M-6 24 L0 27.5 L6 24 Z" className={getStyle(true, hovered)} />
      )}
      {/* Bottom triangle */}
      {side === "bottom" && (
        <path d="M-6 4 L0 0.5 L6 4 Z" className={getStyle(true, hovered)} />
      )}
      <rect
        width="24"
        height="12"
        y={side === "top" ? 12 : 4}
        x="-12"
        className={getStyle(true, hovered)}
      />
    </animated.g>
  );
}

function getStyle(onBounds: boolean, hovered: boolean): string {
  if (onBounds && hovered) {
    return "dark:fill-white fill-black";
  } else if (onBounds) {
    return "dark:fill-neutral-300 fill-neutral-700";
  } else {
    return "fill-transparent";
  }
}

export default memo(PlayheadCart);
