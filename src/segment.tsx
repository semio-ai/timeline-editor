import type { ReactNode } from "react";
import { memo } from "react";
import { clsx } from "clsx";
import { animated } from "@react-spring/web";
// import { closestFrame } from "@semio/utils";
// import useMeasure from "react-use-measure";
import type { ScaleLinear } from "./scale-linear";
// import { darken, rgba, toRgba } from "@mantine/core";

export interface SegmentProps {
  start: number;
  end: number;
  xScale: ScaleLinear;
  parentActive?: boolean;
  inHoveredSpan?: boolean;
  inActiveSpan?: boolean;
}

function Segment({
  start,
  end,
  xScale,
  parentActive = false,
}: SegmentProps): ReactNode {
  // const bounds = useAnimationStore(useShallow((state) => state.player.bounds));
  // const inBounds = start >= bounds[0] && end <= bounds[1];
  // const timeDistance: number = useAnimationStore(
  //   useShallow((state) =>
  //     Math.min(
  //       Math.abs(state.player.stamp - start),
  //       Math.abs(state.player.stamp - end),
  //     ),
  //   ),
  // );

  return (
    <animated.path
      className={clsx(
        "touch-none transition-all duration-75 hover:stroke-[22px]",
        "hover:stroke-neutral-500 dark:stroke-neutral-600 stroke-neutral-400",
        // inBounds
        //   ? "hover:stroke-neutral-500 stroke-neutral-600"
        //   : "stroke-neutral-700",
        parentActive ? "stroke-[22px]" : "stroke-[5px]",
      )}
      d={`M${(xScale(start) + 0.5).toString()},11 L${(xScale(end) - 0.5).toString()},11`}
    />
  );
}

export default memo(Segment);
