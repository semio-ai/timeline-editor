import { useRef, memo, MutableRefObject } from "react";
import { clsx } from "clsx";
import { useShallow } from "zustand/react/shallow";
import { closestFrame } from "@semio/utils";
import { clamp } from "lodash";
import { animated } from "@react-spring/web";
import { useAnimationStore } from "./hooks/use-animation-store";
import { useTrackBounds } from "./hooks/use-track-bounds";
import { SemanticTime } from "./store-types";
import { useWithZoom } from "./hooks/use-with-zoom";
import { useBoundSprings } from "./hooks/use-bound-springs";
import { DRAG_X_CONFIG } from "./gesture-config";
import { useWithBounds } from "./hooks/use-with-bounds";
import { useZoomGestures } from "./hooks/use-zoom-gestures";
import { TIMELINE_PADDING } from "./constants";

export interface BoundsDisplayProps {
  ignoreZoom?: boolean;
  height?: number;
}

function InnerBoundsDisplay({ ignoreZoom = false, height = 30 }: BoundsDisplayProps) {
  const leftBoundsRef = useRef<SVGGElement>(null);
  const rightBoundsRef = useRef<SVGGElement>(null);
  const {
    frameCount,
    scale: xScale,
    bounds: { width: timelineWidth, left: timelineLeft },
  } = useTrackBounds();
  const bounds = useAnimationStore(useShallow((state) => state.player.bounds));
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

  const updateBounds = useAnimationStore(useShallow((state) => state.updatePlayerBounds));

  const withZoom = useWithZoom(ignoreZoom);
  const withBounds = useWithBounds();

  // Attach gestures to the left and right bounds.
  // We use the custom useZoomGestures hook so that it
  // also responds to standard gestures for zooming/panning.
  useZoomGestures(
    leftBoundsRef as MutableRefObject<EventTarget>,
    {
      onHover: ({ hovering, dragging, event }) => {
        // Show a preview when hovering over the left bounds,
        // or if the left bounds are being dragged.
        // Remove the preview if there is a preview and no longer
        // hovering or dragging.
        if (hovering && !dragging && !anyPreview) {
          addPreview({
            semanticTime: SemanticTime.BoundsStart,
            stamp: bounds[0],
            label: "Bounds Start",
          });
        } else if (!hovering && !dragging && anyPreview) {
          removePreview((p) => p.semanticTime === SemanticTime.BoundsStart);
        }
        event.stopPropagation();
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
            const newBounds: [number, number] =
              newValue >= initialBounds[1]
                ? [initialBounds[1], newValue]
                : [newValue, initialBounds[1]];
            updateBounds(newBounds[0], newBounds[1]);
            // If no preview is present, add one when dragging.
            // If a preview is present and no longer dragging, remove it.
            if (!anyPreview && dragging) {
              addPreview({
                semanticTime: SemanticTime.BoundsStart,
                stamp: newBounds[0],
                label: "Bounds Start",
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
    },
    DRAG_X_CONFIG,
  );

  useZoomGestures(
    rightBoundsRef as MutableRefObject<EventTarget>,
    {
      onHover: ({ hovering, dragging, event }) => {
        // Show a preview when hovering over the right bounds,
        // or if the right bounds are being dragged.
        // Remove the preview if there is a preview and no longer
        // hovering or dragging.
        if (hovering && !dragging && !anyPreview) {
          addPreview({
            semanticTime: SemanticTime.BoundsEnd,
            stamp: bounds[1],
            label: "Bounds End",
          });
        } else if (!hovering && !dragging && anyPreview) {
          removePreview((p) => p.semanticTime === SemanticTime.BoundsEnd);
        }
        event.stopPropagation();
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
            const newBounds: [number, number] =
              newValue <= initialBounds[0]
                ? [newValue, initialBounds[0]]
                : [initialBounds[0], newValue];
            updateBounds(newBounds[0], newBounds[1]);
            // If no preview is present, add one when dragging.
            // If a preview is present and no longer dragging, remove it.
            if (!anyPreview && dragging) {
              addPreview({
                semanticTime: SemanticTime.BoundsEnd,
                stamp: newBounds[1],
                label: "Bounds End",
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
    },
    DRAG_X_CONFIG,
  );

  const { leftSpring, rightSpring, widthSpring } = useBoundSprings(ignoreZoom);

  return (
    <>
      <animated.rect
        x={leftSpring.to((ls) => xScale(ls))}
        y={0}
        width={widthSpring.to((ws) => Math.max(0, xScale(ws) - TIMELINE_PADDING))}
        height={height}
        className={clsx(
          "fill-transparent pointer-events-none transition-[fill]",
          anyPreview && "group-hover:cursor-ew-resize group-hover:fill-neutral-600/25",
          anyPreview &&
            "group-aria-expanded:cursor-ew-resize group-aria-expanded:fill-neutral-600/25",
        )}
      />
      <g ref={leftBoundsRef} className="group/bound">
        <animated.path
          d={leftSpring.to(
            (ls) => `M${xScale(ls).toString()} 0 L${xScale(ls).toString()} ${height.toString()}Z`,
          )}
          className={clsx("transition-stroke duration-75", getStroke(anyPreview))}
        />
      </g>

      <g ref={rightBoundsRef} className="group/bound">
        <animated.path
          d={rightSpring.to(
            (rs) => `M${xScale(rs).toString()} 0 L${xScale(rs).toString()} ${height.toString()}Z`,
          )}
          className={clsx("transition-stroke duration-75", getStroke(anyPreview))}
        />
      </g>
    </>
  );
}

function getStroke(previewed: boolean): string {
  return clsx(
    "transition-[stroke]",
    previewed && "stroke-neutral-500",
    !previewed && "stroke-transparent",
  );
}

export const BoundsDisplay = memo(InnerBoundsDisplay);
