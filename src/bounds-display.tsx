import { useRef, useState, memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { useGesture } from "@use-gesture/react";
import { closestFrame } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackBounds } from "./hooks/use-track-bounds";
import type { ScaleLinear } from "./scale-linear";

export interface BoundsDisplayProps {
  parentActive: boolean;
}

function InnerBoundsDisplay({ parentActive }: BoundsDisplayProps) {
  const {
    frameCount,
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackBounds();
  const bounds = useAnimationStore(useShallow((state) => state.player.bounds));
  const initialBounds = useRef<[number, number]>(bounds);
  const updateBounds = useAnimationStore(
    useShallow((state) => state.updatePlayerBounds),
  );
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const gestureBindingsLeft = useGesture(
    {
      onDragStart: () => {
        setDragging(true);
        initialBounds.current = bounds;
      },
      onDragEnd: (state) => {
        setDragging(false);
        state.event.stopPropagation();
      },
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
      onClick: (state) => {
        state.event.stopPropagation();
      },
    },
    { drag: { filterTaps: true } },
  );

  const gestureBindingsRight = useGesture(
    {
      onDragStart: () => {
        setDragging(true);
        initialBounds.current = bounds;
      },
      onDragEnd: (state) => {
        setDragging(false);
        state.event.stopPropagation();
      },
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
      onClick: (state) => {
        state.event.stopPropagation();
      },
    },
    { drag: { filterTaps: true } },
  );

  return (
    <>
      <path
        d={`M${xScale(0).toString()} 11 L${xScale(bounds[0]).toString()} 11`}
        className={clsx(
          parentActive ? "stroke-[22px]" : "stroke-[6.2px]",
          "dark:stroke-neutral-800/50 stroke-neutral-200/50 ransition-all duration-75",
        )}
      />
      <path
        d={`M${xScale(bounds[1]).toString()} 11 L${xScale(1).toString()} 11`}
        className={clsx(
          parentActive ? "stroke-[22px]" : "stroke-[6.2px]",
          "dark:stroke-neutral-800/50 stroke-neutral-200/50 transition-all duration-75",
        )}
      />
      <rect
        x={xScale(bounds[0])}
        y={0}
        width={Math.max(0, xScale(bounds[1]) - xScale(bounds[0]))}
        height={22}
        className={
          parentActive && dragging
            ? "cursor-ew-resize fill-neutral-600/25"
            : "fill-transparent"
        }
      />
      <g>
        <path
          d={getPath(xScale, bounds, "left")}
          className={clsx(
            "transition-[fill]",
            getFill("left", hovering, bounds[0] === 0, parentActive),
          )}
        />
        <rect
          {...gestureBindingsLeft()}
          x={xScale(bounds[0]) - (hovering ? 10 : 7)}
          y={0}
          width={hovering ? 20 : 14}
          height={22}
          className="cursor-ew-resize touch-none fill-transparent"
        />
      </g>

      <g>
        <path
          d={getPath(xScale, bounds, "right")}
          className={clsx(
            "transition-[fill]",
            getFill("right", hovering, bounds[1] === 1, parentActive),
          )}
        />
        <rect
          {...gestureBindingsRight()}
          x={xScale(bounds[1]) - (hovering ? 10 : 14)}
          y={0}
          width={hovering ? 20 : 14}
          height={22}
          className="cursor-ew-resize touch-none fill-transparent"
        />
      </g>
    </>
  );
}

function getFill(
  side: "left" | "right",
  hovering: boolean,
  atBounds: boolean,
  parentActive: boolean,
): string {
  if (hovering) {
    return side === "left"
      ? "dark:fill-success-400 fill-success-600"
      : "dark:fill-error-400 fill-error-600";
  } else if (!atBounds) {
    return side === "left" ? "fill-success-500" : "fill-error-500";
  } else {
    return parentActive
      ? "dark:fill-white/50 fill-black/50"
      : "fill-transparent";
  }
}

function getPath(
  xScale: ScaleLinear,
  bounds: [number, number],
  side: "left" | "right",
): string {
  const width = 6.35;
  const height = 3.7;
  const x = side === "left" ? xScale(bounds[0]) : xScale(bounds[1]);
  const trailing = side === "left" ? x + width : x - width;
  return `M${x.toString()} 0 L${trailing.toString()} 0 L${x.toString()} ${(0 + height).toString()} L${x.toString()} ${(22 - height).toString()} L${trailing.toString()} 22 L${x.toString()} 22 Z`;
}

export const BoundsDisplay = memo(InnerBoundsDisplay);
