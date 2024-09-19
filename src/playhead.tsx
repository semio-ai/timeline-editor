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

export interface PlayheadProps {
  ignoreZoom?: boolean;
}

function Playhead({ ignoreZoom = false }: PlayheadProps): ReactNode {
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
    <animated.g
      style={{
        transform: playheadSpring.to(
          (c) => `translateX(${xScale(c).toString()}px`,
        ),
      }}
      {...gestureBindings()}
    >
      <rect
        x={-10}
        y={-10}
        width={20}
        height={20}
        className="fill-transparent"
      />

      <path d="M0 0 L0 30" className={getStyle(hovered)} />
    </animated.g>
  );
}

function getStyle(hovered: boolean): string {
  if (hovered) {
    return "stroke-2 dark:stroke-white stroke-black";
  } else {
    return "stroke-2 dark:stroke-neutral-300 stroke-neutral-700";
  }
}

export default memo(Playhead);
