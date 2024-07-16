import { type ReactNode, memo } from "react";
import { clsx } from "clsx";
import { SpringValue, animated } from "@react-spring/web";
import type { ScaleLinear } from "./scale-linear";

export interface HoverMarkerProps {
  xScale: ScaleLinear;
  hoverX: SpringValue<number>;
  parentActive: boolean;
}

function HoverMarker({
  xScale,
  hoverX,
  parentActive,
}: HoverMarkerProps): ReactNode {
  return (
    <animated.path
      style={{
        transform: hoverX.to(
          (hoverXval) => `translateX(${xScale(hoverXval).toString()}px`,
        ),
      }}
      className={clsx(
        "touch-none stroke-2",
        parentActive ? "stroke-white" : "stroke-transparent",
      )}
      rx={1}
      // vertical line
      d="M 0 0 L 0 22"
    />
  );
}

export default memo(HoverMarker);
