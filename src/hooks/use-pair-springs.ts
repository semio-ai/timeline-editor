import { useRef, useCallback } from "react";
import { SpringValue, useSpring } from "@react-spring/web";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import type { AnimationData } from "../store-types";
import { type ScaleLinear } from "../scale-linear";
import { springConfig } from "../spring-config";
import { useStoreSubscription } from "./use-store-subscription";

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
  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );
  const zoomScaleNoOffset = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
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
      zoomScale.current.domain(ignoreZoom ? [0, 1] : viewport);
      zoomScaleNoOffset.current.domain(ignoreZoom ? [0, 1] : getRebasedViewport(viewport));
      void api.start({
        left: zoomScale.current(stamp1),
        right: zoomScale.current(stamp2),
        width: zoomScaleNoOffset.current(Math.max(0, stamp2 - stamp1)),
      });
    },
    [api, stamp1, stamp2, zoomScale, zoomScaleNoOffset, ignoreZoom],
  );

  useStoreSubscription((state: AnimationData) => state.player.viewport, onViewportChange, shallow);

  return spring;
}

function getRebasedViewport(viewport: [number, number]): [number, number] {
  return [0, viewport[1] - viewport[0]];
}
