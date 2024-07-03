/* eslint-disable @typescript-eslint/no-unsafe-return -- Fixme*/
import { TimeInput, Variant } from "@semio/ui";
import { type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
// import { numberToDurationString } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import type { AnimationData, AnimationActions } from "./store-types";

export enum TimeDisplayType {
  Current = "current",
  Duration = "duration",
  WindowStart = "window-start",
  WindowEnd = "window-end",
}

export interface TimeDisplayProps {
  type?: TimeDisplayType;
}

export function TimeDisplay({
  type = TimeDisplayType.Current,
}: TimeDisplayProps): ReactNode {
  const timeDisplay = useAnimationStore(
    useShallow((state) => state.timeDisplay),
  );

  const duration = useAnimationStore(useShallow((state) => state.duration));

  const framerate = useAnimationStore(useShallow((state) => state.framerate));

  const time: number = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (type === TimeDisplayType.Current) {
        return state.player.stamp * state.duration;
      } else if (type === TimeDisplayType.Duration) {
        return state.duration;
      } else if (type === TimeDisplayType.WindowStart) {
        return state.duration * state.player.bounds[0];
      } else if (type === TimeDisplayType.WindowEnd) {
        return state.duration * state.player.bounds[1];
      }
      return 0;
    }),
  );

  const setTime = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => {
      if (type === TimeDisplayType.Current) {
        return (t: number): void => state.resetPlayer(t / state.duration);
      } else if (type === TimeDisplayType.Duration) {
        return (t: number): void => state.updateDuration(t);
      } else if (type === TimeDisplayType.WindowStart) {
        return (t: number): void => {
          const vals = [t / state.duration, state.player.bounds[1]].sort();
          state.updatePlayerBounds(vals[0], vals[1]);
        };
      } else if (type === TimeDisplayType.WindowEnd) {
        return (t: number): void => {
          const vals = [state.player.bounds[0], t / state.duration].sort();
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
      disabled={!setTime}
      display={timeDisplay}
      framerate={framerate}
      variant={Variant.DEFAULT}
    />
  );
}
