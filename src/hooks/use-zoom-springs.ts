import { MotionValue, useMotionValue } from "motion/react";
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
  const leftSpring = useMotionValue<number>(0);
  const rightSpring = useMotionValue<number>(1);
  const widthSpring = useMotionValue<number>(1);

  usePlayerSubscription(
    (state: PlayerData) => ({ viewport: state.player.viewport, duration: state.player.duration }),
    ({ viewport, duration }) => {
      leftSpring.jump(xScale(viewport[0] * duration));
      rightSpring.jump(xScale(viewport[1] * duration));
      widthSpring.jump(xScale(viewport[1] * duration) - xScale(viewport[0] * duration));
    },
    shallow,
  );

  return { leftSpring, rightSpring, widthSpring };
}
