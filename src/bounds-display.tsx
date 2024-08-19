import { useRef, useState, memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { useGesture } from "@use-gesture/react";
import { closestFrame } from "@semio/utils";
import { clamp } from "lodash";
import { animated } from "@react-spring/web";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackBounds } from "./hooks/use-track-bounds";
import type { ScaleLinear } from "./scale-linear";
import { SemanticTime } from "./store-types";
import { TIMELINE_PADDING } from "./constants";
import { useWithZoom } from "./hooks/use-with-zoom";
import { useBoundSprings } from "./hooks/use-bound-springs";

export interface BoundsDisplayProps {
  isTop?: boolean;
  isBottom?: boolean;
  ignoreZoom?: boolean;
}

function InnerBoundsDisplay({
  isTop = true,
  isBottom = true,
  ignoreZoom = false,
}: BoundsDisplayProps) {
  const {
    frameCount,
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackBounds();
  const bounds = useAnimationStore(useShallow((state) => state.player.bounds));
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

  const initialBounds = useRef<[number, number]>(bounds);
  const updateBounds = useAnimationStore(
    useShallow((state) => state.updatePlayerBounds),
  );
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const withZoom = useWithZoom(ignoreZoom);

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
        withZoom((zoomScale) => {
          const newPosition = zoomScale.invert(
            clamp(
              ((state.xy[0] || 0) - timelineLeft) /
                (timelineWidth - TIMELINE_PADDING),
              0,
              1,
            ),
          );
          const newValue = state.altKey
            ? newPosition
            : closestFrame(newPosition, frameCount);
          const vals =
            newValue >= initialBounds.current[1]
              ? [initialBounds.current[1], newValue]
              : [newValue, initialBounds.current[1]];
          updateBounds(vals[0], vals[1]);
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
        withZoom((zoomScale) => {
          const newPosition = zoomScale.invert(
            clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
          );
          const newValue = state.shiftKey
            ? newPosition
            : closestFrame(newPosition, frameCount);
          const vals =
            newValue <= initialBounds.current[0]
              ? [newValue, initialBounds.current[0]]
              : [initialBounds.current[0], newValue];
          updateBounds(vals[0], vals[1]);
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

  // const zoomBounds = bounds.map(zoomScale) as [number, number];
  const { leftSpring, rightSpring, widthSpring } = useBoundSprings(ignoreZoom);

  return (
    <>
      <animated.rect
        x={leftSpring.to((ls) => xScale(ls))}
        y={0}
        width={widthSpring.to((ws) => xScale(ws))}
        height={30}
        className={
          dragging
            ? clsx(
                "fill-transparent",
                "group-hover:cursor-ew-resize group-hover:fill-neutral-600/25",
                "group-aria-expanded:cursor-ew-resize group-aria-expanded:fill-neutral-600/25",
              )
            : "fill-transparent"
        }
      />
      <g
        className="group/bound"
        onMouseEnter={() => {
          if (!previewLeft) {
            addPreview({
              semanticTime: SemanticTime.BoundsStart,
              stamp: bounds[0],
              label: "Bounds Start",
            });
          }
        }}
        onMouseLeave={() => {
          if (previewLeft) {
            removePreview((p) => p.semanticTime === SemanticTime.BoundsStart);
          }
        }}
      >
        <animated.path
          d={leftSpring.to((ls) =>
            getPath(xScale, ls, "left", isTop, isBottom),
          )}
          className={clsx(
            "transition-[fill]",
            getFill("left", bounds[0] === 0),
          )}
        />
        <animated.path
          d={leftSpring.to(
            (ls) => `M${xScale(ls).toString()} 0 L${xScale(ls).toString()} 30Z`,
          )}
          className={clsx("transition-stroke duration-75", getStroke("left"))}
        />
        <animated.rect
          {...gestureBindingsLeft()}
          x={leftSpring.to((ls) => xScale(ls) - (hovering ? 10 : 7))}
          y={0}
          width={hovering ? 20 : 14}
          height={30}
          className="cursor-ew-resize touch-none fill-transparent"
        />
      </g>

      <g
        className="group/bound"
        onMouseEnter={() => {
          if (!previewLeft) {
            addPreview({
              semanticTime: SemanticTime.BoundsEnd,
              stamp: bounds[1],
              label: "Bounds End",
            });
          }
        }}
        onMouseLeave={() => {
          if (previewLeft) {
            removePreview((p) => p.semanticTime === SemanticTime.BoundsEnd);
          }
        }}
      >
        <animated.path
          d={rightSpring.to((rs) =>
            getPath(xScale, rs, "right", isTop, isBottom),
          )}
          className={clsx(
            "transition-[fill]",
            getFill("right", bounds[1] === 1),
          )}
        />
        <animated.path
          d={rightSpring.to(
            (rs) => `M${xScale(rs).toString()} 0 L${xScale(rs).toString()} 30Z`,
          )}
          className={clsx("transition-stroke duration-75", getStroke("right"))}
        />
        <animated.rect
          {...gestureBindingsRight()}
          x={rightSpring.to((rs) => xScale(rs) - (hovering ? 10 : 14))}
          y={0}
          width={hovering ? 20 : 14}
          height={30}
          className="cursor-ew-resize touch-none fill-transparent"
        />
      </g>
    </>
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
  bound: number,
  side: "left" | "right",
  isTop: boolean,
  isBottom: boolean,
): string {
  const width = 6;
  const height = 3.5;
  const x = xScale(bound);
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

export const BoundsDisplay = memo(InnerBoundsDisplay);
