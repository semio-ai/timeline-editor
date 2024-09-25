import { type ReactNode, memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { animated } from "@react-spring/web";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useHoverSpring } from "./hooks/use-hover-spring";
import { useAnimationStore } from "./hooks/use-animation-store";

export interface HoverMarkerProps {
  ignoreZoom?: boolean;
  height?: number;
}

function InnerHoverMarker({
  ignoreZoom = false,
  height = 30,
}: HoverMarkerProps): ReactNode {
  const { scale: xScale } = useTrackBounds();
  const { hoverpoint } = useHoverSpring(ignoreZoom);
  const dashed = useAnimationStore(
    useShallow((state) => state.preferences.hoverDashedLine),
  );

  return (
    <animated.path
      style={{
        strokeDasharray: dashed ? "5 5" : "none",
        strokeDashoffset: dashed ? "2.5" : "none",
        strokeWidth: hoverpoint.to((hoverXval) =>
          hoverXval === undefined ? 0 : 1,
        ),
        transform: hoverpoint.to(
          (hoverXval) => `translateX(${xScale(hoverXval ?? 0).toString()}px)`,
        ),
      }}
      className={clsx(
        "touch-none stroke-transparent pointer-events-none",
        "group-hover:stroke-black/50 group-hover:dark:stroke-white/50 group-aria-expanded:stroke-black/50 group-aria-expanded:dark:stroke-white/50",
        "aria-selected:stroke-transparent",
      )}
      rx={1}
      // vertical line
      d={`M 0 0 L 0 ${height.toString()}`}
    />
  );
}

export const HoverMarker = memo(InnerHoverMarker);
