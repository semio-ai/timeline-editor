import { Size, TimeDisplay as TimeDisplayMethod, TimeInput, Variant } from "@semio/ui";
import { type ReactNode, memo } from "react";
import { useShallow } from "zustand/react/shallow";
// import { numberToDurationString } from "@semio/utils";
import { useAnimationStore } from "../hooks";
import type { AnimationData, AnimationActions } from "../store-types";
import { SemanticTime } from "../store-types";

export interface TimeDisplayProps {
  semanticTime?: SemanticTime;
  displayMethod?: TimeDisplayMethod;
  valueOverride?: number;
}

export function InnerTimeDisplay({
  semanticTime = SemanticTime.Current,
  displayMethod,
  valueOverride,
}: TimeDisplayProps): ReactNode {
  const timeDisplay = useAnimationStore(useShallow((state) => displayMethod || state.timeDisplay));
  const activeAnimation = useAnimationStore(useShallow((state) => state.activeAnimation));
  const duration = useAnimationStore(
    useShallow((state) => state.animations[state.activeAnimation].duration),
  );
  const bounds = useAnimationStore(useShallow((state) => state.player.bounds));

  const framerate = useAnimationStore(useShallow((state) => state.framerate));

  const prevKeyframeTime = useAnimationStore(
    useShallow((state) => {
      const prev = state.prevKeyframeTime(state);
      if (prev !== undefined) {
        return prev * duration;
      } else return undefined;
    }),
  );

  const nextKeyframeTime = useAnimationStore(
    useShallow((state) => {
      const next = state.nextKeyframeTime(state);
      if (next !== undefined) {
        return next * duration;
      } else return undefined;
    }),
  );

  const currentTime = useAnimationStore(useShallow((state) => state.player.stamp * duration));

  const { resetPlayer, updateDuration, updatePlayerBounds } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      resetPlayer: state.resetPlayer,
      updateDuration: state.updateDuration,
      updatePlayerBounds: state.updatePlayerBounds,
    })),
  );

  return (
    <>
      {/* Current Time Display */}
      <TimeInput
        value={currentTime}
        onChange={(v) => resetPlayer(v / duration)}
        label="Current Time"
        min={0}
        size={Size.Xs}
        max={duration}
        display={timeDisplay}
        framerate={framerate}
        variant={Variant.Default}
        hidden={semanticTime !== SemanticTime.Current}
      />
      {/* Bounds Start Display */}
      <TimeInput
        value={bounds[0] * duration}
        onChange={(v) => {
          const vals = [v / duration, bounds[1]].sort((a, b) => a - b);
          updatePlayerBounds(vals[0], vals[1]);
        }}
        label="Bounds Start"
        min={0}
        size={Size.Xs}
        max={duration}
        display={timeDisplay}
        framerate={framerate}
        variant={Variant.Success}
        hidden={semanticTime !== SemanticTime.BoundsStart}
      />
      {/* Bounds End Display */}
      <TimeInput
        value={bounds[1] * duration}
        onChange={(v) => {
          const vals = [bounds[0], v / duration].sort((a, b) => a - b);
          updatePlayerBounds(vals[0], vals[1]);
        }}
        label="Bounds End"
        min={0}
        size={Size.Xs}
        max={duration}
        display={timeDisplay}
        framerate={framerate}
        variant={Variant.Error}
        hidden={semanticTime !== SemanticTime.BoundsEnd}
      />
      {/* Prev Keyframe Display */}
      <TimeInput
        value={valueOverride !== undefined ? valueOverride * duration : prevKeyframeTime}
        onChange={() => {}}
        label="Previous Keyed Frame"
        min={0}
        disabled
        size={Size.Xs}
        max={duration}
        display={timeDisplay}
        framerate={framerate}
        variant={Variant.Primary}
        hidden={semanticTime !== SemanticTime.Backward}
      />
      {/* Next Keyframe Display */}
      <TimeInput
        value={valueOverride !== undefined ? valueOverride * duration : nextKeyframeTime}
        onChange={() => {}}
        label="Next Keyed Frame"
        min={0}
        disabled
        size={Size.Xs}
        max={duration}
        display={timeDisplay}
        framerate={framerate}
        variant={Variant.Primary}
        hidden={semanticTime !== SemanticTime.Forward}
      />
      {/* Duration Display */}
      <TimeInput
        value={duration}
        onChange={(v) => {
          updateDuration(v, activeAnimation);
        }}
        label="Duration"
        min={0}
        disabled
        size={Size.Xs}
        max={duration * 2}
        display={timeDisplay}
        framerate={framerate}
        variant={Variant.Default}
        hidden={semanticTime !== SemanticTime.Duration}
      />
    </>
  );
}

InnerTimeDisplay.displayName = "TimeDisplay";

export const TimeDisplay = memo(InnerTimeDisplay);
