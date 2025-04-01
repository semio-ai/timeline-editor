import { MotionValue, useSpring, useTransform } from "motion/react";
import { shallow } from "zustand/shallow";
import { PlayerData } from "@semio/utils";
import { usePlayerSubscription } from "./use-player-subscription";
import { useTrackContext } from "./use-track-context";

/**
 * A hook used to retrieve springs representing the left and right bounds of the viewport.
 * @returns An object containing the left and right springs.
 */
export function useZoomSprings(): {
  leftSpring: MotionValue<number>;
  rightSpring: MotionValue<number>;
  widthSpring: MotionValue<number>;
} {
  const { xScale } = useTrackContext();
  const leftSpring = useSpring(0, { mass: 0.001, bounce: 0.1, stiffness: 200 });
  const rightSpring = useSpring(1, { mass: 0.001, bounce: 0.1, stiffness: 200 });
  const widthSpring = useTransform<number, number>(
    [leftSpring, rightSpring],
    ([left, right]) => right - left,
  );

  usePlayerSubscription(
    (state: PlayerData) => ({ viewport: state.player.viewport, duration: state.player.duration }),
    ({ viewport, duration }) => {
      leftSpring.set(xScale(viewport[0] * duration));
      rightSpring.set(xScale(viewport[1] * duration));
    },
    shallow,
  );

  return { leftSpring, rightSpring, widthSpring };
}
