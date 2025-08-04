import { MutableRefObject, useRef, useCallback, MouseEventHandler, memo } from "react";
import { clamp } from "lodash";
import { clsx } from "clsx";
import { closestFrame, usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useZoomGestures, useTrackContext, useAnimationStore } from "../../hooks";
import { AnimationActions, AnimationData } from "../../store-types";

function InnerGestureDetector({ ignoreZoom = false }: { ignoreZoom?: boolean; height?: number }) {
  const gestureRef = useRef<SVGRectElement>();
  const { xScale, zoomScale, bounds, animationDuration } = useTrackContext();

  const updateHoverpointPreview = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateHoverpointPreview),
  );

  const { resetPlayer, playing } = usePlayerStore(
    useShallow((state) => ({
      resetPlayer: state.resetPlayer,
      playing: state.player.running,
    })),
  );

  const framerate = useAnimationStore(
    useShallow((state: AnimationData) => state.framerate as number),
  );

  const frameCount = Math.floor(framerate * (animationDuration / 1000));

  const doubleClickHandler = useCallback(
    (event: MouseEvent) => {
      if (playing) return; // Ignore double clicks while playing
      const coords = ((event.clientX ?? 0) - bounds.left) / bounds.width;
      const newPosition = clamp(ignoreZoom ? coords : zoomScale.current.invert(coords), 0, 1);
      if (event.altKey) {
        resetPlayer(newPosition);
      } else {
        const closest: number = closestFrame(newPosition, frameCount);
        resetPlayer(closest);
      }
    },
    [bounds, frameCount, resetPlayer, zoomScale, ignoreZoom, playing],
  );

  useZoomGestures(gestureRef as MutableRefObject<EventTarget>, {
    onHover: (state) => {
      if (!state.hovering) {
        updateHoverpointPreview(null);
      }
    },
    onMove: (state) => {
      const coords = ((state.xy[0] || 0) - bounds.left) / bounds.width;
      const newPosition = clamp(ignoreZoom ? coords : zoomScale.current.invert(coords), 0, 1);
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
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      x={xScale(0)}
      y={0}
      height={Math.max(0, bounds.height - 1)}
      width={Math.max(0, bounds.width)}
      className={clsx("pointer-events-auto touch-none fill-transparent")}
    />
  );
}

export const GestureDetector = memo(InnerGestureDetector);
