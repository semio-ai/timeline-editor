import { useRef, memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { animated } from "@react-spring/web";
import { useGesture } from "@use-gesture/react";
import { closestFrame } from "@semio/utils";
import { clamp } from "lodash";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useZoomSprings } from "./hooks/use-zoom-springs";

function InnerZoomDisplay() {
  const {
    frameCount,
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackBounds();
  const viewport = useAnimationStore(
    useShallow((state) => state.player.viewport),
  );

  const initialViewport = useRef<[number, number]>(viewport);
  const updateViewport = useAnimationStore(
    useShallow((state) => state.updatePlayerViewport),
  );

  const gestureBindingsMain = useGesture(
    {
      onDragStart: () => {
        // setDragging(true);
        initialViewport.current = viewport;
      },
      onDragEnd: (state) => {
        // setDragging(false);
        state.event.stopPropagation();
      },
      onDrag: (state) => {
        let offset = state.offset[0] / timelineWidth;
        if (initialViewport.current[0] + offset < 0) {
          offset = -initialViewport.current[0];
        } else if (initialViewport.current[1] + offset > 1) {
          offset = 1 - initialViewport.current[1];
        }

        const newValues = initialViewport.current.map((v) =>
          clamp(v + offset, 0, 1),
        );

        if (state.altKey) {
          updateViewport(newValues[0], newValues[1]);
        } else {
          const newFrameValues = newValues.map((v) =>
            closestFrame(v, frameCount),
          );
          updateViewport(newFrameValues[0], newFrameValues[1]);
        }
        state.event.stopPropagation();
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
      onDragStart: () => {
        // setDragging(true);
        initialViewport.current = viewport;
      },
      onDragEnd: (state) => {
        // setDragging(false);
        state.event.stopPropagation();
      },
      // onHover: ({ hovering: h }) => setHovering(h || false),
      onDrag: (state) => {
        const newPosition = clamp(
          ((state.xy[0] || 0) - timelineLeft) / timelineWidth,
          0,
          1,
        );
        const newValue = state.altKey
          ? newPosition
          : closestFrame(newPosition, frameCount);
        const vals =
          newValue >= initialViewport.current[1]
            ? [initialViewport.current[1], newValue]
            : [newValue, initialViewport.current[1]];
        updateViewport(vals[0], vals[1]);
        state.event.stopPropagation();
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
      onDragStart: () => {
        // setDragging(true);
        initialViewport.current = viewport;
      },
      onDragEnd: (state) => {
        // setDragging(false);
        state.event.stopPropagation();
      },
      // onHover: ({ hovering: h }) => setHovering(h || false),
      onDrag: (state) => {
        const newPosition = clamp(
          ((state.xy[0] || 0) - timelineLeft) / timelineWidth,
          0,
          1,
        );
        const newValue = state.shiftKey
          ? newPosition
          : closestFrame(newPosition, frameCount);
        const vals =
          newValue <= initialViewport.current[0]
            ? [newValue, initialViewport.current[0]]
            : [initialViewport.current[0], newValue];
        updateViewport(vals[0], vals[1]);
        state.event.stopPropagation();
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
  const scaledViewport = viewport.map(xScale) as [number, number];
  // const zoomBounds = bounds.map(zoomScale) as [number, number];
  const { leftSpring, rightSpring } = useZoomSprings();

  return (
    <g className="group/zoom">
      <animated.path
        {...gestureBindingsMain()}
        className="fill-neutral-500/50 cursor-pointer touch-none"
        d={`M${scaledViewport[0].toString()} 3.8 ${scaledViewport[1].toString()} 3.8 L${(scaledViewport[1] + 7).toString()} 8.4 L${(scaledViewport[1] + 7).toString()} 21.6 L${scaledViewport[1].toString()} 26.2 ${scaledViewport[0].toString()} 26.2 L${(scaledViewport[0] - 7).toString()} 21.6 L${(scaledViewport[0] - 7).toString()} 8.4 Z`}
      />
      <animated.path
        {...gestureBindingsLeft()}
        className="fill-transparent cursor-ew-resize group-hover/zoom:fill-neutral-500 touch-none"
        d={leftSpring.to(
          (v) =>
            `M${xScale(v).toString()} 3.8 L${xScale(v).toString()} 26.2 L${(xScale(v) - 7).toString()} 21.6 L${(xScale(v) - 7).toString()} 8.4 Z`,
        )}
      />
      <animated.path
        {...gestureBindingsRight()}
        className="fill-transparent cursor-ew-resize group-hover/zoom:fill-neutral-500 touch-none"
        d={rightSpring.to(
          (v) =>
            `M${xScale(v).toString()} 3.8 L${xScale(v).toString()} 26.2 L${(xScale(v) + 7).toString()} 21.6 L${(xScale(v) + 7).toString()} 8.4 Z`,
        )}
      />
    </g>
  );
}

export const ZoomDisplay = memo(InnerZoomDisplay);
