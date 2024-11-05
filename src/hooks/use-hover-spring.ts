import { useRef, useCallback } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import type { AnimationData } from "../store-types";
import { SemanticTime } from "../store-types";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";
import { useStoreSubscription } from "./use-store-subscription";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to retrieve a spring value and set it in the store. Must be used within a AnimationProvider.
 * @param ignoreZoom - A boolean that determines if the zoom should be ignored when setting the hoverpoint.
 * @returns An object containing the hoverpoint spring, a setter for the hoverpoint, and a function to clear the hoverpoint.
 */
export function useHoverSpring(ignoreZoom?: boolean): SpringValue<number | undefined> {
  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const storedHoverpoint = useRef<number | undefined>(undefined);

  const hoverpointSpring = useSpringValue<number | undefined>(undefined, {
    config: springConfig,
  });

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      const scale = scaleLinear({
        domain: ignoreZoom ? [0, 1] : viewport,
        range: [0, 1],
      });
      zoomScale.current = scale;
      if (storedHoverpoint.current) {
        void hoverpointSpring.start(scale(storedHoverpoint.current));
      } else {
        void hoverpointSpring.set(undefined);
      }
    },
    [hoverpointSpring, zoomScale, ignoreZoom],
  );

  useStoreSubscription(
    (state: AnimationData) =>
      state.previews.find((p) => p.semanticTime === SemanticTime.Hover)?.stamp,
    (hoverpoint: number | undefined, pastHoverpoint: number | undefined) => {
      if (pastHoverpoint === undefined && hoverpoint !== undefined) {
        void hoverpointSpring.set(zoomScale.current(hoverpoint));
        storedHoverpoint.current = hoverpoint;
      } else if (hoverpoint !== undefined) {
        void hoverpointSpring.start(zoomScale.current(hoverpoint));
        storedHoverpoint.current = hoverpoint;
      } else {
        void hoverpointSpring.set(undefined);
        storedHoverpoint.current = hoverpoint;
      }
    },
    shallow,
  );

  usePlayerSubscription((state) => state.player.viewport, onViewportChange, shallow);

  return hoverpointSpring;
}
