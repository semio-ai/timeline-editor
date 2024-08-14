import { useRef, useState, memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { useGesture } from "@use-gesture/react";
import { closestFrame } from "@semio/utils";
import { clamp } from "lodash";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackBounds } from "./hooks/use-track-bounds";
import type { ScaleLinear } from "./scale-linear";
import { SemanticTime } from "./store-types";
import { TIMELINE_PADDING } from "./constants";

export interface ZoomDisplayProps {
  isTop?: boolean;
  isBottom?: boolean;
}

function InnerZoomDisplay({ isTop = true, isBottom = true }: ZoomDisplayProps) {
  const {
    frameCount,
    scale: xScale,
    zoom: zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackBounds();
  const viewport = useAnimationStore(
    useShallow((state) => state.player.viewport),
  );
  const [
    previewLeft,
    _previewRight,
    removePreview,
    addPreview,
    _updatePreview,
  ] = useAnimationStore(
    useShallow((state) => [
      state.previews.find((p) => p.semanticTime === SemanticTime.BoundsStart),
      state.previews.find((p) => p.semanticTime === SemanticTime.BoundsEnd),
      state.removePreview,
      state.addPreview,
      state.updatePreview,
    ]),
  );

  const initialViewport = useRef<[number, number]>(viewport);
  const updateViewport = useAnimationStore(
    useShallow((state) => state.updatePlayerViewport),
  );
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);

  const gestureBindingsMain = useGesture(
    {
      onDragStart: () => {
        setDragging(true);
        initialViewport.current = viewport;
      },
      onDragEnd: (state) => {
        setDragging(false);
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
      axis: "x",
      drag: {
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
        setDragging(true);
        initialViewport.current = viewport;
      },
      onDragEnd: (state) => {
        setDragging(false);
        state.event.stopPropagation();
      },
      onHover: ({ hovering: h }) => setHovering(h || false),
      onDrag: (state) => {
        const newPosition = zoomScale.invert(
          clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
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
      axis: "x",
      drag: {
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
        setDragging(true);
        initialViewport.current = viewport;
      },
      onDragEnd: (state) => {
        setDragging(false);
        state.event.stopPropagation();
      },
      onHover: ({ hovering: h }) => setHovering(h || false),
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
      axis: "x",
      drag: {
        filterTaps: true,
        pointer: {
          capture: false,
        },
      },
    },
  );
  const scaledViewport = viewport.map(xScale) as [number, number];
  // const zoomBounds = bounds.map(zoomScale) as [number, number];

  return (
    <g className="group/zoom">
      <path
        {...gestureBindingsMain()}
        className="fill-neutral-500/50 cursor-pointer"
        d={`M${scaledViewport[0].toString()} 3.8 ${scaledViewport[1].toString()} 3.8 L${(scaledViewport[1] + 7).toString()} 8.4 L${(scaledViewport[1] + 7).toString()} 21.6 L${scaledViewport[1].toString()} 26.2 ${scaledViewport[0].toString()} 26.2 L${(scaledViewport[0] - 7).toString()} 21.6 L${(scaledViewport[0] - 7).toString()} 8.4 Z`}
      />
      <path
        {...gestureBindingsLeft()}
        className="fill-transparent cursor-ew-resize group-hover/zoom:fill-neutral-500"
        d={`M${scaledViewport[0].toString()} 3.8 L${scaledViewport[0].toString()} 26.2 L${(scaledViewport[0] - 7).toString()} 21.6 L${(scaledViewport[0] - 7).toString()} 8.4 Z`}
      />
      <path
        {...gestureBindingsRight()}
        className="fill-transparent cursor-ew-resize group-hover/zoom:fill-neutral-500"
        d={`M${scaledViewport[1].toString()} 3.8 L${scaledViewport[1].toString()} 26.2 L${(scaledViewport[1] + 7).toString()} 21.6 L${(scaledViewport[1] + 7).toString()} 8.4 Z`}
      />
    </g>
  );
}

function getFill(side: "left" | "right", atBounds: boolean): string {
  return clsx(
    !atBounds &&
      side === "left" &&
      clsx(
        "group-aria-expanded:fill-success-500 group-hover:fill-success-500",
        "group-aria-expanded:group-hover/bound:dark:fill-success-400 group-hover:group-hover/bound:dark:fill-success-400",
        "group-aria-expanded:group-hover/bound:fill-success-600 group-hover:group-hover/bound:fill-success-600",
      ),
    !atBounds &&
      side === "right" &&
      clsx(
        "group-aria-expanded:fill-error-500 group-hover:fill-error-500",
        "group-aria-expanded:group-hover/bound:dark:fill-error-400 group-hover:group-hover/bound:dark:fill-error-400",
        "group-aria-expanded:group-hover/bound:fill-error-600 group-hover:group-hover/bound:fill-error-600",
      ),
    side === "left"
      ? "group-hover/bound:dark:fill-success-400 group-hover/bound:fill-success-600"
      : "group-hover/bound:dark:fill-error-400 group-hover/bound:fill-error-600",

    atBounds ? "dark:fill-white/50 fill-black/50" : "fill-transparent",
  );
}

function getStroke(side: "left" | "right"): string {
  return clsx(
    side === "left"
      ? "group-hover/bound:dark:stroke-success-400 group-hover/bound:stroke-success-600"
      : "group-hover/bound:dark:stroke-error-400 group-hover/bound:stroke-error-600",
    "stroke-transparent",
  );
}

function getPath(
  xScale: ScaleLinear,
  bounds: [number, number],
  side: "left" | "right",
  isTop: boolean,
  isBottom: boolean,
): string {
  const width = 6;
  const height = 3.5;
  const x = side === "left" ? xScale(bounds[0]) : xScale(bounds[1]);
  const trailing = side === "left" ? x + width : x - width;
  if (isTop && isBottom) {
    return `M${x.toString()} 0 L${trailing.toString()} 0 L${x.toString()} ${(0 + height).toString()} L${x.toString()} ${(30 - height).toString()} L${trailing.toString()} 30 L${x.toString()} 30 Z`;
  } else if (isTop) {
    return `M${x.toString()} 0 L${trailing.toString()} 0 L${x.toString()} ${(0 + height).toString()} L${x.toString()} ${(30 - height).toString()} L${x.toString()} 30 Z`;
  } else if (isBottom) {
    return `M${x.toString()} 0 L${x.toString()} ${(0 + height).toString()} L${x.toString()} ${(30 - height).toString()} L${trailing.toString()} 30 L${x.toString()} 30 Z`;
  } else {
    return `M${x.toString()} 0 L${x.toString()} 30 Z`;
  }
}

export const ZoomDisplay = memo(InnerZoomDisplay);
