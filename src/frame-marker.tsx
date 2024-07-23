import { type ReactNode, useMemo, useState, memo } from "react";
import { clsx } from "clsx";
import {
  getHexagonPath,
  getDegenerateHexagonPath,
  closestFrame,
} from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useGesture } from "@use-gesture/react";
import { useSpring, animated } from "@react-spring/web";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { computeLocalStamp } from "./actions/compute-instance-time";
import { InstanceInfo } from "./types";

export interface FrameMarkerProps {
  parentActive: boolean;
  stamp: number;
  animation: string;
  frame: string;
  instanceInfo: InstanceInfo;
  active?: boolean;
}
function InnerFrameMarker({
  parentActive,
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
    () => getHexagonPath(0, 11, 13.5, 13.5),
    [],
  );

  const inactivePath: string = useMemo<string>(
    () => getDegenerateHexagonPath(0, 11, 10, 10),
    [],
  );

  const unhoveredPath: string = useMemo<string>(
    () => getDegenerateHexagonPath(0, 11, 10, 22),
    [],
  );

  const updateKeyframeStamp = useAnimationStore(
    useShallow((state) => state.updateKeyframeStamp),
  );

  const [hovered, setHovered] = useState(false);

  const gestureHandlers = useGesture({
    onHover: ({ hovering }) => {
      setHovered(hovering || false);
    },
    onDrag: (state) => {
      if (!active) {
        return;
      }
      const newPosition = ((state.xy[0] || 0) - timelineLeft) / timelineWidth;
      const newStamp = state.shiftKey
        ? newPosition
        : closestFrame(newPosition, frameCount);
      const transformedStamp = computeLocalStamp(newStamp, instanceInfo);
      updateKeyframeStamp(frame, transformedStamp, animation);
      state.event.stopPropagation();
    },
  });

  const styles = useSpring({
    d: getPath(
      active === true && (hovered || isSelected),
      parentActive,
      inactivePath,
      unhoveredPath,
      hoveredPath,
    ),
    config: {
      duration: 50,
    },
  });

  return (
    <animated.path
      {...gestureHandlers()}
      role="button"
      // onClick={() => {
      //   resetPlayer(stamp);
      // }}
      style={{
        transform: `translateX(${xScale(stamp).toString()}px`,
      }}
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
    />
  );
}

function getPath(
  hovered: boolean,
  active: boolean,
  degeneratePath: string,
  activePath: string,
  fullPath: string,
): string {
  if (hovered) {
    return fullPath;
  } else if (active) {
    return activePath;
  } else {
    return degeneratePath;
  }
}

export const FrameMarker = memo(InnerFrameMarker);
