import { type ReactNode, useMemo, memo } from "react";
import { clsx } from "clsx";
import { getHexagonPath, closestFrame } from "@semio/utils";
import { clamp } from "lodash";
import { useShallow } from "zustand/react/shallow";
import { useGesture } from "@use-gesture/react";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { computeLocalStamp } from "./actions/compute-instance-time";
import { InstanceInfo } from "./types";

export interface FrameMarkerProps {
  stamp: number;
  animation: string;
  frame: string;
  instanceInfo: InstanceInfo;
  active?: boolean;
}
function InnerFrameMarker({
  stamp,
  animation,
  frame,
  instanceInfo,
  active,
}: FrameMarkerProps): ReactNode {
  const {
    frameCount,
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackBounds();

  const isSelected = useAnimationStore(
    useShallow((state) => state.selectedKeyframe === frame),
  );

  const hoveredPath: string = useMemo<string>(
    () => getHexagonPath(0, 15, 12, 30),
    [],
  );

  // const inactivePath: string = useMemo<string>(
  //   () => getDegenerateHexagonPath(0, 15, 12, 15),
  //   [],
  // );

  // const unhoveredPath: string = useMemo<string>(
  //   () => getDegenerateHexagonPath(0, 15, 12, 15),
  //   [],
  // );

  const updateKeyframeStamp = useAnimationStore(
    useShallow((state) => state.updateKeyframeStamp),
  );

  // const [hovered, setHovered] = useState(false);

  const gestureHandlers = useGesture({
    // onHover: ({ hovering }) => {
    //   setHovered(hovering || false);
    // },
    onDrag: (state) => {
      if (!active) {
        return;
      }
      const newPosition = clamp(
        ((state.xy[0] || 0) - timelineLeft) / timelineWidth,
        0,
        1,
      );
      const newStamp = state.shiftKey
        ? newPosition
        : closestFrame(newPosition, frameCount);
      const transformedStamp = computeLocalStamp(newStamp, instanceInfo);
      updateKeyframeStamp(frame, transformedStamp, animation);
      state.event.stopPropagation();
    },
  });

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
    <g
      {...gestureHandlers()}
      className="group/frame touch-none"
      aria-selected={isSelected}
      // onClick={() => {
      //   resetPlayer(stamp);
      // }}
      style={{
        transform: `translateX(${xScale(stamp).toString()}px`,
      }}
    >
      <path
        d="M 0 0 L 0 30"
        className={clsx(
          "transition-[colors,stroke,transform] duration-75 stroke-2 scale-y-[33%] translate-y-[10px]",
          "dark:stroke-default-300 stroke-default-700",
          "group-hover:translate-y-0 group-aria-expanded:translate-y-0 group-hover:scale-y-100 group-aria-expanded:scale-y-100",
          "group-aria-selected/frame:scale-y-100 group-aria-selected/frame:translate-y-0",
          "group-hover/frame:group-aria-selected/frame:stroke-transparent",
          // "group-hover:group-aria-selected/frame:dark:stroke-transparent group-hover:group-aria-selected/frame:stroke-transparent",
        )}
      />
      <path
        d={hoveredPath}
        className={clsx(
          "transition-[colors,stroke,transform] duration-75 stroke-2 stroke-transparent scale-x-0",
          "group-hover/frame:scale-x-100 group-aria-selected/frame:scale-x-100",
          "group-hover/frame:dark:stroke-default-300 group-hover/frame:stroke-default-700",
          "group-aria-selected/frame:dark:stroke-default-300 group-aria-selected/frame:stroke-default-700",
          "dark:fill-primary-100 fill-primary-900",
          "group-aria-selected/frame:dark:fill-info-100 group-aria-selected/frame:fill-info-900",
        )}
      />
      {/* <animated.path
        className={clsx(
          "touch-none transition-[colors,stroke] duration-75 dark:stroke-default-400 stroke-default-600",
          isSelected &&
            "fill-info-500 dark:hover:fill-info-100 hover:fill-info-900",
          hovered &&
            !isSelected &&
            "fill-primary-500 dark:hover:fill-primary-100 hover:fill-primary-900",
          (isSelected || hovered) &&
            "hover:dark:stroke-white hover:stroke-black dark:stroke-neutral-300 stroke-neutral-700 stroke-1",
          !(isSelected || hovered) && "fill-transparent stroke-2",
        )}
        d={styles.d}
      /> */}
    </g>
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

export const FrameMarker = memo(InnerFrameMarker);
