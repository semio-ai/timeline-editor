import { useContext, useEffect, useRef, useCallback } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import type { AnimationData } from "../store-types";
// import { SemanticTime } from "../store-types";
import { AnimationContext } from "../context";
import { defaultScaleLinear, type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";

/*
  @name useAnimationStore
  @description A hook used to access values in the store. Must be used within a AnimationProvider. See the AnimationData for the attributes and the AnimationActions for the methods that can be accessed.

  @param selector A function that takes the store and returns the value you want to access.
*/
export function useStaticZoomedSpring(
  completion: number,
  ignoreZoom?: boolean,
): SpringValue<number> {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error(
      "useStaticZoomedSpring must be used within an AnimationProvider",
    );
  }

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : store.getState().player.viewport,
      range: [0, 1],
    }),
  );

  const zoomedSpring = useSpringValue<number>(zoomScale.current(completion), {
    config: springConfig,
  });

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      const scale = scaleLinear({
        domain: viewport,
        range: [0, 1],
      });
      zoomScale.current = scale;
      void zoomedSpring.start(scale(completion));
    },
    [zoomedSpring, completion],
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
  }, [ignoreZoom, store, zoomedSpring, completion, onViewportChange]);

  return zoomedSpring;
}
