import { useContext, useRef } from "react";
import { MotionValue, useMotionValue } from "motion/react";
import { PlayerData } from "@semio/utils";
import { scaleLinear } from "@visx/scale";
import { shallow } from "zustand/shallow";
import { AnimationContext } from "../context";
import { type ScaleLinear } from "../scale-linear";
import { usePlayerSubscription } from "./use-player-subscription";
import { useTrackContext } from "./use-track-context";

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

  const { xScale } = useTrackContext();

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const storedPlayhead = useRef<number>(0);

  const playheadSpring = useMotionValue<number>(0);

  usePlayerSubscription(
    (state: PlayerData) => ({ stamp: state.player.stamp, duration: state.player.duration }),
    ({ stamp, duration }) => {
      playheadSpring.jump(xScale(duration * zoomScale.current(stamp)));
      storedPlayhead.current = stamp;
    },
    shallow,
  );

  usePlayerSubscription(
    (state: PlayerData) => ({ viewport: state.player.viewport, duration: state.player.duration }),
    ({ viewport, duration }) => {
      zoomScale.current = zoomScale.current.domain(ignoreZoom ? [0, 1] : viewport);
      const playhead = storedPlayhead.current;
      playheadSpring.jump(xScale(duration * zoomScale.current(playhead)));
    },
    shallow,
  );

  return playheadSpring;
}
