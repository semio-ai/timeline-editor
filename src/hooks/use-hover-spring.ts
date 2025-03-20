import { useRef, useCallback } from "react";
import { MotionValue, useMotionValue } from "motion/react";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import type { AnimationData } from "../store-types";
import { SemanticTime } from "../types";
import { type ScaleLinear } from "../scale-linear";
import { useStoreSubscription } from "./use-store-subscription";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to retrieve a spring value and set it in the store. Must be used within a AnimationProvider.
 * @param ignoreZoom - A boolean that determines if the zoom should be ignored when setting the hoverpoint.
 * @returns An object containing the hoverpoint spring, a setter for the hoverpoint, and a function to clear the hoverpoint.
 */
export function useHoverSpring(ignoreZoom?: boolean): MotionValue<number | undefined> {
  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const storedHoverpoint = useRef<number | undefined>(undefined);

  const hoverpointSpring = useMotionValue<number | undefined>(undefined);

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      const scale = scaleLinear({
        domain: ignoreZoom ? [0, 1] : viewport,
        range: [0, 1],
      });
      zoomScale.current = scale;
      if (storedHoverpoint.current) {
        hoverpointSpring.jump(scale(storedHoverpoint.current));
      } else {
        hoverpointSpring.jump(undefined);
      }
    },
    [hoverpointSpring, zoomScale, ignoreZoom],
  );

  useStoreSubscription(
    (state: AnimationData) =>
      state.previews.find((p) => p.semanticTime === SemanticTime.Hover)?.stamp,
    (hoverpoint: number | undefined, pastHoverpoint: number | undefined) => {
      if (pastHoverpoint === undefined && hoverpoint !== undefined) {
        hoverpointSpring.jump(zoomScale.current(hoverpoint));
        storedHoverpoint.current = hoverpoint;
      } else if (hoverpoint !== undefined) {
        hoverpointSpring.jump(zoomScale.current(hoverpoint));
        storedHoverpoint.current = hoverpoint;
      } else {
        hoverpointSpring.jump(undefined);
        storedHoverpoint.current = hoverpoint;
      }
    },
    shallow,
  );

  usePlayerSubscription((state) => state.player.viewport, onViewportChange, shallow);

  return hoverpointSpring;
}
