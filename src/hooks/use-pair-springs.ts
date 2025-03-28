import { useRef, useCallback } from "react";
import { MotionValue, useMotionValue } from "motion/react";
import { scaleLinear } from "@visx/scale";
import { PlayerData } from "@semio/utils";
import { shallow } from "zustand/shallow";
import { type ScaleLinear } from "../scale-linear";
import { usePlayerSubscription } from "./use-player-subscription";

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
  left: MotionValue<number>;
  right: MotionValue<number>;
  width: MotionValue<number>;
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

  const leftSpring = useMotionValue<number>(stamp1);
  const rightSpring = useMotionValue<number>(stamp2);
  const widthSpring = useMotionValue<number>(Math.max(0, stamp2 - stamp2));

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      zoomScale.current.domain(ignoreZoom ? [0, 1] : viewport);
      zoomScaleNoOffset.current.domain(ignoreZoom ? [0, 1] : getRebasedViewport(viewport));
      leftSpring.jump(zoomScale.current(stamp1));
      rightSpring.jump(zoomScale.current(stamp2));
      widthSpring.jump(zoomScaleNoOffset.current(Math.max(0, stamp2 - stamp1)));
    },
    [
      stamp1,
      stamp2,
      zoomScale,
      zoomScaleNoOffset,
      ignoreZoom,
      leftSpring,
      rightSpring,
      widthSpring,
    ],
  );

  usePlayerSubscription((state: PlayerData) => state.player.viewport, onViewportChange, shallow);

  return { left: leftSpring, right: rightSpring, width: widthSpring };
}

function getRebasedViewport(viewport: [number, number]): [number, number] {
  return [0, viewport[1] - viewport[0]];
}
