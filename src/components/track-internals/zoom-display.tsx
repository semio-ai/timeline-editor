import { memo, useState, useRef, MutableRefObject, RefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion, useTransform } from "motion/react";
import { closestFrame, usePlayerStore } from "@semio/utils";
import { clsx } from "clsx";
import { clamp } from "lodash";
import { useAnimationStore, useTrackContext, useZoomSprings, useZoomGestures } from "../../hooks";
import { TIMELINE_PADDING } from "../../constants";
import { DRAG_X_CONFIG } from "../../gesture-config";

function InnerZoomDisplay() {
  const mainGestureRef = useRef<SVGLineElement>(null);
  const leftGestureRef = useRef<SVGPathElement>(null);
  const rightGestureRef = useRef<SVGPathElement>(null);

  const {
    frameCount,
    xScale,
    zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft },
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

  const x = useTransform(leftSpring, (v) => xScale(v));
  const w = useTransform(widthSpring, (v) => Math.max(0, xScale(v) - TIMELINE_PADDING));
  const transformL = useTransform(leftSpring, (v) => `translate(${xScale(v).toString()} 0)`);
  const transformR = useTransform(rightSpring, (v) => `translate(${xScale(v).toString()} 0)`);

  transformL.on("change", (v) => {
    leftGestureRef.current?.setAttribute("transform", v);
  });

  transformR.on("change", (v) => {
    rightGestureRef.current?.setAttribute("transform", v);
  });

  const x2 = useTransform(() => x.get() + w.get());

  return (
    <g className="group/zoom" aria-selected={dragging || hovered}>
      <motion.line
        ref={mainGestureRef as MutableRefObject<SVGLineElement>}
        className={clsx(
          "transition-[transform,stroke]",
          "group-hover/zoom:stroke-neutral-500/50",
          "group-aria-selected/zoom:stroke-neutral-500/50",
          // "group-hover/zoom:translate-y-[3.8px] group-hover/zoom:scale-y-100",
          // "group-aria-selected/zoom:translate-y-[3.8px] group-aria-selected/zoom:scale-y-100",
          "stroke-neutral-500/25 cursor-pointer touch-none",
          // "scale-y-[25%] translate-y-[12.2px]",
        )}
        x1={x}
        x2={x2}
        y1={15}
        y2={15}
        // y={3.8}
        initial={{ strokeWidth: 5.6 }}
        variants={{
          active: { strokeWidth: 22.4 },
          inactive: { strokeWidth: 5.6 },
        }}
        transition={{ duration: 0.1 }}
        animate={hovered || dragging ? "active" : "inactive"}
        // height={22.4}
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
          initial={{ d: "M0 12.2 L0 17.8 L-7 17.8 L-7 12.2 Z" }}
          variants={{
            active: { d: "M0 3.8 L0 26.2 L-7 21.6 L-7 8.4 Z" },
            inactive: { d: "M0 12.2 L0 17.8 L-7 17.8 L-7 12.2 Z" },
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
          initial={{ d: "M0 12.2 L0 17.8 L7 17.8 L7 12.2 Z" }}
          variants={{
            active: { d: "M0 3.8 L0 26.2 L7 21.6 L7 8.4 Z" },
            inactive: { d: "M0 12.2 L0 17.8 L7 17.8 L7 12.2 Z" },
          }}
          animate={hovered || dragging ? "active" : "inactive"}
        />
      </motion.g>
    </g>
  );
}

export const ZoomDisplay = memo(InnerZoomDisplay);
