import { useContext, useRef } from "react";
import { MotionValue, useMotionValue } from "motion/react";
import { PlayerData } from "@semio/utils";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { usePlayerSubscription } from "./use-player-subscription";

/**
 * A hook used to retrieve a spring representing the current playhead time, scaled to the viewport.
 * @param ignoreZoom - If true, the playhead will not be scaled to the viewport.
 * @returns A spring representing the current playhead time, scaled to the viewport if desired.
 */
export function usePlayheadSpring(ignoreZoom?: boolean): MotionValue<number> {
  const store = useContext(AnimationContext);
  if (!store) {
    throw new Error("useHoverSpring must be used within a StudioProvider");
  }

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const storedPlayhead = useRef<number>(0);

  const playheadSpring = useMotionValue<number>(0);

  usePlayerSubscription(
    (state: PlayerData) => state.player.stamp,
    (playhead) => {
      playheadSpring.jump(zoomScale.current(playhead));
      storedPlayhead.current = playhead;
    },
    shallow,
  );

  usePlayerSubscription(
    (state: PlayerData) => state.player.viewport,
    (viewport) => {
      zoomScale.current.domain(ignoreZoom ? [0, 1] : viewport);
      const playhead = storedPlayhead.current;
      playheadSpring.jump(zoomScale.current(playhead));
    },
    shallow,
  );

  return playheadSpring;
}
