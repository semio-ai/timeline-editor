import { MotionValue, useMotionValue, useTransform } from "motion/react";
import { shallow } from "zustand/shallow";
import { useTrackContext } from "./use-track-context";
import { usePlayerSubscription } from "./use-player-subscription";

export function useScaleInverseSpring(ignoreZoom: boolean): MotionValue<number> {
  const { instanceSettings } = useTrackContext();

  const viewportScalingFactorSpring = useMotionValue<number>(1);

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
