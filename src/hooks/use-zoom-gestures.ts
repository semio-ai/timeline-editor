import { useCallback, useRef, type MutableRefObject } from "react";
import {
  type AnyHandlerEventTypes,
  FullGestureState,
  type GestureHandlers,
  type UserGestureConfig,
  useGesture,
} from "@use-gesture/react";
import { useShallow } from "zustand/react/shallow";
import { PlayerActions, usePlayerStore } from "@semio/utils";
import { clamp } from "lodash";
import { scaleLinear } from "@visx/scale";
import { AnimationData } from "../store-types";
import { ScaleLinear } from "../scale-linear";
import { useTrackContext } from "./use-track-context";
import { useAnimationStore } from "./use-animation-store";
import { useShiftKeyPressed } from "./use-shift-key-pressed";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * Custom hook to handle zoom gestures on a given reference element.
 *
 * @param ref - A mutable reference object pointing to the target event element.
 * @param otherGestureHandlers - Optional additional gesture handlers to be merged with the default handlers.
 * @param config - Optional configuration object for gesture handling.
 *
 * @returns void
 *
 * This hook sets up pinch and wheel gesture handlers to manage zooming functionality.
 * It uses the `useGesture` hook to bind the handlers to the target element.
 *
 * The `onPinch` handler manages pinch gestures, updating the viewport based on the pinch scale and origin.
 * It also addresses duplicate events in Safari by maintaining a set of timestamps.
 *
 * The `onWheel` handler manages wheel gestures, updating the viewport based on the wheel delta and shift key state.
 * It ensures the viewport remains within valid bounds.
 *
 * The hook also subscribes to player viewport updates and adjusts the zoom scale domain accordingly.
 *
 * Dependencies:
 * - `useShiftKeyPressed`: Custom hook to track the state of the shift key.
 * - `useTrackContext`: Custom hook to access track context, including bounds.
 * - `usePlayerStore`: Custom hook to access and update player store state.
 * - `useAnimationStore`: Custom hook to access animation store state.
 * - `usePlayerSubscription`: Custom hook to subscribe to player state changes.
 * - `useGesture`: Hook from `@use-gesture/react` to bind gesture handlers.
 */
export const useZoomGestures = (
  ref: MutableRefObject<EventTarget>,
  otherGestureHandlers?: GestureHandlers<AnyHandlerEventTypes>,
  config?: UserGestureConfig,
) => {
  const shiftKeyPressed = useShiftKeyPressed();
  const { bounds } = useTrackContext();
  const updatePlayerViewport = usePlayerStore(
    useShallow((state: PlayerActions) => state.updatePlayerViewport),
  );

  const duration = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[state.activeAnimation].duration),
  );

  const zoomScale = useRef<ScaleLinear>(scaleLinear({ domain: [0, 1], range: [0, 1] }));

  usePlayerSubscription(
    (state) => state.player.viewport,
    (viewport) => zoomScale.current.domain(viewport),
  );

  const onPinch = useCallback(
    ({ event, offset: [scale], memo, timeStamp, origin }: FullGestureState<"pinch">) => {
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

      const newPosition = clamp(
        zoomScale.current.invert((origin[0] - bounds.left) / bounds.width),
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
      return timestampSet;
    },
    [bounds.width, bounds.left, updatePlayerViewport, zoomScale],
  );

  const onWheel = useCallback(
    ({ shiftKey, delta, event }: FullGestureState<"wheel">) => {
      const currentDomain = zoomScale.current.domain();
      const deltaMovement = shiftKey ? delta[1] : delta[0];
      const movement = deltaMovement / bounds.width;
      const proposedStart = currentDomain[0] + movement;
      const proposedEnd = currentDomain[1] + movement;
      if (proposedStart >= 0 && proposedEnd <= 1) {
        updatePlayerViewport(proposedStart, proposedEnd);
        event.preventDefault();
        event.stopPropagation();
      } else if (proposedStart < 0 && proposedEnd <= 1) {
        // fit to the start of the domain
        updatePlayerViewport(0, proposedEnd - proposedStart);
        event.preventDefault();
        event.stopPropagation();
      } else if (proposedStart >= 0 && proposedEnd > 1) {
        // fit to the end of the domain
        updatePlayerViewport(proposedStart - (proposedEnd - 1), 1);
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [bounds.width, updatePlayerViewport, zoomScale],
  );

  useGesture(
    {
      // unpack other gesture handlers that were passed in
      ...(otherGestureHandlers ?? {}),
      onPinch,
      onWheel,
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
