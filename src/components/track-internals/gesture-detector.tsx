import { MutableRefObject, useRef, useCallback, MouseEventHandler, memo } from "react";
import { clamp } from "lodash";
import { clsx } from "clsx";
import { closestFrame } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useZoomGestures, useTrackContext, useAnimationStore } from "../../hooks";
import { AnimationActions, AnimationData } from "../../store-types";

function InnerGestureDetector({ height = 30 }: { ignoreZoom?: boolean; height?: number }) {
  const gestureRef = useRef<SVGRectElement>();
  const { xScale, zoomScale, bounds, animationId } = useTrackContext();

  const updateHoverpointPreview = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateHoverpointPreview),
  );

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
      const newPosition = clamp(
        zoomScale.current.invert(((event.clientX ?? 0) - bounds.left) / bounds.width),
        0,
        1,
      );
      if (event.altKey) {
        resetPlayer(newPosition);
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        resetPlayer(closest);
      }
    },
    [bounds, frameCount, resetPlayer, zoomScale],
  );

  useZoomGestures(gestureRef as MutableRefObject<EventTarget>, {
    onHover: (state) => {
      if (!state.hovering) {
        updateHoverpointPreview(null);
      }
    },
    onMove: (state) => {
      const newPosition = zoomScale.current.invert(
        ((state.xy[0] || 0) - bounds.left) / bounds.width,
      );
      if (state.altKey) {
        updateHoverpointPreview(newPosition);
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        updateHoverpointPreview(closest);
      }
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
