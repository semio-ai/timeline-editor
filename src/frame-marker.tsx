import {
  type ReactNode,
  type MutableRefObject,
  type MouseEventHandler,
  useMemo,
  memo,
  useRef,
  useCallback,
} from "react";
import { clsx } from "clsx";
import { getHexagonPath, closestFrame } from "@semio/utils";
import { clamp } from "lodash";
import { animated } from "@react-spring/web";
import { useShallow } from "zustand/react/shallow";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackContext } from "./hooks/use-track-context";
import { useStaticZoomedSpring } from "./hooks/use-static-zoomed-spring";
import { computeLocalStamp } from "./functions/compute-instance-time";
import { InstanceInfo } from "./types";
import { useWithZoom } from "./hooks/use-with-zoom";
import { useZoomGestures } from "./hooks/use-zoom-gestures";
import { DRAG_X_CONFIG } from "./gesture-config";

export interface FrameMarkerProps {
  stamp: number;
  animation: string;
  frame: string;
  instanceInfo: InstanceInfo;
  active?: boolean;
  ignoreZoom?: boolean;
}
function InnerFrameMarker({
  stamp,
  animation,
  frame,
  instanceInfo,
  active,
  ignoreZoom = false,
}: FrameMarkerProps): ReactNode {
  const gestureRef = useRef<SVGGElement>();
  const {
    frameCount,
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackContext();

  const isSelected = useAnimationStore(useShallow((state) => state.selectedKeyframe === frame));

  const hoveredPath: string = useMemo<string>(() => getHexagonPath(0, 15, 12, 30), []);

  const withZoom = useWithZoom(ignoreZoom);

  const updateKeyframeStamp = useAnimationStore(useShallow((state) => state.updateKeyframeStamp));

  const resetPlayer = useAnimationStore(useShallow((state) => state.resetPlayer));

  const doubleClickHandler = useCallback(
    (event: MouseEvent) => {
      resetPlayer(stamp);
      event.stopPropagation();
    },
    [stamp, resetPlayer],
  );

  useZoomGestures(
    gestureRef as MutableRefObject<SVGGElement>,
    {
      onDrag: (state) => {
        if (!active) {
          return;
        }
        withZoom((zoomScale) => {
          const newPosition = zoomScale.invert(
            clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
          );
          const newStamp = state.shiftKey ? newPosition : closestFrame(newPosition, frameCount);
          const transformedStamp = computeLocalStamp(newStamp, instanceInfo);
          updateKeyframeStamp(frame, transformedStamp, animation);
          state.event.stopPropagation();
        });
      },
    },
    DRAG_X_CONFIG,
  );

  const zoomedStamp = useStaticZoomedSpring(stamp, ignoreZoom);

  return (
    <animated.g
      ref={gestureRef as MutableRefObject<SVGGElement>}
      onDoubleClick={doubleClickHandler as any as MouseEventHandler}
      className="group/frame touch-none"
      aria-selected={isSelected}
      style={{
        transform: zoomedStamp.to((zs) => `translateX(${xScale(zs).toString()}px`),
      }}
    >
      <path
        d={hoveredPath}
        className={clsx(
          !active && "pointer-events-none",
          "transition-[colors,stroke,transform] duration-75 stroke-2 stroke-transparent scale-x-100",
          active && "group-hover:scale-x-100 group-aria-expanded:scale-x-100",
          "scale-x-[15%]",
          active &&
            "group-hover/frame:dark:stroke-default-300 group-hover/frame:stroke-default-700",
          active &&
            "group-aria-selected/frame:dark:stroke-default-300 group-aria-selected/frame:stroke-default-700",
          "fill-[--track-color]",
        )}
      />
    </animated.g>
  );
}

export const FrameMarker = memo(InnerFrameMarker);
