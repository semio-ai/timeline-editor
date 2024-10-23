import { type MutableRefObject } from "react";
import {
  type AnyHandlerEventTypes,
  type GestureHandlers,
  type UserGestureConfig,
  useGesture,
} from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
import { clamp } from "lodash";
import { AnimationActions, AnimationData } from "../store-types";
import { useWithZoom } from "./use-with-zoom";
import { useTrackContext } from "./use-track-context";
import { useAnimationStore } from "./use-animation-store";
import { useShiftKeyPressed } from "./use-shift-key-pressed";

export const useZoomGestures = (
  ref: MutableRefObject<EventTarget>,
  otherGestureHandlers?: GestureHandlers<AnyHandlerEventTypes>,
  config?: UserGestureConfig,
) => {
  const withZoom = useWithZoom(false);
  const shiftKeyPressed = useShiftKeyPressed();
  const { bounds } = useTrackContext();
  const { duration, updatePlayerViewport } = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => ({
      duration: state.animations[state.activeAnimation].duration,
      updatePlayerViewport: state.updatePlayerViewport,
    })),
  );

  useGesture(
    {
      // unpack other gesture handlers that were passed in
      ...(otherGestureHandlers ?? {}),
      onPinch: ({ event, offset: [scale], memo, timeStamp, origin }) => {
        event.preventDefault();
        event.stopPropagation();
        // Note, timestampSet is returned from this handler,
        // which becomes the memo value for the next pinch event
        let timestampSet: Set<number> = memo ?? new Set<number>();

        // Temp solution to address safari receiving duplicate events
        // https://github.com/pmndrs/use-gesture/issues/681
        const isRepeatTimestamp = timestampSet.has(timeStamp);
        if (isRepeatTimestamp) {
          return timestampSet;
        } else if (timestampSet.size > 16) {
          // If the set exceeds 16 elements, remove the oldest one
          timestampSet = new Set([...timestampSet].slice(1));
          // And then add the latest timestamp
          timestampSet.add(timeStamp);
        } else {
          // Just add the latest timestamp
          timestampSet.add(timeStamp);
        }

        withZoom((zoomScale) => {
          const newPosition = clamp(
            zoomScale.invert((origin[0] - bounds.left) / bounds.width),
            0,
            1,
          );
          const clampedScale = Math.max(1, scale);
          const newDomainWidth = 1 / clampedScale;

          const newDomain = [
            newPosition - newDomainWidth * newPosition,
            newPosition + newDomainWidth * (1 - newPosition),
          ];
          updatePlayerViewport(newDomain[0], newDomain[1]);
        });
        return timestampSet;
      },
      onWheel: ({ event, delta, shiftKey }) => {
        withZoom((zoomScale) => {
          const currentDomain = zoomScale.domain();
          const deltaMovement = shiftKey ? delta[1] : delta[0];
          const movement = deltaMovement / bounds.width;
          const proposedStart = currentDomain[0] + movement;
          const proposedEnd = currentDomain[1] + movement;
          if (proposedStart >= 0 && proposedEnd <= 1) {
            updatePlayerViewport(proposedStart, proposedEnd);
          } else if (proposedStart < 0 && proposedEnd <= 1) {
            // fit to the start of the domain
            updatePlayerViewport(0, proposedEnd - proposedStart);
          } else if (proposedStart >= 0 && proposedEnd > 1) {
            // fit to the end of the domain
            updatePlayerViewport(proposedStart - (proposedEnd - 1), 1);
          }
        });
        event.preventDefault();
        event.stopPropagation();
      },
    },
    {
      // unpack other gesture handlers that were passed in.
      ...(config ?? {}),
      target: ref,

      pinch: {
        scaleBounds: { min: 1, max: duration / 500 },
        rubberband: true,
        modifierKey: ["metaKey", "ctrlKey"],
      },
      wheel: {
        axis: shiftKeyPressed ? "y" : "x",
      },
      eventOptions: { passive: false },
    },
  );
};
