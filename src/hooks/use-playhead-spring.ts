import { useContext, useEffect, useRef } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import type { AnimationData } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";

/*
  @name useAnimationStore
  @description A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function usePlayheadSpring(ignoreZoom?: boolean): SpringValue<number> {
  const store = useContext(AnimationContext);
  if (!store) {
    throw new Error("useHoverSpring must be used within a StudioProvider");
  }

  const storedPlayhead = useRef<number>(store!.getState().player.stamp);

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : store.getState().player.viewport,
      range: [0, 1],
    }),
  );

  const hoverpointSpring = useSpringValue<number>(
    store!.getState().player.stamp,
    {
      config: springConfig,
    },
  );
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.stamp,
      (playhead) => {
        void hoverpointSpring.start(zoomScale.current(playhead));
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
        void hoverpointSpring.start(zoomScale.current(playhead));
      },
    );
    return unsubscribe;
  });

  return hoverpointSpring;
}
