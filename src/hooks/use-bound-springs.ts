import { useRef, useCallback } from "react";
import { MotionValue, useMotionValue } from "motion/react";
import { PlayerData } from "@semio/utils";
import { shallow } from "zustand/shallow";
import { scaleLinear } from "@visx/scale";
import { type ScaleLinear } from "../scale-linear";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to retrieve spring values representing the dimensions of the playback region.
 * @param ignoreZoom - A boolean that determines whether the zoom scale should be ignored.
 * @returns An object containing the left, right, and width springs.
 */
export function useBoundSprings(ignoreZoom?: boolean): {
  leftSpring: MotionValue<number>;
  rightSpring: MotionValue<number>;
  widthSpring: MotionValue<number>;
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

  const leftSpring = useMotionValue<number>(zoomScale.current(0));
  const rightSpring = useMotionValue<number>(zoomScale.current(1));
  const widthSpring = useMotionValue<number>(zoomBaseZeroScale.current(1));

  usePlayerSubscription(
    (state: PlayerData) => state.player.bounds,
    (bounds) => {
      leftSpring.jump(zoomScale.current(bounds[0]));
      rightSpring.jump(zoomScale.current(bounds[1]));
      widthSpring.jump(zoomBaseZeroScale.current(Math.max(0, bounds[1] - bounds[0])));
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
      leftSpring.jump(scale(bounds[0]));
      rightSpring.jump(scale(bounds[1]));
      widthSpring.jump(baseZeroScale(Math.max(0, bounds[1] - bounds[0])));
    },
    [leftSpring, rightSpring, widthSpring, ignoreZoom],
  );

  usePlayerSubscription(
    (state: PlayerData) => ({ viewport: state.player.viewport, bounds: state.player.bounds }),
    onViewportChange,
    (current, previous) => shallow(current.viewport, previous.viewport),
  );

  return { leftSpring, rightSpring, widthSpring };
}

/**
 * Adjusts the given viewport to be based at zero.
 *
 * This function takes a viewport represented as a tuple of two numbers,
 * and returns a new viewport where the starting point is set to zero.
 *
 * @param viewport - A tuple representing the viewport, where the first element is the starting point and the second element is the ending point.
 * @returns A new viewport tuple where the starting point is zero and the ending point is adjusted accordingly.
 */
const getBasedZeroViewport = (viewport: [number, number]) => {
  return [0, viewport[1] - viewport[0]];
};
