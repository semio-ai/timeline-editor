import { memo, useState, useRef, MutableRefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import { animated, useSpring } from "@react-spring/web";
import { closestFrame } from "@semio/utils";
import { clsx } from "clsx";
import { clamp } from "lodash";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackContext } from "./hooks/use-track-context";
import { useZoomSprings } from "./hooks/use-zoom-springs";
import { useHoverSpring } from "./hooks/use-hover-spring";
import { useWithZoom } from "./hooks/use-with-zoom";
import { useZoomGestures } from "./hooks/use-zoom-gestures";
import { TIMELINE_PADDING } from "./constants";
import { easeConfig } from "./spring-config";
import { DRAG_X_CONFIG } from "./gesture-config";

function InnerZoomDisplay() {
  const mainGestureRef = useRef<SVGRectElement>();
  const leftGestureRef = useRef<SVGPathElement>();
  const rightGestureRef = useRef<SVGPathElement>();

  const {
    frameCount,
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackContext();

  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const { setHoverpoint, clearHoverpoint } = useHoverSpring(true);

  const updateViewport = useAnimationStore(useShallow((state) => state.updatePlayerViewport));

  const withZoom = useWithZoom(false);

  const { leftSpring, rightSpring, widthSpring } = useZoomSprings();

  const [{ leftPath, rightPath }] = useSpring(
    {
      leftPath:
        hovered || dragging
          ? `M0 3.8 L0 26.2 L-7 21.6 L-7 8.4 Z`
          : `M0 12.2 L0 17.8 L-7 17.8 L-7 12.2 Z`,
      rightPath:
        hovered || dragging
          ? `M0 3.8 L0 26.2 L7 21.6 L7 8.4 Z`
          : `M0 12.2 L0 17.8 L7 17.8 L7 12.2 Z`,
      config: easeConfig,
    },
    [xScale, leftSpring, rightSpring, hovered, dragging],
  );

  // Handlers for the main zoom gesture
  useZoomGestures(
    mainGestureRef as MutableRefObject<SVGRectElement>,
    {
      onDrag: (state) => {
        setDragging(state.dragging ?? false);
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
            const newFrameValues = newValues.map((v) => closestFrame(v, frameCount));
            updateViewport(newFrameValues[0], newFrameValues[1]);
          }
          state.event.stopPropagation();
        });
      },
      onClick: (state) => {
        state.event.stopPropagation();
      },
      onHover: ({ hovering }) => {
        setHovered(hovering ?? false);
        if (!hovering) {
          clearHoverpoint();
        }
      },
      onMove: (state) => {
        const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
        if (state.altKey) {
          setHoverpoint(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          setHoverpoint(closest);
        }
      },
    },
    DRAG_X_CONFIG,
  );

  // Handlers for the left zoom endpoint element
  useZoomGestures(
    leftGestureRef as MutableRefObject<SVGPathElement>,
    {
      onDrag: (state) => {
        setDragging(state.dragging ?? false);
        withZoom((zoomScale) => {
          const currentViewport = zoomScale.domain();
          const newPosition = clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1);
          const newValue = state.altKey ? newPosition : closestFrame(newPosition, frameCount);
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
      onHover: ({ hovering }) => {
        setHovered(hovering ?? false);
        if (!hovering) {
          clearHoverpoint();
        }
      },
      onMove: (state) => {
        const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
        if (state.altKey) {
          setHoverpoint(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          setHoverpoint(closest);
        }
      },
    },
    DRAG_X_CONFIG,
  );

  // Handlers for the right zoom endpoint element
  useZoomGestures(
    rightGestureRef as MutableRefObject<SVGPathElement>,
    {
      onDrag: (state) => {
        setDragging(state.dragging ?? false);
        withZoom((zoomScale) => {
          const currentViewport = zoomScale.domain();
          const newPosition = clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1);
          const newValue = state.shiftKey ? newPosition : closestFrame(newPosition, frameCount);
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
      onHover: ({ hovering }) => {
        setHovered(hovering ?? false);
        if (!hovering) {
          clearHoverpoint();
        }
      },
      onMove: (state) => {
        const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
        if (state.altKey) {
          setHoverpoint(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          setHoverpoint(closest);
        }
      },
    },
    DRAG_X_CONFIG,
  );

  return (
    <g className="group/zoom" aria-selected={dragging || hovered}>
      <animated.rect
        ref={mainGestureRef as MutableRefObject<SVGRectElement>}
        className={clsx(
          "transition-[transform,fill]",
          "group-hover/zoom:fill-neutral-500/50",
          "group-aria-selected/zoom:fill-neutral-500/50",
          "group-hover/zoom:translate-y-[3.8px] group-hover/zoom:scale-y-100",
          "group-aria-selected/zoom:translate-y-[3.8px] group-aria-selected/zoom:scale-y-100",
          "fill-neutral-500/25 cursor-pointer touch-none",
          "scale-y-[25%] translate-y-[12.2px]",
        )}
        x={leftSpring.to((v) => xScale(v))}
        // y={3.8}
        width={widthSpring.to((v) => Math.max(0, xScale(v) - TIMELINE_PADDING))}
        height={22.4}
      />
      <animated.g
        ref={leftGestureRef as MutableRefObject<SVGPathElement>}
        className="touch-none"
        style={{
          transform: leftSpring.to((ls) => `translateX(${xScale(ls).toString()}px)`),
        }}
      >
        <animated.path
          className={clsx(
            "transition-[fill] fill-neutral-500/25 cursor-ew-resize touch-none",
            "group-hover/zoom:fill-neutral-500 group-aria-selected/zoom:fill-neutral-500",
          )}
          d={leftPath}
        />
      </animated.g>
      <animated.g
        ref={rightGestureRef as MutableRefObject<SVGPathElement>}
        className="touch-none"
        style={{
          transform: rightSpring.to((rs) => `translateX(${xScale(rs).toString()}px)`),
        }}
      >
        <animated.path
          className={clsx(
            "transition-[fill] fill-neutral-500/25 cursor-ew-resize touch-none",
            "group-hover/zoom:fill-neutral-500 group-aria-selected/zoom:fill-neutral-500",
          )}
          d={rightPath}
        />
      </animated.g>
    </g>
  );
}

export const ZoomDisplay = memo(InnerZoomDisplay);
