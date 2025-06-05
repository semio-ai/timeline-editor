import { useRef, memo, MutableRefObject, useCallback } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { closestFrame, usePlayerStore } from "@semio/utils";
import { clamp } from "lodash";
import { motion, useTransform } from "motion/react";
import { FullGestureState } from "@use-gesture/react";
import { DRAG_X_CONFIG } from "../../gesture-config";
import { SemanticTime } from "../../types";
import {
  useAnimationStore,
  useTrackContext,
  useBoundSprings,
  useWithBounds,
  useZoomGestures,
} from "../../hooks";

export interface BoundsDisplayProps {
  ignoreZoom?: boolean;
}

function InnerBoundsDisplay({ ignoreZoom = false }: BoundsDisplayProps) {
  const leftBoundsRef = useRef<SVGGElement>(null);
  const rightBoundsRef = useRef<SVGGElement>(null);
  const {
    frameCount,
    zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft, height: timelineHeight },
  } = useTrackContext();
  const bounds = usePlayerStore(useShallow((state) => state.player.bounds));
  const [previewLeft, previewRight, removePreview, addPreview] = useAnimationStore(
    useShallow((state) => [
      state.previews.find((p) => p.semanticTime === SemanticTime.BoundsStart),
      state.previews.find((p) => p.semanticTime === SemanticTime.BoundsEnd),
      state.removePreview,
      state.addPreview,
    ]),
  );

  // Whether there is a preview for either left or right bounds present.
  const anyPreview = previewLeft !== undefined || previewRight !== undefined;

  const updateBounds = usePlayerStore(useShallow((state) => state.updatePlayerBounds));

  const withBounds = useWithBounds();

  const handleHover =
    (side: "left" | "right") =>
    ({ hovering, dragging, event }: FullGestureState<"hover">) => {
      const semanticTime = side === "left" ? SemanticTime.BoundsStart : SemanticTime.BoundsEnd;
      const boundsIndex = side === "left" ? 0 : 1;
      const label = side === "left" ? "Bounds Start" : "Bounds End";

      if (hovering && !dragging && !anyPreview) {
        addPreview({
          semanticTime,
          stamp: bounds[boundsIndex],
          label,
        });
      } else if (!hovering && !dragging && anyPreview) {
        removePreview((p) => p.semanticTime === semanticTime);
      }
      event.stopPropagation();
    };

  const handleDrag = useCallback(
    (side: "left" | "right") =>
      ({ xy, altKey, memo: initialBoundsMemo, dragging }: FullGestureState<"drag">) => {
        let initialBounds = initialBoundsMemo;
        const semanticTime = side === "left" ? SemanticTime.BoundsStart : SemanticTime.BoundsEnd;
        const boundsIndex = side === "left" ? 0 : 1;
        const label = side === "left" ? "Bounds Start" : "Bounds End";

        withBounds((currentBounds) => {
          initialBounds = initialBounds ?? currentBounds;
          const newPosition = zoomScale.current.invert(
            clamp(((xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
          );
          const newValue = altKey ? newPosition : closestFrame(newPosition, frameCount);
          let newBounds: [number, number];
          if (side === "left") {
            newBounds =
              newValue >= initialBounds[1]
                ? [initialBounds[1], newValue]
                : [newValue, initialBounds[1]];
          } else {
            // right
            newBounds =
              newValue <= initialBounds[0]
                ? [newValue, initialBounds[0]]
                : [initialBounds[0], newValue];
          }
          updateBounds(newBounds[0], newBounds[1]);
          // If no preview is present, add one when dragging.
          // If a preview is present and no longer dragging, remove it.
          if (!anyPreview && dragging) {
            addPreview({
              semanticTime,
              stamp: newBounds[boundsIndex],
              label,
            });
          } else if (anyPreview && !dragging) {
            removePreview(
              (p) =>
                p.semanticTime === SemanticTime.BoundsStart ||
                p.semanticTime === SemanticTime.BoundsEnd,
            );
          }
        });

        return initialBounds as [number, number];
      },
    [
      updateBounds,
      addPreview,
      removePreview,
      anyPreview,
      frameCount,
      timelineLeft,
      timelineWidth,
      withBounds,
      zoomScale,
    ],
  );

  // Attach gestures to the left and right bounds.
  // We use the custom useZoomGestures hook so that it
  // also responds to standard gestures for zooming/panning.
  useZoomGestures(
    leftBoundsRef as MutableRefObject<EventTarget>,
    {
      onHover: handleHover("left"),
      onDrag: handleDrag("left"),
    },
    DRAG_X_CONFIG,
  );

  useZoomGestures(
    rightBoundsRef as MutableRefObject<EventTarget>,
    {
      onHover: handleHover("right"),
      onDrag: handleDrag("right"),
    },
    DRAG_X_CONFIG,
  );

  const { leftSpring, rightSpring, widthSpring } = useBoundSprings(ignoreZoom);

  const xLeftRect = useTransform(leftSpring, (ls) => ls - 0.5);
  const xRightRect = useTransform(rightSpring, (rs) => rs - 0.5);

  return (
    <>
      <motion.rect
        name="bounds-rect"
        x={leftSpring}
        height={timelineHeight}
        y={0}
        width={widthSpring}
        className={clsx(
          "fill-transparent pointer-events-none transition-[fill]",
          anyPreview && "group-hover/sheet:cursor-ew-resize group-hover/sheet:fill-neutral-600/25",
          anyPreview &&
            "group-aria-expanded/sheet:cursor-ew-resize group-aria-expanded/sheet:fill-neutral-600/25",
        )}
      />
      <g ref={leftBoundsRef} name="bounds-left-stroke" className="group/bound touch-none">
        <motion.line
          x1={xLeftRect}
          x2={xLeftRect}
          y1={0}
          y2={timelineHeight}
          width={1}
          className={clsx(
            "transition-stroke duration-75",
            anyPreview ? "stroke-neutral-500" : "stroke-transparent",
          )}
        />
      </g>

      <g ref={rightBoundsRef} name="bounds-right-stroke" className="group/bound touch-none">
        <motion.line
          x1={xRightRect}
          x2={xRightRect}
          y1={0}
          y2={timelineHeight}
          width={1}
          className={clsx(
            "transition-stroke duration-75",
            anyPreview ? "dark:stroke-neutral-500" : "stroke-transparent",
          )}
        />
      </g>
    </>
  );
}

export const BoundsDisplay = memo(InnerBoundsDisplay);
