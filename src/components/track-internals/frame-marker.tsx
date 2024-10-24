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
import {
  useWithZoom,
  useZoomGestures,
  useAnimationStore,
  useTrackContext,
  useStaticZoomedSpring,
} from "../../hooks";
import { computeLocalStamp } from "../../functions";
import { DRAG_X_CONFIG } from "../../gesture-config";
import { InstancedFrameInfo } from "../../types";

export interface FrameMarkerProps {
  data: InstancedFrameInfo;
  showAsDot?: boolean;
  ignoreZoom?: boolean;
}
function InnerFrameMarker({ data, ignoreZoom = false }: FrameMarkerProps): ReactNode {
  const gestureRef = useRef<SVGGElement>();
  const {
    animationId,
    frameCount,
    trackIds,
    instanceInfo,
    xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackContext();

  const isSelected = useAnimationStore(
    useShallow((state) => trackIds.length > 0 && state.player.stamp === data.stamp),
  );

  const hoveredPath: string = useMemo<string>(() => getHexagonPath(0, 15, 12, 30), []);

  const withZoom = useWithZoom(ignoreZoom);

  //const updateKeyframeStamp = useAnimationStore(useShallow((state) => state.updateKeyframeStamp));
  const moveKeypoint = useAnimationStore(useShallow((state) => state.moveKeypoint));

  const resetPlayer = useAnimationStore(useShallow((state) => state.resetPlayer));

  const doubleClickHandler = useCallback(
    (event: MouseEvent) => {
      resetPlayer(data.stamp);
      event.stopPropagation();
    },
    [data.stamp, resetPlayer],
  );

  useZoomGestures(
    gestureRef as MutableRefObject<SVGGElement>,
    {
      onDrag: (state) => {
        withZoom((zoomScale) => {
          const newPosition = zoomScale.invert(
            clamp(((state.xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
          );
          const newStamp = state.shiftKey ? newPosition : closestFrame(newPosition, frameCount);
          const transformedStamp = computeLocalStamp(newStamp, instanceInfo);
          data.points.forEach((point) => {
            moveKeypoint(point.id, transformedStamp, point.trackId, animationId);
          });
          state.event.stopPropagation();
        });
      },
    },
    DRAG_X_CONFIG,
  );

  const zoomedStamp = useStaticZoomedSpring(data.stamp, ignoreZoom);

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
          "group-hover:scale-x-100 group-aria-expanded:scale-x-100",
          "scale-x-[15%]",
          "group-hover/frame:dark:stroke-default-300 group-hover/frame:stroke-default-700",
          "group-aria-selected/frame:dark:stroke-default-300",
          "group-aria-selected/frame:stroke-default-700",
          "fill-[--track-color]",
        )}
      />
    </animated.g>
  );
}

export const FrameMarker = memo(InnerFrameMarker);
