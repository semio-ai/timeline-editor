/* eslint-disable @typescript-eslint/no-unsafe-return -- Fixme*/
import { TimeInput, Variant } from "@semio/ui";
import { type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
// import { numberToDurationString } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import type { AnimationData, AnimationActions } from "./store-types";

export enum TimeDisplayType {
  CURRENT = "current",
  DURATION = "duration",
  FORWARD = "forward",
  BACKWARD = "backward",
  BOUNDS_START = "bounds-start",
  BOUNDS_END = "bounds-end",
}

export interface TimeDisplayProps {
  type?: TimeDisplayType;
}

export function TimeDisplay({
  type = TimeDisplayType.CURRENT,
}: TimeDisplayProps): ReactNode {
  const timeDisplay = useAnimationStore(
    useShallow((state) => state.timeDisplay),
  );

  const duration = useAnimationStore(useShallow((state) => state.duration));

  const framerate = useAnimationStore(useShallow((state) => state.framerate));

  const time: number | undefined = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => {
      if (type === TimeDisplayType.CURRENT) {
        return state.player.stamp * state.duration;
      } else if (type === TimeDisplayType.DURATION) {
        return state.duration;
      } else if (type === TimeDisplayType.BOUNDS_START) {
        return state.duration * state.player.bounds[0];
      } else if (type === TimeDisplayType.BOUNDS_END) {
        return state.duration * state.player.bounds[1];
      } else if (type === TimeDisplayType.BACKWARD) {
        const prev = state.prevKeyframeTime();
        if (prev !== undefined) {
          return prev * state.duration;
        } else return undefined;
      } else if (type === TimeDisplayType.FORWARD) {
        const next = state.nextKeyframeTime();
        if (next !== undefined) {
          return next * state.duration;
        } else return undefined;
      }
      return 0;
    }),
  );

  const setTime = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => {
      if (type === TimeDisplayType.CURRENT) {
        return (t: number): void => state.resetPlayer(t / state.duration);
      } else if (type === TimeDisplayType.DURATION) {
        return (t: number): void => state.updateDuration(t);
      } else if (type === TimeDisplayType.BOUNDS_START) {
        return (t: number): void => {
          const vals = [t / state.duration, state.player.bounds[1]].sort(
            (a, b) => a - b,
          );
          state.updatePlayerBounds(vals[0], vals[1]);
        };
      } else if (type === TimeDisplayType.BOUNDS_END) {
        return (t: number): void => {
          const vals = [state.player.bounds[0], t / state.duration].sort(
            (a, b) => a - b,
          );
          state.updatePlayerBounds(vals[0], vals[1]);
        };
      }
    }),
  );

  return (
    <TimeInput
      value={time}
      onChange={setTime ? setTime : () => {}}
      min={0}
      size="sm"
      max={duration}
      disabled={
        !setTime ||
        type === TimeDisplayType.FORWARD ||
        type === TimeDisplayType.BACKWARD
      }
      display={timeDisplay}
      framerate={framerate}
      variant={Variant.DEFAULT}
    />
  );
}
