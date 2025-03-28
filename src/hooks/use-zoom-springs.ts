import { MotionValue, useMotionValue } from "motion/react";
import { shallow } from "zustand/shallow";
import { PlayerData } from "@semio/utils";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to retrieve springs representing the left and right bounds of the viewport.
 * @returns An object containing the left and right springs.
 */
export function useZoomSprings(): {
  leftSpring: MotionValue<number>;
  rightSpring: MotionValue<number>;
  widthSpring: MotionValue<number>;
} {
  const leftSpring = useMotionValue<number>(0);
  const rightSpring = useMotionValue<number>(1);
  const widthSpring = useMotionValue<number>(1);

  usePlayerSubscription(
    (state: PlayerData) => state.player.viewport,
    (bounds) => {
      leftSpring.jump(bounds[0]);
      rightSpring.jump(bounds[1]);
      widthSpring.jump(bounds[1] - bounds[0]);
    },
    shallow,
  );

  return { leftSpring, rightSpring, widthSpring };
}
