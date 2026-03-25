import { Size, TimeDisplay as TimeDisplayMethod, TimeInput, Variant } from "@semio/ui";
import { type ReactNode, memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { PlayerActions, usePlayerStore } from "@semio/utils";
import { useAnimationStore } from "../hooks";
import type { AnimationActions } from "../store-types";
import { SemanticTime } from "../types";
import { computeNextTime, computePreviousTime } from "../functions";

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
  const updateDuration = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateDuration),
  );
  const computedData = useAnimationStore(
    useShallow((state) => state.derivedSnapshot?.rows?.global?.computed),
  );

  const framerate = useAnimationStore(useShallow((state) => state.framerate));

  const bounds = usePlayerStore(useShallow((state) => state.player.bounds));
  const [stamp, duration] = usePlayerStore(
    useShallow((state) => [state.player.stamp, state.player.duration]),
  );

  const prevKeyframeTime = useMemo(() => {
    if (!computedData) return 0;
    return computePreviousTime(computedData.virtualFrames, stamp, bounds, true);
  }, [stamp, bounds, computedData]);

  const nextKeyframeTime = useMemo(() => {
    if (!computedData) return duration;
    return computeNextTime(computedData.virtualFrames, stamp, bounds, true);
  }, [stamp, bounds, computedData, duration]);

  const { resetPlayer, updatePlayerBounds } = usePlayerStore(
    useShallow((state: PlayerActions) => ({
      resetPlayer: state.resetPlayer,
      updatePlayerBounds: state.updatePlayerBounds,
    })),
  );

  switch (semanticTime) {
    case SemanticTime.BoundsStart:
      return (
        <TimeInput
          value={bounds[0]}
          onChange={(v) => {
            const vals = [v, bounds[1]].sort((a, b) => a - b);
            updatePlayerBounds(vals[0], vals[1]);
          }}
          label="Bounds Start"
          min={0}
          size={Size.Sm}
          max={duration}
          display={timeDisplay}
          framerate={framerate}
          variant={Variant.Success}
        />
      );
    case SemanticTime.BoundsEnd:
      return (
        <TimeInput
          value={bounds[1]}
          onChange={(v) => {
            const vals = [bounds[0], v].sort((a, b) => a - b);
            updatePlayerBounds(vals[0], vals[1]);
          }}
          label="Bounds End"
          min={0}
          size={Size.Sm}
          max={duration}
          display={timeDisplay}
          framerate={framerate}
          variant={Variant.Error}
        />
      );
    case SemanticTime.Backward:
      return (
        <TimeInput
          value={valueOverride !== undefined ? valueOverride : prevKeyframeTime}
          onChange={() => {}}
          label="Previous Keyed Frame"
          min={0}
          disabled
          size={Size.Sm}
          max={duration}
          display={timeDisplay}
          framerate={framerate}
          variant={Variant.Primary}
        />
      );
    case SemanticTime.Forward:
      return (
        <TimeInput
          value={valueOverride !== undefined ? valueOverride : nextKeyframeTime}
          onChange={() => {}}
          label="Next Keyed Frame"
          min={0}
          disabled
          size={Size.Sm}
          max={duration}
          display={timeDisplay}
          framerate={framerate}
          variant={Variant.Primary}
        />
      );
    case SemanticTime.Duration:
      return (
        <TimeInput
          value={duration}
          onChange={(v) => {
            updateDuration(v);
          }}
          label="Duration"
          min={0}
          disabled
          size={Size.Sm}
          max={duration * 2}
          display={timeDisplay}
          framerate={framerate}
          variant={Variant.Default}
        />
      );
    case SemanticTime.Current:
    default:
      return (
        <TimeInput
          value={stamp}
          onChange={(v) => resetPlayer(v)}
          label="Current Time"
          min={0}
          size={Size.Sm}
          max={duration}
          display={timeDisplay}
          framerate={framerate}
          variant={Variant.Default}
        />
      );
  }
}

InnerTimeDisplay.displayName = "TimeDisplay";

export const TimeDisplay = memo(InnerTimeDisplay);
