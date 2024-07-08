import { type ReactNode, useMemo, useState, memo } from "react";
import { clsx } from "clsx";
import { getHexagonPath, getDegenerateHexagonPath } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useGesture } from "@use-gesture/react";
import { useSpring, animated } from "@react-spring/web";
import type { ScaleLinear } from "./scale-linear";
import { useAnimationStore } from "./hooks/use-animation-store";

export interface LandmarkProps {
  time: number;
  xScale: ScaleLinear;
  parentActive?: boolean;
}
function Landmark({
  time,
  xScale,
  parentActive = false,
}: LandmarkProps): ReactNode {
  const hoveredPath: string = useMemo<string>(
    () => getHexagonPath(xScale(time), 11, 10, 22),
    [xScale, time],
  );

  const inactivePath: string = useMemo<string>(
    () => getDegenerateHexagonPath(xScale(time), 11, 10, 10),
    [xScale, time],
  );

  const unhoveredPath: string = useMemo<string>(
    () => getDegenerateHexagonPath(xScale(time), 11, 10, 22),
    [xScale, time],
  );

  const resetPlayer = useAnimationStore(
    useShallow(
      (state) => state.resetPlayer as (time?: number | undefined) => void,
    ),
  );

  const [hovered, setHovered] = useState(false);

  const gestureHandlers = useGesture({
    onHover: ({ hovering }) => {
      setHovered(hovering || false);
    },
  });

  const styles = useSpring({
    d: getPath(hovered, parentActive, inactivePath, unhoveredPath, hoveredPath),
    config: {
      duration: 50,
    },
  });

  return (
    <animated.path
      {...gestureHandlers()}
      role="button"
      onClick={() => {
        resetPlayer(time);
      }}
      className={clsx(
        "hover:fill-primary-500 fill-default-500 transition-colors duration-75 stroke-2 dark:stroke-default-400 stroke-default-600",
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

export default memo(Landmark);
