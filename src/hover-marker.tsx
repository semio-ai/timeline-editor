import { type ReactNode, memo } from "react";
import { clsx } from "clsx";
import { SpringValue, animated } from "@react-spring/web";
import { useTrackBounds } from "./hooks/use-track-bounds";

export interface HoverMarkerProps {
  hoverX: SpringValue<number>;
  parentActive: boolean;
}

function HoverMarker({ hoverX, parentActive }: HoverMarkerProps): ReactNode {
  const { scale: xScale } = useTrackBounds();
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
