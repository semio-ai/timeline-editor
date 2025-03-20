import { useRef, useCallback } from "react";
import { MotionValue, useMotionValue } from "motion/react";
import { scaleLinear } from "@visx/scale";
import { PlayerData } from "@semio/utils";
import { shallow } from "zustand/shallow";
import { type ScaleLinear } from "../scale-linear";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to retrieve a spring representing a static value, scaled to the viewport.
 *
 * @param completion - The static value to be scaled to the viewport.
 * @param ignoreZoom - If true, the value will not be scaled to the viewport.
 * @returns A spring representing the static value, scaled to the viewport if desired.
 */
export function useStaticZoomedSpring(
  completion: number,
  ignoreZoom?: boolean,
): MotionValue<number> {
  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const zoomedSpring = useMotionValue<number>(zoomScale.current(completion));

  const onViewportChange = useCallback(
    (viewport: [number, number]) => {
      zoomScale.current.domain(ignoreZoom ? [0, 1] : viewport);
      zoomedSpring.jump(zoomScale.current(completion));
    },
    [zoomedSpring, completion, zoomScale, ignoreZoom],
  );

  usePlayerSubscription((state: PlayerData) => state.player.viewport, onViewportChange, shallow);

  return zoomedSpring;
}
