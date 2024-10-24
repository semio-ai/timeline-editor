import { MutableRefObject, useRef, useCallback, MouseEventHandler, memo } from "react";
import { clamp } from "lodash";
import { clsx } from "clsx";
import { closestFrame } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import {
  useZoomGestures,
  useTrackContext,
  useHoverSpring,
  useWithZoom,
  useAnimationStore,
} from "../../hooks";
import { AnimationActions, AnimationData } from "../../store-types";

function InnerGestureDetector({
  ignoreZoom,
  height = 30,
}: {
  ignoreZoom?: boolean;
  height?: number;
}) {
  const gestureRef = useRef<SVGRectElement>();
  const { xScale, bounds, animationId } = useTrackContext();

  const withZoom = useWithZoom(ignoreZoom);

  const { setHoverpoint, clearHoverpoint } = useHoverSpring(ignoreZoom);

  const { resetPlayer } = useAnimationStore(
    useShallow((state: AnimationActions) => ({
      resetPlayer: state.resetPlayer,
    })),
  );

  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );
  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[animationId]?.duration ?? 5000),
  );

  const frameCount = Math.floor(framerate * (duration / 1000));

  const doubleClickHandler = useCallback(
    (event: MouseEvent) => {
      withZoom((zoomScale) => {
        const newPosition = clamp(
          zoomScale.invert(((event.clientX ?? 0) - bounds.left) / bounds.width),
          0,
          1,
        );
        if (event.altKey) {
          resetPlayer(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          resetPlayer(closest);
        }
      });
    },
    [bounds, frameCount, resetPlayer, withZoom],
  );

  useZoomGestures(gestureRef as MutableRefObject<EventTarget>, {
    onHover: (state) => {
      if (!state.hovering) {
        clearHoverpoint();
      }
    },
    onMove: (state) => {
      withZoom((zoomScale) => {
        const newPosition = zoomScale.invert(((state.xy[0] || 0) - bounds.left) / bounds.width);
        if (state.altKey) {
          setHoverpoint(newPosition);
        } else {
          const closest: number = closestFrame(newPosition, frameCount);
          setHoverpoint(closest);
        }
      });
    },
  });

  return (
    <rect
      ref={gestureRef as MutableRefObject<SVGRectElement>}
      name="gesture-detector"
      onDoubleClick={doubleClickHandler as any as MouseEventHandler}
      onTouchMove={(e) => {
        console.log("touchmove");
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        console.log("touchstart");
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchEnd={(e) => {
        console.log("touchend");
        e.preventDefault();
        e.stopPropagation();
      }}
      x={xScale(0)}
      height={height}
      width={Math.max(0, bounds.width)}
      className={clsx("pointer-events-auto touch-none")}
    />
  );
}

export const GestureDetector = memo(InnerGestureDetector);
