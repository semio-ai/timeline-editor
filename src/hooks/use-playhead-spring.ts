import { useContext, useRef } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import type { AnimationData } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";
import { useStoreSubscription } from "./use-store-subscription";

/**
 * A hook used to retrieve a spring representing the current playhead time, scaled to the viewport.
 * @param ignoreZoom - If true, the playhead will not be scaled to the viewport.
 * @returns A spring representing the current playhead time, scaled to the viewport if desired.
 */
export function usePlayheadSpring(ignoreZoom?: boolean): SpringValue<number> {
  const store = useContext(AnimationContext);
  if (!store) {
    throw new Error("useHoverSpring must be used within a StudioProvider");
  }

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const storedPlayhead = useRef<number>(0);

  const playheadSpring = useSpringValue<number>(0, {
    config: springConfig,
  });

  useStoreSubscription(
    (state: AnimationData) => state.player.stamp,
    (playhead) => {
      void playheadSpring.start(zoomScale.current(playhead));
      storedPlayhead.current = playhead;
    },
    shallow,
  );

  useStoreSubscription(
    (state: AnimationData) => state.player.viewport,
    (viewport) => {
      zoomScale.current.domain(ignoreZoom ? [0, 1] : viewport);
      const playhead = storedPlayhead.current;
      void playheadSpring.start(zoomScale.current(playhead));
    },
    shallow,
  );

  return playheadSpring;
}
