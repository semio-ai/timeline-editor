import type { ReactNode } from "react";
import { memo } from "react";
import { clsx } from "clsx";
import { animated } from "@react-spring/web";
import { useTrackBounds } from "./hooks/use-track-bounds";

export interface SegmentProps {
  start: number;
  end: number;
  parentActive?: boolean;
}

function Segment({
  start,
  end,
  // xScale,
  parentActive = false,
}: SegmentProps): ReactNode {
  const { scale: xScale } = useTrackBounds();

  return (
    <animated.path
      className={clsx(
        "touch-none transition-all duration-75 hover:stroke-[22px]",
        "hover:stroke-neutral-500 dark:stroke-neutral-600 stroke-neutral-400",
        parentActive ? "stroke-[22px]" : "stroke-[5px]",
      )}
      d={`M${(xScale(start) + 0.5).toString()},11 L${(xScale(end) - 0.5).toString()},11`}
    />
  );
}

export default memo(Segment);
