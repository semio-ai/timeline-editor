import { type ReactNode, memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { animated } from "@react-spring/web";
import { useTrackContext, useHoverSpring, useAnimationStore } from "../../hooks";

export interface HoverMarkerProps {
  ignoreZoom?: boolean;
  height?: number;
  offset?: number;
}

function InnerHoverMarker({
  ignoreZoom = false,
  height = 30,
  offset = 0,
}: HoverMarkerProps): ReactNode {
  const { xScale } = useTrackContext();
  const hoverpoint = useHoverSpring(ignoreZoom);
  const dashed = useAnimationStore(useShallow((state) => state.preferences.hoverDashedLine));

  return (
    <animated.path
      style={{
        strokeDasharray: dashed ? "5 5" : "none",
        strokeDashoffset: dashed ? "2.5" : "none",
        strokeWidth: hoverpoint.to((hoverXval) => (hoverXval === undefined ? 0 : 1)),
        transform: hoverpoint.to(
          (hoverXval) => `translateX(${xScale(hoverXval ?? 0).toString()}px)`,
        ),
      }}
      className={clsx(
        "touch-none stroke-transparent pointer-events-none",
        "group-hover:stroke-black/50 group-hover:dark:stroke-white/50",
        "aria-selected:stroke-transparent",
      )}
      rx={1}
      // vertical line
      d={`M 0 ${offset.toString()} L 0 ${height.toString()}`}
    />
  );
}

export const HoverMarker = memo(InnerHoverMarker);
