import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { animated } from "@react-spring/web";
import { useGesture } from "@use-gesture/react";
import { closestFrame } from "@semio/utils";
import { clamp } from "lodash";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useZoomSprings } from "./hooks/use-zoom-springs";
import { useWithZoom } from "./hooks/use-with-zoom";
import { TIMELINE_PADDING } from "./constants";

function InnerZoomDisplay() {
  const {
    frameCount,
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackBounds();

  const updateViewport = useAnimationStore(
    useShallow((state) => state.updatePlayerViewport),
  );

  const withZoom = useWithZoom(false);

  const gestureBindingsMain = useGesture(
    {
      onDrag: (state) => {
        withZoom((zoomScale) => {
          const currentViewport = zoomScale.domain();
          let offset = state.delta[0] / timelineWidth;
          if (currentViewport[0] + offset < 0) {
            offset = -currentViewport[0];
          } else if (currentViewport[1] + offset > 1) {
            offset = 1 - currentViewport[1];
          }
          const newValues = currentViewport.map((v) => clamp(v + offset, 0, 1));
          if (state.altKey) {
            updateViewport(newValues[0], newValues[1]);
          } else {
            const newFrameValues = newValues.map((v) =>
              closestFrame(v, frameCount),
            );
            updateViewport(newFrameValues[0], newFrameValues[1]);
          }
          state.event.stopPropagation();
        });
      },
      onClick: (state) => {
        state.event.stopPropagation();
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

  const gestureBindingsLeft = useGesture(
    {
      onDrag: (state) => {
        withZoom((zoomScale) => {
          const currentViewport = zoomScale.domain();
          const newPosition = clamp(
            ((state.xy[0] || 0) - timelineLeft) / timelineWidth,
            0,
            1,
          );
          const newValue = state.altKey
            ? newPosition
            : closestFrame(newPosition, frameCount);
          const vals =
            newValue >= currentViewport[1]
              ? [currentViewport[1], newValue]
              : [newValue, currentViewport[1]];
          updateViewport(vals[0], vals[1]);
          state.event.stopPropagation();
        });
      },
      onClick: (state) => {
        state.event.stopPropagation();
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

  const gestureBindingsRight = useGesture(
    {
      onDrag: (state) => {
        withZoom((zoomScale) => {
          const currentViewport = zoomScale.domain();
          const newPosition = clamp(
            ((state.xy[0] || 0) - timelineLeft) / timelineWidth,
            0,
            1,
          );
          const newValue = state.shiftKey
            ? newPosition
            : closestFrame(newPosition, frameCount);
          const vals =
            newValue <= currentViewport[0]
              ? [newValue, currentViewport[0]]
              : [currentViewport[0], newValue];
          updateViewport(vals[0], vals[1]);
          state.event.stopPropagation();
        });
      },
      onClick: (state) => {
        state.event.stopPropagation();
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

  const { leftSpring, rightSpring, widthSpring } = useZoomSprings();

  return (
    <g className="group/zoom">
      <animated.rect
        {...gestureBindingsMain()}
        className="fill-neutral-500/50 cursor-pointer touch-none"
        x={leftSpring.to((v) => xScale(v))}
        y={3.8}
        width={widthSpring.to((v) => Math.max(0, xScale(v) - TIMELINE_PADDING))}
        height={22.4}
      />
      <animated.path
        {...gestureBindingsLeft()}
        className="fill-neutral-500/50 cursor-ew-resize group-hover/zoom:fill-neutral-500 touch-none"
        d={leftSpring.to(
          (v) =>
            `M${xScale(v).toString()} 3.8 L${xScale(v).toString()} 26.2 L${(xScale(v) - 7).toString()} 21.6 L${(xScale(v) - 7).toString()} 8.4 Z`,
        )}
      />
      <animated.path
        {...gestureBindingsRight()}
        className="fill-neutral-500/50 cursor-ew-resize group-hover/zoom:fill-neutral-500 touch-none"
        d={rightSpring.to(
          (v) =>
            `M${xScale(v).toString()} 3.8 L${xScale(v).toString()} 26.2 L${(xScale(v) + 7).toString()} 21.6 L${(xScale(v) + 7).toString()} 8.4 Z`,
        )}
      />
    </g>
  );
}

export const ZoomDisplay = memo(InnerZoomDisplay);
