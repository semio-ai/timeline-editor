import { useRef, useCallback } from "react";
import { MotionValue, useMotionValue } from "motion/react";
import { PlayerData, usePlayerStore } from "@semio/utils";
import { shallow, useShallow } from "zustand/shallow";
import { scaleLinear } from "@visx/scale";
import { type ScaleLinear } from "../scale-linear";
import { usePlayerSubscription } from "./use-player-subscription";
import { useTrackContext } from "./use-track-context";

/**
 * A hook used to retrieve spring values representing the dimensions of the playback region.
 * @param ignoreZoom - A boolean that determines whether the zoom scale should be ignored.
 * @returns An object containing the left, right, and width springs.
 */
export function useBoundSprings(ignoreZoom?: boolean): {
  leftSpring: MotionValue<number>;
  rightSpring: MotionValue<number>;
  widthSpring: MotionValue<number>;
} {
  const { xScale } = useTrackContext();

  const playerDuration = usePlayerStore(useShallow((state) => state.player.duration));

  const zoomScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );
  const zoomBaseZeroScale = useRef<ScaleLinear>(
    scaleLinear({
      domain: [0, 1],
      range: [0, 1],
    }),
  );

  const leftSpring = useMotionValue<number>(zoomScale.current(0));
  const rightSpring = useMotionValue<number>(zoomScale.current(1));
  const widthSpring = useMotionValue<number>(zoomBaseZeroScale.current(1));

  usePlayerSubscription(
    (state: PlayerData) => state.player.bounds,
    (bounds) => {
      leftSpring.jump(zoomScale.current(bounds[0]));
      rightSpring.jump(zoomScale.current(bounds[1]));
      widthSpring.jump(zoomBaseZeroScale.current(Math.max(0, bounds[1] - bounds[0])));
    },
    shallow,
  );

  const onViewportChange = useCallback(
    ({ viewport, bounds }: { viewport: [number, number]; bounds: [number, number] }) => {
      if (ignoreZoom) {
        leftSpring.jump(xScale(playerDuration * bounds[0]));
        rightSpring.jump(xScale(playerDuration * bounds[1]));
        widthSpring.jump(
          Math.max(0, xScale(playerDuration * bounds[1]) - xScale(playerDuration * bounds[0])),
        );
      } else {
        zoomScale.current = zoomScale.current?.domain(viewport)?.range([0, 1]);
        leftSpring.jump(xScale(playerDuration * zoomScale.current(bounds[0])));
        rightSpring.jump(xScale(playerDuration * zoomScale.current(bounds[1])));
        widthSpring.jump(
          Math.max(
            0,
            xScale(playerDuration * zoomScale.current(bounds[1])) -
              xScale(playerDuration * zoomScale.current(bounds[0])),
          ),
        );
      }
    },
    [leftSpring, rightSpring, widthSpring, ignoreZoom, playerDuration, xScale],
  );

  usePlayerSubscription(
    (state: PlayerData) => ({ viewport: state.player.viewport, bounds: state.player.bounds }),
    onViewportChange,
    (current, previous) => shallow(current.viewport, previous.viewport),
  );

  return { leftSpring, rightSpring, widthSpring };
}
