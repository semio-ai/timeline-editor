import { useMemo } from "react";
import { MotionValue, useMotionValue, useTransform } from "motion/react";
import { shallow } from "zustand/shallow";
import { usePlayerStore } from "@semio/utils";
import { useTrackContext } from "./use-track-context";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook that returns a string motion value for a transform style that
 * undoes the zoom-related transforms incurred by the higher-level viewport zoom
 * and instance settings, so that the elements visually maintain the same size/proportions.
 * @param ignoreZoom - whether to ignore the zoom from the viewport
 */
export function useScaleInverseSpring(ignoreZoom: boolean): MotionValue<number> {
  const { instanceSettings } = useTrackContext();

  const initialViewportScaling = useMemo(() => {
    if (ignoreZoom) {
      return instanceSettings.timescale;
    }
    const { viewport } = usePlayerStore.getState().player;
    return viewport[1] - viewport[0];
  }, [ignoreZoom, instanceSettings.timescale]);

  const viewportScalingFactorSpring = useMotionValue<number>(initialViewportScaling);

  const transformSpring = useTransform(viewportScalingFactorSpring, (scale) => {
    if (ignoreZoom) {
      return instanceSettings.timescale;
    } else {
      return scale / instanceSettings.timescale;
    }
  });

  usePlayerSubscription(
    (state) => state.player.viewport,
    (viewport) => {
      if (ignoreZoom) {
        viewportScalingFactorSpring.jump(instanceSettings.timescale);
      } else {
        viewportScalingFactorSpring.jump(viewport[1] - viewport[0]);
      }
    },
    shallow,
  );

  return transformSpring;
}
