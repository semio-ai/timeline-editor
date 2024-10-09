import { type ReactNode, memo, useRef } from "react";
import { animated } from "@react-spring/web";
import { clamp } from "lodash";
import { clsx } from "clsx";
import { closestFrame, pointsToPath } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useWithZoom } from "./hooks/use-with-zoom";
import { useWithBounds } from "./hooks/use-with-bounds";
import { useZoomGestures } from "./hooks/use-zoom-gestures";
import { type AnimationActions } from "./store-types";
import { SemanticTime } from "./store-types";
import { DRAG_X_CONFIG } from "./gesture-config";
import { useBoundSprings } from "./hooks/use-bound-springs";

export interface BoundCartProps {
  side: "top" | "bottom";
  end: "left" | "right";
  ignoreZoom?: boolean;
}

function InnerBoundCart({ side, end, ignoreZoom }: BoundCartProps): ReactNode {
  const {
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
    frameCount,
  } = useTrackBounds();

  const cartRef = useRef<SVGGElement | null>(null);

  const updatePlayerBounds = useAnimationStore(
    useShallow((state: AnimationActions) => state.updatePlayerBounds),
  );

  const withZoom = useWithZoom(ignoreZoom);
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
      onDrag: ({ xy, altKey, memo: initialBoundsMemo, dragging }) => {
        let initialBounds = initialBoundsMemo;
        withZoom((zoomScale) => {
          withBounds((currentBounds) => {
            initialBounds = initialBounds ?? currentBounds;
            const newPosition = zoomScale.invert(
              clamp(((xy[0] || 0) - timelineLeft) / timelineWidth, 0, 1),
            );
            const newValue = altKey ? newPosition : closestFrame(newPosition, frameCount);
            let newBounds: [number, number] = initialBounds;
            if (end === "left") {
              newBounds =
                newValue >= initialBounds[1]
                  ? [initialBounds[1], newValue]
                  : [newValue, initialBounds[1]];
            } else {
              newBounds =
                newValue <= initialBounds[0]
                  ? [newValue, initialBounds[0]]
                  : [initialBounds[0], newValue];
            }
            updatePlayerBounds(newBounds[0], newBounds[1]);
            // If no preview is present, add one when dragging.
            // If a preview is present and no longer dragging, remove it.
            if (!anyPreview && dragging) {
              addPreview({
                semanticTime: end === "left" ? SemanticTime.BoundsStart : SemanticTime.BoundsEnd,
                stamp: currentBounds[end === "left" ? 0 : 1],
                label: end === "left" ? "Bounds Start" : "Bounds End",
              });
            } else if (anyPreview && !dragging) {
              removePreview(
                (p) =>
                  p.semanticTime === SemanticTime.BoundsStart ||
                  p.semanticTime === SemanticTime.BoundsEnd,
              );
            }
          });
        });
        return initialBounds as [number, number];
      },
      onDoubleClick: (state) => {
        state.event.stopPropagation();
      },
    },
    DRAG_X_CONFIG,
  );

  return (
    <animated.g
      ref={cartRef}
      className="touch-none"
      style={{
        transform: boundSpring.to(
          (c) => `translate(${xScale(c).toString()}px, ${side === "top" ? "-3.5" : "3.5"}px)`,
        ),
      }}
    >
      {/* Cart path */}
      <animated.path
        d={getCartPath(side, end)}
        className={clsx(
          "touch-none",
          "transition-[fill]",
          anyPreview ? "fill-neutral-500" : "fill-neutral-500/60",
        )}
        y={side === "top" ? 20.5 : 0}
      />
    </animated.g>
  );
}

const leftTopCartPath = pointsToPath(
  [
    [-0.5, 5],
    [6.5, 5],
    [6.5, 22.5],
    [0.5, 25.5],
    [-0.5, 25.5],
  ],
  true,
);

const leftBottomCartPath = pointsToPath(
  [
    [-0.5, 22.5],
    [6.5, 22.5],
    [6.5, 5],
    [0.5, 1.5],
    [-0.5, 1.5],
  ],
  true,
);

const rightTopCartPath = pointsToPath(
  [
    [0.5, 5],
    [-6.5, 5],
    [-6.5, 22.5],
    [-0.5, 25.5],
    [0.5, 25.5],
  ],
  true,
);

const rightBottomCartPath = pointsToPath(
  [
    [0.5, 22.5],
    [-6.5, 22.5],
    [-6.5, 5],
    [-0.5, 1.5],
    [0.5, 1.5],
  ],
  true,
);

function getCartPath(side: "top" | "bottom", end: "left" | "right"): string {
  if (side === "top") {
    return end === "left" ? leftTopCartPath : rightTopCartPath;
  } else {
    return end === "left" ? leftBottomCartPath : rightBottomCartPath;
  }
}

export const BoundCart = memo(InnerBoundCart);
