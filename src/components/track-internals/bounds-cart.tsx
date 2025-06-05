import { type ReactNode, memo, useCallback, useRef } from "react";
import { useTransform, motion } from "motion/react";
import { FullGestureState } from "@use-gesture/react";
import { clamp } from "lodash";
import { clsx } from "clsx";
import { closestFrame, usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import {
  useTrackContext,
  useAnimationStore,
  useWithBounds,
  useZoomGestures,
  useBoundSprings,
} from "../../hooks";
import { SemanticTime } from "../../types";
import { DRAG_X_CONFIG } from "../../gesture-config";
import { VERTICAL_HALF_POINTER_PATH } from "../../constants";

export interface BoundCartProps {
  side: "top" | "bottom";
  end: "left" | "right";
  ignoreZoom?: boolean;
}

function InnerBoundCart({ side, end, ignoreZoom }: BoundCartProps): ReactNode {
  const {
    zoomScale,
    bounds: { width: timelineWidth, left: timelineLeft, height: timelineHeight },
    frameCount,
  } = useTrackContext();

  const cartRef = useRef<SVGPathElement | null>(null);

  const updateBounds = usePlayerStore(useShallow((state) => state.updatePlayerBounds));

  const withBounds = useWithBounds();
  const { leftSpring, rightSpring } = useBoundSprings(ignoreZoom);
  const boundSpring = end === "left" ? leftSpring : rightSpring;

  const [previewLeft, previewRight, removePreview, addPreview, _updatePreview] = useAnimationStore(
    useShallow((state) => [
      state.previews.find((p) => p.semanticTime === SemanticTime.BoundsStart),
      state.previews.find((p) => p.semanticTime === SemanticTime.BoundsEnd),
      state.removePreview,
      state.addPreview,
      state.updatePreview,
    ]),
  );

  // Whether there is a preview for either left or right bounds present.
  const anyPreview = previewLeft !== undefined || previewRight !== undefined;

  // Callback to execute when dragging bounds
  const handleDrag = useCallback(
    ({ xy, altKey, memo: initialBoundsMemo, dragging }: FullGestureState<"drag">) => {
      let initialBounds = initialBoundsMemo;
      const semanticTime = end === "left" ? SemanticTime.BoundsStart : SemanticTime.BoundsEnd;
      const boundsIndex = end === "left" ? 0 : 1;
      const label = end === "left" ? "Bounds Start" : "Bounds End";

      withBounds((currentBounds) => {
        initialBounds = initialBounds ?? currentBounds;
        const newPosition = zoomScale.current.invert(
          clamp(((xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
        );
        const newValue = altKey ? newPosition : closestFrame(newPosition, frameCount);
        let newBounds: [number, number];
        if (end === "left") {
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
      end,
    ],
  );

  // Attach gestures to the current bound.
  // We use the custom useZoomGestures hook so that it
  // also responds to standard gestures for zooming/panning.
  useZoomGestures(
    cartRef as React.MutableRefObject<SVGPathElement>,
    {
      onHover: ({ hovering, dragging }) => {
        // Show a preview when hovering over the left/right bounds,
        // or if either of the bounds are being dragged.
        // Remove the preview if there is a preview and no longer
        // hovering or dragging.
        if (hovering && !dragging && !anyPreview) {
          withBounds((currentBounds) => {
            addPreview({
              semanticTime: end === "left" ? SemanticTime.BoundsStart : SemanticTime.BoundsEnd,
              stamp: currentBounds[end === "left" ? 0 : 1],
              label: end === "left" ? "Bounds Start" : "Bounds End",
            });
          });
        } else if (!hovering && !dragging && anyPreview) {
          removePreview(
            (p) =>
              p.semanticTime === SemanticTime.BoundsStart ||
              p.semanticTime === SemanticTime.BoundsEnd,
          );
        }
      },
      onDrag: handleDrag,
      onDoubleClick: (state) => {
        state.event.stopPropagation();
      },
    },
    DRAG_X_CONFIG,
  );

  const transform = useTransform(boundSpring, (value) => {
    return `translate(${value.toString()} 0)`;
  });

  transform.on("change", (v) => {
    cartRef.current?.setAttribute("transform", v);
  });

  return (
    <motion.g
      data-highlighted={anyPreview ? "" : undefined}
      ref={cartRef}
      className="touch-none group/cart opacity-50 hover:opacity-80 data-[highlighted]:opacity-80"
      transform={transform.get()}
    >
      <path
        ref={cartRef}
        transform={[
          `translate(0 ${side === "top" ? "2" : "31"})`,
          `rotate(${side === "top" ? "0" : "180"})`,
          `scale(${(end === "left" && side === "bottom") || (end === "right" && side === "top") ? "-1" : "1"} 1)`,
        ].join(" ")}
        d={VERTICAL_HALF_POINTER_PATH}
        className={clsx("touch-none", "fill-neutral-500")}
      />
      <line
        strokeLinecap="round"
        x1={end === "left" ? 1 : -1}
        x2={end === "left" ? 1 : -1}
        y1={side === "top" ? 5 : 1}
        y2={side === "top" ? timelineHeight - 1 : timelineHeight - 5}
        strokeWidth={2}
        className={clsx("touch-none pointer-events-none", "stroke-neutral-500")}
      />
    </motion.g>
  );
}

export const BoundCart = memo(InnerBoundCart);
