import { Size, TimeInput, Variant } from "@semio/ui";
import { type ReactNode, memo } from "react";
import { useShallow } from "zustand/react/shallow";
// import { numberToDurationString } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import type { AnimationData, AnimationActions } from "./store-types";

export enum TimeDisplayType {
  Current = "current",
  Duration = "duration",
  Forward = "forward",
  Backward = "Backward",
  BoundsStart = "bounds-start",
  BoundsEnd = "bounds-end",
}

export interface TimeDisplayProps {
  type?: TimeDisplayType;
}

export function InnerTimeDisplay({
  type = TimeDisplayType.Current,
}: TimeDisplayProps): ReactNode {
  const timeDisplay = useAnimationStore(
    useShallow((state) => state.timeDisplay),
  );

  const duration = useAnimationStore(useShallow((state) => state.duration));
  const bounds = useAnimationStore(useShallow((state) => state.player.bounds));

  const framerate = useAnimationStore(useShallow((state) => state.framerate));

  const time: number | undefined = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => {
      if (type === TimeDisplayType.Current) {
        return state.player.stamp * state.duration;
      } else if (type === TimeDisplayType.Duration) {
        return state.duration;
      } else if (type === TimeDisplayType.BoundsStart) {
        return state.duration * state.player.bounds[0];
      } else if (type === TimeDisplayType.BoundsEnd) {
        return state.duration * state.player.bounds[1];
      } else if (type === TimeDisplayType.Backward) {
        const prev = state.prevKeyframeTime();
        if (prev !== undefined) {
          return prev * state.duration;
        } else return undefined;
      } else if (type === TimeDisplayType.Forward) {
        const next = state.nextKeyframeTime();
        if (next !== undefined) {
          return next * state.duration;
        } else return undefined;
      }
      return 0;
    }),
  );

  const { resetPlayer, updateDuration, updatePlayerBounds } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      resetPlayer: state.resetPlayer,
      updateDuration: state.updateDuration,
      updatePlayerBounds: state.updatePlayerBounds,
    })),
  );

  const setTime = (t: number) => {
    console.log("setting time", t, type);
    if (type === TimeDisplayType.Current) {
      resetPlayer(t / duration);
    } else if (type === TimeDisplayType.Duration) {
      updateDuration(t);
    } else if (type === TimeDisplayType.BoundsStart) {
      const vals = [t / duration, bounds[1]].sort((a, b) => a - b);
      updatePlayerBounds(vals[0], vals[1]);
    } else if (type === TimeDisplayType.BoundsEnd) {
      const vals = [bounds[0], t / duration].sort((a, b) => a - b);
      updatePlayerBounds(vals[0], vals[1]);
    }
  };

  return (
    <TimeInput
      value={time}
      onChange={setTime}
      min={0}
      size={Size.Sm}
      max={duration}
      disabled={
        type === TimeDisplayType.Forward || type === TimeDisplayType.Backward
      }
      display={timeDisplay}
      framerate={framerate}
      variant={Variant.Default}
    />
  );
}

InnerTimeDisplay.displayName = "TimeDisplay";

export const TimeDisplay = memo(InnerTimeDisplay);
