import { type ReactNode, useMemo, memo } from "react";
import { clsx } from "clsx";
import { getHexagonPath, closestFrame } from "@semio/utils";
import { clamp } from "lodash";
import { animated } from "@react-spring/web";
import { useShallow } from "zustand/react/shallow";
import { useGesture } from "@use-gesture/react";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useStaticZoomedSpring } from "./hooks/use-static-zoomed-spring";
import { computeLocalStamp } from "./actions/compute-instance-time";
import { InstanceInfo } from "./types";
import { useWithZoom } from "./hooks/use-with-zoom";
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
  const {
    // frameCount,
    scale: xScale,
    // bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackBounds();

  // const isSelected = useAnimationStore(
  //   useShallow(
  //     (state) =>
  //       state.selectedKeyframe === frame1 || state.selectedKeyframe === frame2,
  //   ),
  // );

  // const withZoom = useWithZoom(ignoreZoom);

  // const [hovered, setHovered] = useState(false);
  //
  // console.log(stamp1, stamp2);

  const { left, width, right } = usePairSprings(stamp1, stamp2, ignoreZoom);

  // const styles = useSpring({
  //   d: getPath(
  //     active === true && (hovered || isSelected),
  //     parentActive,
  //     inactivePath,
  //     unhoveredPath,
  //     hoveredPath,
  //   ),
  //   config: {
  //     duration: 50,
  //   },
  // });

  return (
    <animated.rect
      // d={right.to(rs=>left.to((ls) => `M${xScale(ls).toString()} 15 L${(xScale(rs)).toString()} 15`))}
      // style={{
      //   transform: left.to(
      //     (ls) => `translateX(${xScale(ls).toString()}px`,
      //   ),
      // }}
      y={13}
      x={left.to((ls) => xScale(ls))}
      width={width.to((ws) => Math.max(0, xScale(ws) - TIMELINE_PADDING))}
      height={4}
      className={clsx(
        "transition-[colors,stroke,transform] duration-75 fill-transparent",
        useCustomColor
          ? "group-aria-expanded:fill-[--track-color] group-hover:fill-[--track-color]"
          : "group-aria-expanded:dark:fill-default-400 group-aria-expanded:fill-default-600 group-hover:fill-default-600 group-hover:dark:fill-default-400",
      )}
    />
  );
}

// function getPath(
//   hovered: boolean,
//   active: boolean,
//   degeneratePath: string,
//   activePath: string,
//   fullPath: string,
// ): string {
//   if (hovered) {
//     return fullPath;
//   } else if (active) {
//     return activePath;
//   } else {
//     return degeneratePath;
//   }
// }

export const InterpolationSegment = memo(InnerInterpolationSegment);
