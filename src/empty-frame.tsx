import { type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { SpringValue } from "@react-spring/web";
import { animated, useSpring } from "@react-spring/web";
import type { ScaleLinear } from "./scale-linear";
import { useAnimationStore } from "./hooks/use-animation-store";

export interface EmptyFrameProps {
  x: number;
  hoverX: SpringValue<number>;
  xScale: ScaleLinear;
  parentActive: boolean;
  major: boolean;
}

export function EmptyFrame({
  x,
  hoverX,
  xScale,
  parentActive,
  major,
}: EmptyFrameProps): ReactNode {
  const resetPlayer = useAnimationStore(
    useShallow(
      (state) => state.resetPlayer as (time?: number | undefined) => void,
    ),
  );

  const styles = useSpring({
    d: parentActive
      ? `M${xScale(x).toString()},0 L${xScale(x).toString()},22`
      : `M${xScale(x).toString()},8.5 L${xScale(x).toString()},13.5`,
  });

  return (
    <animated.path
      onClick={() => {
        resetPlayer(x);
      }}
      d={styles.d}
      opacity={hoverX.to((hoverXval) =>
        getOpacity(hoverXval, x, parentActive, major),
      )}
      stroke={hoverX.to((hoverXval) =>
        hoverXval === x
          ? "var(--mantine-color-gray-1)"
          : "var(--mantine-color-gray-9)",
      )}
      strokeWidth={hoverX.to((hoverXval) => (hoverXval === x ? 2 : 1))}
    />
  );
}

function getOpacity(
  hoverX: number,
  x: number,
  parentActive: boolean,
  major: boolean,
): number {
  if (hoverX === x) {
    return 0.9;
  }
  const distance =
    parentActive && major
      ? 0.7
      : Math.pow(Math.E, 1 / (10 * Math.abs(hoverX - x) + 2)) - 1.3;
  return distance;
}
