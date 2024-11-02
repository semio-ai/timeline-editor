import { useContext, useEffect, useRef, useCallback } from "react";
import { SpringValue, useSpring } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import type { AnimationData } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";

/**
 * A hook used to access springs indicating the dimensions of the region between two "static" points in a timeline. Must be used within an AnimationProvider..
 * @param stamp1 - The first timestamp.
 * @param stamp2 - The second timestamp.
 * @param ignoreZoom - A boolean that determines whether the zoom scale should be ignored.
 * @returns An object containing the left, right, and width springs.
 */
export function usePairSprings(
  stamp1: number,
  stamp2: number,
  ignoreZoom?: boolean,
): {
  left: SpringValue<number>;
  right: SpringValue<number>;
  width: SpringValue<number>;
} {
  const store = useContext(AnimationContext);

  if (!store) {
    throw new Error("useBoundSprings must be used within an AnimationProvider");
  }

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : store.getState().player.viewport,
      range: [0, 1],
    }),
  );
  const zoomScaleNoOffset = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : getRebasedViewport(store.getState().player.viewport),
      range: [0, 1],
    }),
  );

  const [spring, api] = useSpring(() => ({
    left: stamp1,
    right: stamp2,
    width: Math.max(0, stamp2 - stamp2),
    config: springConfig,
  }));

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      const scale = scaleLinear({
        domain: viewport,
        range: [0, 1],
      });
      const scaleNoOffset = scaleLinear({
        domain: getRebasedViewport(viewport),
        range: [0, 1],
      });
      zoomScale.current = scale;
      zoomScaleNoOffset.current = scaleNoOffset;
      void api.start({
        left: scale(stamp1),
        right: scale(stamp2),
        width: scaleNoOffset(Math.max(0, stamp2 - stamp1)),
      });
    },
    [api, stamp1, stamp2],
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

  return spring;
}

function getRebasedViewport(viewport: [number, number]): [number, number] {
  return [0, viewport[1] - viewport[0]];
}
