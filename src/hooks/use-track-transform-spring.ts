import { MotionValue, useMotionValue, useTransform } from "motion/react";
import { shallow } from "zustand/shallow";
import { TIMELINE_PADDING } from "../constants";
import { useTrackContext } from "./use-track-context";
import { useAnimationStore } from "./use-animation-store";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook that returns a string motion value for a transform style.
 * This transform positions an individual track within the viewport
 * according to its instance settings and the viewport configuration.
 * @param ignoreZoom
 * @param ignoreInstance
 * @returns
 */
export function useTrackTransformSpring(
  ignoreZoom: boolean,
  ignoreInstance: boolean,
): MotionValue<string> {
  const { instanceSettings, animationId, xScale } = useTrackContext();
  const animationDuration = useAnimationStore(
    (state) => state.animations[animationId].duration ?? 5000,
  );

  const viewportScalingFactorSpring = useMotionValue<number>(1);
  const viewportPositionSpring = useMotionValue<number>(0);

  const transformSpring = useTransform<number, string>(
    [viewportScalingFactorSpring, viewportPositionSpring],
    ([scale, position]) => {
      if (ignoreInstance && ignoreZoom) {
        return `translate(0 0)`;
      } else if (ignoreInstance) {
        return `translate(${TIMELINE_PADDING.toString()} 0) scale(${scale.toString()} 1) translate(${(-1 * position).toString()} 0)`;
      } else if (ignoreZoom) {
        return `translate(${(xScale(animationDuration) * instanceSettings.offset).toString()} 0) scale(${(1 / instanceSettings.timescale).toString()} 1)`;
      } else {
        return `translate(${(xScale(animationDuration) * instanceSettings.offset).toString()} 0) scale(${(1 / instanceSettings.timescale).toString()} 1) translate(${TIMELINE_PADDING.toString()} 0) scale(${scale.toString()} 1) translate(${(-1 * position).toString()} 0)`;
      }
    },
  );

  usePlayerSubscription(
    (state) => ({ viewport: state.player.viewport, duration: state.player.duration }),
    ({ viewport, duration }) => {
      viewportScalingFactorSpring.jump(1 / (viewport[1] - viewport[0]));
      viewportPositionSpring.jump(xScale(viewport[0] * duration));
    },
    shallow,
  );

  return transformSpring;
}
