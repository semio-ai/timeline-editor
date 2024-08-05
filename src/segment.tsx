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
        "touch-none group-hover:stroke-[30px] group-aria-expanded:stroke-[30px] stroke-[7.5px]",
        "hover:stroke-neutral-500 dark:stroke-neutral-600 stroke-neutral-400",
        "transition-all duration-75",
        // parentActive ? "stroke-[30px]" : "stroke-[5px]",
      )}
      d={`M${(xScale(start) + 0.5).toString()},15 L${(xScale(end) - 0.5).toString()},15`}
    />
  );
}

export default memo(Segment);
