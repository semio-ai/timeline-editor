import type { ReactNode } from "react";
import { memo } from "react";
import { clsx } from "clsx";
import { animated } from "@react-spring/web";
import { useTrackBounds } from "./hooks/use-track-bounds";

export interface SegmentProps {
  start: number;
  end: number;
}

function Segment({ start, end }: SegmentProps): ReactNode {
  const { scale: xScale } = useTrackBounds();

  return (
    <animated.path
      className={clsx(
        "touch-none group-hover:stroke-[30px] group-aria-expanded:stroke-[30px] stroke-[7.5px]",
        "dark:group-hover:stroke-neutral-800 dark:group-aria-expanded:stroke-neutral-800",
        "group-hover:stroke-neutral-200 group-aria-expanded:stroke-neutral-200",
        "hover:stroke-neutral-500 dark:stroke-transparent",
        "transition-all duration-75 ease-in-out pointer-events-none",
      )}
      d={`M${(xScale(start) + 0.5).toString()},15 L${(xScale(end) - 0.5).toString()},15`}
    />
  );
}

export default memo(Segment);
