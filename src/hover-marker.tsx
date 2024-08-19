import { type ReactNode, memo } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { animated } from "@react-spring/web";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useHoverSpring } from "./hooks/use-hover-spring";

export interface HoverMarkerProps {
  ignoreZoom?: boolean;
}

function HoverMarker({ ignoreZoom = false }: HoverMarkerProps): ReactNode {
  const { scale: xScale } = useTrackBounds();
  const { hoverpoint } = useHoverSpring(ignoreZoom);
  const selection = useAnimationStore(
    useShallow(
      (state) =>
        state.selectedKeyframe !== undefined &&
        state.animations[state.activeAnimation]?.frames?.get(
          state.selectedKeyframe,
        )?.stamp === hoverpoint.get(),
    ),
  );

  return (
    <animated.path
      aria-selected={selection}
      style={{
        strokeWidth: hoverpoint.to((hoverXval) =>
          hoverXval === undefined ? 0 : 2,
        ),
        transform: hoverpoint.to(
          (hoverXval) => `translateX(${xScale(hoverXval ?? 0).toString()}px)`,
        ),
      }}
      className={clsx(
        "touch-none stroke-transparent",
        "group-hover:stroke-black group-hover:dark:stroke-white group-aria-expanded:stroke-black group-aria-expanded:dark:stroke-white",
        "aria-selected:stroke-transparent",
      )}
      rx={1}
      // vertical line
      d="M 0 0 L 0 30"
    />
  );
}

export default memo(HoverMarker);
