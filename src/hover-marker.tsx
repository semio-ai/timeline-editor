import { type ReactNode, memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { SpringValue, animated } from "@react-spring/web";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useAnimationStore } from "./hooks/use-animation-store";

export interface HoverMarkerProps {
  hoverX: SpringValue<number>;
}

function HoverMarker({ hoverX }: HoverMarkerProps): ReactNode {
  const { scale: xScale } = useTrackBounds();
  const selection = useAnimationStore(
    useShallow(
      (state) =>
        state.selectedKeyframe !== undefined &&
        state.animations[state.activeAnimation]?.frames?.get(
          state.selectedKeyframe,
        )?.stamp === hoverX.get(),
    ),
  );
  return (
    <animated.path
      aria-selected={selection}
      style={{
        transform: hoverX.to(
          (hoverXval) => `translateX(${xScale(hoverXval).toString()}px`,
        ),
      }}
      className={clsx(
        "touch-none stroke-2 stroke-transparent",
        // "group-hover:stroke-black group-hover:dark:stroke-white group-aria-expanded:stroke-black group-aria-expanded:dark:stroke-white",
        "aria-selected:stroke-transparent",
      )}
      rx={1}
      // vertical line
      d="M 0 0 L 0 30"
    />
  );
}

export default memo(HoverMarker);
