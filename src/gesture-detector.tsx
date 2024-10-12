import { MutableRefObject, useRef, useCallback, MouseEventHandler } from "react";
import { clamp } from "lodash";
import { clsx } from "clsx";
import { closestFrame } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useZoomGestures } from "./hooks/use-zoom-gestures";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useHoverSpring } from "./hooks/use-hover-spring";
import { useWithZoom } from "./hooks/use-with-zoom";
import { useAnimationStore } from "./hooks/use-animation-store";
import { AnimationActions, AnimationData } from "./store-types";

export function GestureDetector({
  ignoreZoom,
  height = 30,
}: {
  ignoreZoom?: boolean;
  height?: number;
}) {
  const gestureRef = useRef<SVGRectElement>();
  const { scale, bounds } = useTrackBounds();

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
    useShallow((state: AnimationData) => state.animations[state.activeAnimation]?.duration ?? 5000),
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
      x={scale(0)}
      height={height}
      width={Math.max(0, bounds.width)}
      className={clsx("pointer-events-auto touch-none")}
    />
  );
}
