import { type ReactNode, memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { SpringValue, animated } from "@react-spring/web";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useAnimationStore } from "./hooks/use-animation-store";

export interface HoverMarkerProps {
  hoverX: SpringValue<number>;
  parentActive: boolean;
}

function HoverMarker({ hoverX, parentActive }: HoverMarkerProps): ReactNode {
  const { scale: xScale } = useTrackBounds();
  const selection = useAnimationStore(
    useShallow((state) => state.selectedKeyframe),
  );
  return (
    <animated.path
      style={{
        transform: hoverX.to(
          (hoverXval) => `translateX(${xScale(hoverXval).toString()}px`,
        ),
      }}
      className={clsx(
        "touch-none stroke-2",
        selection && "stroke-transparent",
        !selection && parentActive
          ? "dark:stroke-white stroke-black"
          : "stroke-transparent",
      )}
      rx={1}
      // vertical line
      d="M 0 0 L 0 22"
    />
  );
}

export default memo(HoverMarker);
