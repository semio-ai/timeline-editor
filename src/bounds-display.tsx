import { useRef, useState, memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { useGesture } from "@use-gesture/react";
import { closestFrame } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import type { ScaleLinear } from "./scale-linear";

export interface BoundsDisplayProps {
  xScale: ScaleLinear;
  timelineWidth: number;
  timelineLeft: number;
  frameCount: number;
  parentActive: boolean;
}

function InnerBoundsDisplay({
  xScale,
  timelineWidth,
  timelineLeft,
  frameCount,
  parentActive,
}: BoundsDisplayProps) {
  const bounds = useAnimationStore(useShallow((state) => state.player.bounds));
  const initialBounds = useRef<[number, number]>(bounds);
  const updateBounds = useAnimationStore(
    useShallow((state) => state.updatePlayerBounds),
  );
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const gestureBindingsLeft = useGesture({
    onDragStart: () => {
      setDragging(true);
      initialBounds.current = bounds;
    },
    onDragEnd: () => setDragging(false),
    onHover: ({ hovering: h }) => setHovering(h || false),
    onDrag: (state) => {
      const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
      const newValue = state.shiftKey
        ? newPosition
        : closestFrame(newPosition, frameCount);
      const vals =
        newValue >= initialBounds.current[1]
          ? [initialBounds.current[1], newValue]
          : [newValue, initialBounds.current[1]];
      updateBounds(vals[0], vals[1]);
      state.event.stopPropagation();
    },
  });

  const gestureBindingsRight = useGesture({
    onDragStart: () => {
      setDragging(true);
      initialBounds.current = bounds;
    },
    onDragEnd: () => setDragging(false),
    onHover: ({ hovering: h }) => setHovering(h || false),
    onDrag: (state) => {
      const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
      const newValue = state.shiftKey
        ? newPosition
        : closestFrame(newPosition, frameCount);
      const vals =
        newValue <= initialBounds.current[0]
          ? [newValue, initialBounds.current[0]]
          : [initialBounds.current[0], newValue];
      updateBounds(vals[0], vals[1]);
      state.event.stopPropagation();
    },
  });

  return (
    <>
      <path
        d={`M${xScale(0).toString()} 11 L${xScale(bounds[0]).toString()} 11`}
        className={clsx(
          parentActive ? "stroke-[22px]" : "stroke-[5px]",
          "dark:stroke-neutral-800/50 stroke-neutral-200/50 ransition-all duration-75",
        )}
      />
      <path
        d={`M${xScale(bounds[1]).toString()} 11 L${xScale(1).toString()} 11`}
        className={clsx(
          parentActive ? "stroke-[22px]" : "stroke-[5px]",
          "dark:stroke-neutral-800/50 stroke-neutral-200/50 transition-all duration-75",
        )}
      />
      <rect
        x={xScale(bounds[0])}
        y={0}
        width={xScale(bounds[1]) - xScale(bounds[0])}
        height={22}
        className={
          parentActive && dragging
            ? "cursor-ew-resize fill-primary-600/25"
            : "fill-transparent"
        }
      />
      <path
        {...gestureBindingsLeft()}
        d={
          hovering
            ? `M${(xScale(bounds[0]) - 5).toString()} 0 L${xScale(bounds[0]).toString()} 10 L${(xScale(bounds[0]) + 5).toString()} 0`
            : `M${(xScale(bounds[0]) - 3.5).toString()} 0 L${xScale(bounds[0]).toString()} 7 L${(xScale(bounds[0]) + 3.5).toString()} 0`
        }
        className={clsx(
          "cursor-ew-resize touch-none",
          parentActive
            ? "fill-primary-600 hover:fill-primary-500"
            : "fill-transparent",
        )}
      />

      <path
        {...gestureBindingsRight()}
        d={
          hovering
            ? `M${(xScale(bounds[1]) - 5).toString()} 0 L${xScale(bounds[1]).toString()} 10 L${(xScale(bounds[1]) + 5).toString()} 0`
            : `M${(xScale(bounds[1]) - 3.5).toString()} 0 L${xScale(bounds[1]).toString()} 7 L${(xScale(bounds[1]) + 3.5).toString()} 0`
        }
        className={clsx(
          "cursor-ew-resize touch-none",
          parentActive
            ? "fill-primary-600 hover:fill-primary-500"
            : "fill-transparent",
        )}
      />
    </>
  );
}

export const BoundsDisplay = memo(InnerBoundsDisplay);
