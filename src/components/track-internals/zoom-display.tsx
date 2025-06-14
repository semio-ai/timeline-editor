import { memo, useState, useRef, MutableRefObject, RefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion, useTransform } from "motion/react";
import { closestFrame, usePlayerStore } from "@semio/utils";
import { clsx } from "clsx";
import { clamp } from "lodash";
import { useAnimationStore, useTrackContext, useZoomSprings, useZoomGestures } from "../../hooks";
import { DRAG_X_CONFIG } from "../../gesture-config";

function InnerZoomDisplay() {
  const mainGestureRef = useRef<SVGLineElement>(null);
  const leftGestureRef = useRef<SVGPathElement>(null);
  const rightGestureRef = useRef<SVGPathElement>(null);

  const {
    frameCount,
    zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft, height: timelineHeight },
  } = useTrackContext();

  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const updateViewport = usePlayerStore(useShallow((state) => state.updatePlayerViewport));

  const updateHoverpointPreview = useAnimationStore(
    useShallow((state) => state.updateHoverpointPreview),
  );

  const { leftSpring, rightSpring, widthSpring } = useZoomSprings();

  // Handlers for the main zoom gesture
  useZoomGestures(
    mainGestureRef as RefObject<SVGLineElement>,
    {
      onDrag: (state) => {
        setDragging(state.dragging ?? false);
        const currentViewport = zoomScale.current.domain();
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
      },
      onClick: (state) => {
        state.event.stopPropagation();
      },
      onHover: ({ hovering }) => {
        setHovered(hovering ?? false);
        if (!hovering) {
          updateHoverpointPreview(null);
        }
      },
      onMove: (state) => {
        const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
        if (state.altKey) {
          updateHoverpointPreview(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          updateHoverpointPreview(closest);
        }
      },
    },
    DRAG_X_CONFIG,
  );

  // Handlers for the left zoom endpoint element
  useZoomGestures(
    leftGestureRef as RefObject<SVGPathElement>,
    {
      onDrag: (state) => {
        setDragging(state.dragging ?? false);
        const currentViewport = zoomScale.current.domain();
        const newPosition = clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1);
        const newValue = state.altKey ? newPosition : closestFrame(newPosition, frameCount);
        const vals =
          newValue >= currentViewport[1]
            ? [currentViewport[1], newValue]
            : [newValue, currentViewport[1]];
        updateViewport(vals[0], vals[1]);
        state.event.stopPropagation();
      },
      onClick: (state) => {
        state.event.stopPropagation();
      },
      onHover: ({ hovering }) => {
        setHovered(hovering ?? false);
        if (!hovering) {
          updateHoverpointPreview(null);
        }
      },
      onMove: (state) => {
        const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
        if (state.altKey) {
          updateHoverpointPreview(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          updateHoverpointPreview(closest);
        }
      },
    },
    DRAG_X_CONFIG,
  );

  // Handlers for the right zoom endpoint element
  useZoomGestures(
    rightGestureRef as RefObject<SVGPathElement>,
    {
      onDrag: (state) => {
        setDragging(state.dragging ?? false);
        const currentViewport = zoomScale.current.domain();
        const newPosition = clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1);
        const newValue = state.shiftKey ? newPosition : closestFrame(newPosition, frameCount);
        const vals =
          newValue <= currentViewport[0]
            ? [newValue, currentViewport[0]]
            : [currentViewport[0], newValue];
        updateViewport(vals[0], vals[1]);
        state.event.stopPropagation();
      },
      onClick: (state) => {
        state.event.stopPropagation();
      },
      onHover: ({ hovering }) => {
        setHovered(hovering ?? false);
        if (!hovering) {
          updateHoverpointPreview(null);
        }
      },
      onMove: (state) => {
        const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
        if (state.altKey) {
          updateHoverpointPreview(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          updateHoverpointPreview(closest);
        }
      },
    },
    DRAG_X_CONFIG,
  );

  const transformL = useTransform(leftSpring, (v) => `translate(${v.toString()} 0)`);
  const transformR = useTransform(rightSpring, (v) => `translate(${v.toString()} 0)`);

  transformL.on("change", (v) => {
    leftGestureRef.current?.setAttribute("transform", v);
  });

  transformR.on("change", (v) => {
    rightGestureRef.current?.setAttribute("transform", v);
  });

  const x2 = useTransform(() => leftSpring.get() + widthSpring.get());

  const defaultYOffset = timelineHeight / 2 - 5.6 / 2;
  const activeYOffset = timelineHeight / 2 - 11.2;
  const activeYSmOffset = timelineHeight / 2 - 8.4;

  return (
    <g className="group/zoom" aria-selected={dragging || hovered}>
      <motion.line
        ref={mainGestureRef as MutableRefObject<SVGLineElement>}
        className={clsx(
          "transition-[transform,stroke]",
          "group-hover/zoom:stroke-neutral-500/50",
          "group-aria-selected/zoom:stroke-neutral-500/50",
          "stroke-neutral-500/25 cursor-pointer touch-none",
        )}
        x1={leftSpring}
        x2={x2}
        y1={timelineHeight / 2}
        y2={timelineHeight / 2}
        initial={{ strokeWidth: 5.6 }}
        variants={{
          active: { strokeWidth: 22.4 },
          inactive: { strokeWidth: 5.6 },
        }}
        transition={{ duration: 0.1 }}
        animate={hovered || dragging ? "active" : "inactive"}
      />
      <motion.g
        ref={leftGestureRef as MutableRefObject<SVGPathElement>}
        className="touch-none"
        transform={transformL.get()}
      >
        <motion.path
          className={clsx(
            "transition-[fill] fill-neutral-500/25 cursor-ew-resize touch-none",
            "group-hover/zoom:fill-neutral-500 group-aria-selected/zoom:fill-neutral-500",
          )}
          transition={{ duration: 0.1 }}
          animate={hovered || dragging ? "active" : "inactive"}
          initial={{
            d: `M0 ${defaultYOffset.toString()} L0 ${(timelineHeight - defaultYOffset).toString()} L-7 ${(timelineHeight - defaultYOffset).toString()} L-7 ${defaultYOffset.toString()} Z`,
          }}
          variants={{
            active: {
              d: `M0 ${activeYOffset.toString()} L0 ${(timelineHeight - activeYOffset).toString()} L-7 ${(timelineHeight - activeYSmOffset).toString()} L-7 ${activeYSmOffset.toString()} Z`,
            },
            inactive: {
              d: `M0 ${defaultYOffset.toString()} L0 ${(timelineHeight - defaultYOffset).toString()} L-7 ${(timelineHeight - defaultYOffset).toString()} L-7 ${defaultYOffset.toString()} Z`,
            },
          }}
        />
      </motion.g>
      <motion.g
        ref={rightGestureRef as MutableRefObject<SVGPathElement>}
        className="touch-none"
        transform={transformR.get()}
      >
        <motion.path
          className={clsx(
            "transition-[fill] fill-neutral-500/25 cursor-ew-resize touch-none",
            "group-hover/zoom:fill-neutral-500 group-aria-selected/zoom:fill-neutral-500",
          )}
          transition={{ duration: 0.1 }}
          initial={{
            d: `M0 ${defaultYOffset.toString()} L0 ${(timelineHeight - defaultYOffset).toString()} L7 ${(timelineHeight - defaultYOffset).toString()} L7 ${defaultYOffset.toString()} Z`,
          }}
          variants={{
            active: {
              d: `M0 ${activeYOffset.toString()} L0 ${(timelineHeight - activeYOffset).toString()} L7 ${(timelineHeight - activeYSmOffset).toString()} L7 ${activeYSmOffset.toString()} Z`,
            },
            inactive: {
              d: `M0 ${defaultYOffset.toString()} L0 ${(timelineHeight - defaultYOffset).toString()} L7 ${(timelineHeight - defaultYOffset).toString()} L7 ${defaultYOffset.toString()} Z`,
            },
          }}
          animate={hovered || dragging ? "active" : "inactive"}
        />
      </motion.g>
    </g>
  );
}

export const ZoomDisplay = memo(InnerZoomDisplay);
