import { type ReactNode, useState, memo } from "react";
import { animated } from "@react-spring/web";
import { useGesture } from "@use-gesture/react";
import { clamp } from "lodash";
import { closestFrame, usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useTrackContext, usePlayheadSpring } from "../../hooks";
import { DRAG_X_CONFIG } from "../../gesture-config";

export interface PlayheadProps {
  ignoreZoom?: boolean;
  height?: number;
}

function InnerPlayhead({ ignoreZoom = false, height = 30 }: PlayheadProps): ReactNode {
  const {
    xScale,
    zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft },
    frameCount,
  } = useTrackContext();

  const [hovered, setHovered] = useState(false);

  const resetPlayer = usePlayerStore(useShallow((state) => state.resetPlayer));

  const playheadSpring = usePlayheadSpring(ignoreZoom);

  const gestureBindings = useGesture(
    {
      onDrag: (state) => {
        // withZoom((zoomScale) => {
        const newPosition = zoomScale.current.invert(
          clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
        );
        if (state.altKey) {
          resetPlayer(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          resetPlayer(closest);
        }
        // });
      },
      onHover: (state) => {
        setHovered(state.hovering || false);
      },
    },
    DRAG_X_CONFIG,
  );

  return (
    <animated.g
      style={{
        transform: playheadSpring.to((c) => `translateX(${xScale(c).toString()}px`),
      }}
      {...gestureBindings()}
    >
      {/* This is an element that makes a slightly larger hitbox */}
      <rect x={-2.5} y={0} width={5} height={height} className="fill-transparent" />

      <path d={`M 0 0 L 0 ${height.toString()}`} className={getStyle(hovered)} />
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

export const Playhead = memo(InnerPlayhead);
