import { useRef, useCallback } from "react";
import { SpringValue, useSpringValue } from "@react-spring/web";
import { shallow } from "zustand/shallow";
import { scaleLinear } from "@visx/scale";
import type { AnimationData } from "../store-types";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";
import { useStoreSubscription } from "./use-store-subscription";

/**
 * A hook used to retrieve spring values representing the dimensions of the playback region.
 * @param ignoreZoom - A boolean that determines whether the zoom scale should be ignored.
 * @returns An object containing the left, right, and width springs.
 */
export function useBoundSprings(ignoreZoom?: boolean): {
  leftSpring: SpringValue<number>;
  rightSpring: SpringValue<number>;
  widthSpring: SpringValue<number>;
} {
  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );
  const zoomBaseZeroScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const leftSpring = useSpringValue<number>(zoomScale.current(0), {
    config: springConfig,
  });
  const rightSpring = useSpringValue<number>(zoomScale.current(1), {
    config: springConfig,
  });
  const widthSpring = useSpringValue<number>(zoomBaseZeroScale.current(1), {
    config: springConfig,
  });

  useStoreSubscription(
    (state: AnimationData) => state.player.bounds,
    (bounds) => {
      void leftSpring.set(zoomScale.current(bounds[0]));
      void rightSpring.set(zoomScale.current(bounds[1]));
      void widthSpring.set(zoomBaseZeroScale.current(Math.max(0, bounds[1] - bounds[0])));
    },
    shallow,
  );

  const onViewportChange = useCallback(
    ({ viewport, bounds }: { viewport: [number, number]; bounds: [number, number] }) => {
      const scale = scaleLinear({
        domain: ignoreZoom ? [0, 1] : viewport,
        range: [0, 1],
      });
      const baseZeroScale = scaleLinear({
        domain: getBasedZeroViewport(viewport),
        range: [0, 1],
      });
      zoomScale.current = scale;
      zoomBaseZeroScale.current = baseZeroScale;
      void leftSpring.start(scale(bounds[0]));
      void rightSpring.start(scale(bounds[1]));
      void widthSpring.start(baseZeroScale(Math.max(0, bounds[1] - bounds[0])));
    },
    [leftSpring, rightSpring, widthSpring, ignoreZoom],
  );

  useStoreSubscription(
    (state: AnimationData) => ({ viewport: state.player.viewport, bounds: state.player.bounds }),
    onViewportChange,
    (current, previous) => shallow(current.viewport, previous.viewport),
  );

  return { leftSpring, rightSpring, widthSpring };
}

const getBasedZeroViewport = (viewport: [number, number]) => {
  return [0, viewport[1] - viewport[0]];
};
