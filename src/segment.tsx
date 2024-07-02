import type { ReactNode } from "react";
import { useState, memo } from "react";
import { useGesture } from "@use-gesture/react";
import { animated, useSpring } from "@react-spring/web";
import { useStudioStore, type StudioStore } from "@semio/core";
// import { closestFrame } from "@semio/utils";
// import useMeasure from "react-use-measure";
import { useShallow } from "zustand/react/shallow";
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
  inHoveredSpan = false,
  inActiveSpan = false,
}: SegmentProps): ReactNode {
  const timeDistance: number = useStudioStore(
    useShallow((state: StudioStore) =>
      Math.min(
        Math.abs(state.timer.stamp - start),
        Math.abs(state.timer.stamp - end),
      ),
    ),
  );
  const [hovered, setHovered] = useState(false);

  const gestureBindings = useGesture({
    onHover: (state) => {
      setHovered(state.hovering || false);
    },
  });

  const styles = useSpring({
    stroke: getStrokeColor(hovered, timeDistance, inHoveredSpan, inActiveSpan),
    strokeOpacity: getStrokeOpacity(hovered, timeDistance),
    strokeWidth: hovered || parentActive ? 22 : 5,
    config: {
      duration: 50,
    },
  });

  // console.log("rerendering segment");

  return (
    <animated.path
      style={{ ...styles, touchAction: "none" }}
      {...gestureBindings()}
      d={`M${(xScale(start) + 0.5).toString()},11 L${(xScale(end) - 0.5).toString()},11`}
    />
  );
}

function getStrokeColor(
  hovered: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- in development
  timeDistance: number,
  inHoveredSpan: boolean,
  inActiveSpan: boolean,
): string {
  let num = 0;
  if (hovered) {
    num = 5;
  } else {
    num = 6;
  }

  return `var(--mantine-color-gray-${num.toString()})`;
  // const val = (num + timeDistance * 0.2) * 255;
  // return `rgb(${val},${val},${val})`;
  // return darken(`var(--mantine-color-gray-${num})`, timeDistance);
  // if (inHoveredSpan) {
  //   num -= 1;
  // }
  // if (inActiveSpan) {
  //   num -= 1;
  // }

  // return `var(--mantine-color-gray-${num})`;
}

function getStrokeOpacity(hovered: boolean, timeDistance: number): number {
  if (timeDistance < 0.5) {
    return 1;
  } else if (hovered) {
    return 1;
  } else {
    return 1;
  }
}

export default memo(Segment);
