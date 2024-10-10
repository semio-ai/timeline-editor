import { useContext, useEffect, useRef } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import type { AnimationData } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";

/*
  @name usePlayheadSpring
  @description A hook used to retrieve a spring representing the current playhead time, scaled to the viewport.
  @param ignoreZoom If true, the playhead will not be scaled to the viewport.
  @returns A spring representing the current playhead time, scaled to the viewport if desired.
*/
export function usePlayheadSpring(ignoreZoom?: boolean): SpringValue<number> {
  const store = useContext(AnimationContext);
  if (!store) {
    throw new Error("useHoverSpring must be used within a StudioProvider");
  }

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : store.getState().player.viewport,
      range: [0, 1],
    }),
  );

  const storedPlayhead = useRef<number>(store!.getState().player.stamp);

  const playheadSpring = useSpringValue<number>(zoomScale.current(store!.getState().player.stamp), {
    config: springConfig,
  });
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.stamp,
      (playhead) => {
        void playheadSpring.start(zoomScale.current(playhead));
        storedPlayhead.current = playhead;
      },
    );
    return unsubscribe;
  });
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.viewport,
      (viewport) => {
        zoomScale.current = scaleLinear({
          domain: ignoreZoom ? [0, 1] : viewport,
          range: [0, 1],
        });
        const playhead = storedPlayhead.current;
        void playheadSpring.start(zoomScale.current(playhead));
      },
    );
    return unsubscribe;
  });

  return playheadSpring;
}
