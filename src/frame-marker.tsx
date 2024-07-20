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

  const hoveredPath: string = useMemo<string>(
    () => getHexagonPath(0, 11, 10, 22),
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
      active === true && hovered,
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
        "touch-none hover:fill-primary-500 fill-default-500 transition-colors duration-75 stroke-2 dark:stroke-default-400 stroke-default-600",
        parentActive ? "fill-primary-500" : "fill-transparent",
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
