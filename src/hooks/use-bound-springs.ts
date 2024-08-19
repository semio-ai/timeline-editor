import { useContext, useEffect, useRef, useCallback } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import type { AnimationData } from "../store-types";
import { AnimationContext } from "../context";
import { defaultScaleLinear, type ScaleLinear } from "../scale-linear";

/*
  @name useAnimationStore
  @description A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function useBoundSprings(ignoreZoom?: boolean): {
  leftSpring: SpringValue<number>;
  rightSpring: SpringValue<number>;
  widthSpring: SpringValue<number>;
} {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useBoundSprings must be used within an AnimationProvider");
  }

  const zoomScale = useRef<ScaleLinear>(defaultScaleLinear);

  const leftSpring = useSpringValue<number>(store.getState().player.bounds[0]);
  const rightSpring = useSpringValue<number>(store.getState().player.bounds[1]);
  const widthSpring = useSpringValue<number>(
    Math.max(
      0,
      store.getState().player.viewport[1] - store.getState().player.viewport[0],
    ),
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.bounds,
      (bounds) => {
        void leftSpring.set(zoomScale.current(bounds[0]));
        void rightSpring.set(zoomScale.current(bounds[1]));
        void widthSpring.set(
          zoomScale.current(Math.max(0, bounds[1] - bounds[0])),
        );
      },
    );
    return unsubscribe;
  }, [store, leftSpring, rightSpring, widthSpring, zoomScale]);

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      const scale = scaleLinear({
        domain: viewport,
        range: [0, 1],
      });
      const bounds = store.getState().player.bounds;
      void leftSpring.start(scale(bounds[0]));
      void rightSpring.start(scale(bounds[1]));
      void widthSpring.start(scale(Math.max(0, bounds[1] - bounds[0])));
    },
    [leftSpring, rightSpring, widthSpring, store],
  );

  useEffect(() => {
    if (ignoreZoom) {
      zoomScale.current = scaleLinear({
        domain: [0, 1],
        range: [0, 1],
      });
      return () => {};
    } else {
      const unsubscribe = store.subscribe(
        (state: AnimationData) => state.player.viewport,
        onViewportChange,
      );

      onViewportChange(store.getState().player.viewport);

      return unsubscribe;
    }
  }, [ignoreZoom, store, onViewportChange]);

  return { leftSpring, rightSpring, widthSpring };
}
