import { useContext, useEffect, useRef, useCallback } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import type { AnimationData } from "../store-types";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";

/*
  @name useBoundSprings
  @description A hook used to retrieve spring values representing the dimensions of the playback region.
  @param ignoreZoom A boolean that determines whether the zoom scale should be ignored.
  @returns An object containing the left, right, and width springs.
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

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom ? [0, 1] : store.getState().player.viewport,
      range: [0, 1],
    }),
  );
  const zoomBaseZeroScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: ignoreZoom
        ? [0, 1]
        : getBasedZeroViewport(store.getState().player.viewport),
      range: [0, 1],
    }),
  );

  const leftSpring = useSpringValue<number>(
    zoomScale.current(store.getState().player.bounds[0]),
    {
      config: springConfig,
    },
  );
  const rightSpring = useSpringValue<number>(
    zoomScale.current(store.getState().player.bounds[1]),
    { config: springConfig },
  );
  const widthSpring = useSpringValue<number>(
    zoomBaseZeroScale.current(
      Math.max(
        0,
        store.getState().player.viewport[1] -
          store.getState().player.viewport[0],
      ),
    ),
    { config: springConfig },
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state: AnimationData) => state.player.bounds,
      (bounds) => {
        void leftSpring.set(zoomScale.current(bounds[0]));
        void rightSpring.set(zoomScale.current(bounds[1]));
        void widthSpring.set(
          zoomBaseZeroScale.current(Math.max(0, bounds[1] - bounds[0])),
        );
      },
    );
    return unsubscribe;
  }, [
    store,
    leftSpring,
    rightSpring,
    widthSpring,
    zoomScale,
    zoomBaseZeroScale,
  ]);

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      const scale = scaleLinear({
        domain: viewport,
        range: [0, 1],
      });
      const baseZeroScale = scaleLinear({
        domain: getBasedZeroViewport(viewport),
        range: [0, 1],
      });
      zoomScale.current = scale;
      zoomBaseZeroScale.current = baseZeroScale;
      const bounds = store.getState().player.bounds;
      void leftSpring.start(scale(bounds[0]));
      void rightSpring.start(scale(bounds[1]));
      void widthSpring.start(baseZeroScale(Math.max(0, bounds[1] - bounds[0])));
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

const getBasedZeroViewport = (viewport: [number, number]) => {
  return [0, viewport[1] - viewport[0]];
};
