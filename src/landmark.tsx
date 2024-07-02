import { type ReactNode, useMemo, useState, memo } from "react";
import { getHexagonPath, getDegenerateHexagonPath } from "@semio/utils";
import { useStudioStore } from "@semio/core";
import { useShallow } from "zustand/react/shallow";
import { useGesture } from "@use-gesture/react";
import { useSpring, animated } from "@react-spring/web";
import type { ScaleLinear } from "./scale-linear";

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

  const resetTimer = useStudioStore(
    useShallow(
      (state) => state.resetTimer as (time?: number | undefined) => void,
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
    fillOpacity: getFillOpacity(hovered, parentActive),
    fill: hovered
      ? "var(--mantine-color-semioBlue-2)"
      : "var(--mantine-color-gray-1)",
    config: {
      duration: 100,
    },
  });

  return (
    <animated.path
      {...gestureHandlers()}
      role="button"
      onClick={() => {
        resetTimer(time);
      }}
      stroke="var(--mantine-color-body)"
      fill={styles.fill}
      strokeWidth={2}
      strokeOpacity={1}
      fillOpacity={styles.fillOpacity}
      d={styles.d}
    />
  );
}

function getFillOpacity(hovered: boolean, active: boolean): number {
  if (active) {
    return 1;
  } else if (hovered) {
    return 1;
  } else {
    return 0;
  }
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
