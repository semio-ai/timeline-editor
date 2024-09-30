import { type ReactNode, memo } from "react";
import { clsx } from "clsx";
import { animated } from "@react-spring/web";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { usePairSprings } from "./hooks/use-pair-springs";
import { TIMELINE_PADDING } from "./constants";

export interface InterpolationSegmentProps {
  stamp1: number;
  stamp2: number;
  ignoreZoom?: boolean;
  useCustomColor?: boolean;
}
function InnerInterpolationSegment({
  stamp1,
  stamp2,
  ignoreZoom = false,
  useCustomColor = false,
}: InterpolationSegmentProps): ReactNode {
  const { scale: xScale } = useTrackBounds();

  const { left, width } = usePairSprings(stamp1, stamp2, ignoreZoom);

  return (
    <animated.rect
      y={13}
      x={left.to((ls) => xScale(ls) + 6)}
      width={width.to((ws) => Math.max(0, xScale(ws) - TIMELINE_PADDING - 12))}
      height={4}
      className={clsx(
        "transition-[colors,stroke,transform] duration-75 fill-transparent pointer-events-none",
        useCustomColor
          ? "group-aria-expanded:fill-[--track-color] group-hover:fill-[--track-color]"
          : "group-aria-expanded:dark:fill-default-400 group-aria-expanded:fill-default-600 group-hover:fill-default-600 group-hover:dark:fill-default-400",
      )}
    />
  );
}

export const InterpolationSegment = memo(InnerInterpolationSegment);
