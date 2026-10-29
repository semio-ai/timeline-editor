import { MotionValue, useMotionValue } from "motion/react";
import { shallow } from "zustand/shallow";
import { PlayerData } from "../player/player-store";
import { useLayoutPlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to retrieve a spring representing the current playhead time, scaled to the viewport.
 * @param ignoreZoom - If true, the playhead will not be scaled to the viewport.
 * @returns A spring representing the current playhead time, scaled to the viewport if desired.
 */
export function usePlayheadSpring(): MotionValue<number> {
  const playheadSpring = useMotionValue<number>(0);

  useLayoutPlayerSubscription(
    (state: PlayerData) => state.player.stamp,
    (stamp) => {
      playheadSpring.jump(stamp);
    },
    shallow,
  );

  return playheadSpring;
}
