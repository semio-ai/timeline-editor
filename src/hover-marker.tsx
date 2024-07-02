import { type ReactNode, useEffect, memo } from "react";
import { SpringValue, animated, useSpring } from "@react-spring/web";
import type { ScaleLinear } from "./scale-linear";

export interface HoverMarkerProps {
  xScale: ScaleLinear;
  timelineWidth: number;
  timelineLeft: number;
  hoverX: SpringValue<number>;
  parentActive: boolean;
}

function HoverMarker({
  xScale,
  timelineWidth,
  timelineLeft,
  hoverX,
  parentActive,
}: HoverMarkerProps): ReactNode {
  useEffect(() => {
    console.log("hover marker prop xScale updated");
  }, [xScale]);

  useEffect(() => {
    console.log("hover marker prop timelineLeft updated");
  }, [timelineLeft]);

  useEffect(() => {
    console.log("hover marker prop timelineWidth updated");
  }, [timelineWidth]);

  const styles = useSpring({
    stroke: parentActive ? "white" : "transparent",
    config: { duration: 100 },
  });

  return (
    <animated.path
      style={{
        touchAction: "none",
        transform: hoverX.to(
          (hoverXval) => `translateX(${xScale(hoverXval).toString()}px`,
        ),
      }}
      strokeWidth={2}
      stroke={styles.stroke}
      strokeOpacity={1}
      rx={1}
      // vertical line
      d="M 0 0 L 0 22"
    />
  );
}

export default memo(HoverMarker);
