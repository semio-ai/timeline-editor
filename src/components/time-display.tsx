import { Size, TimeDisplay as TimeDisplayMethod, TimeInput, Variant } from "@semio/ui";
import { type ReactNode, memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { pick } from "lodash";
import { PlayerActions, usePlayerStore } from "@semio/utils";
import { useAnimationStore } from "../hooks";
import type { AnimationActions } from "../store-types";
import { AnimationInstance, SemanticTime } from "../types";
import { computeNextTime, computePreviousTime } from "../functions";

export interface TimeDisplayProps {
  animationId: string;
  trackIds: string[];
  namespaceIds: string[];
  semanticTime?: SemanticTime;
  displayMethod?: TimeDisplayMethod;
  valueOverride?: number;
}

export function InnerTimeDisplay({
  animationId,
  trackIds,
  namespaceIds,
  semanticTime = SemanticTime.Current,
  displayMethod,
  valueOverride,
}: TimeDisplayProps): ReactNode {
  const timeDisplay = useAnimationStore(useShallow((state) => displayMethod || state.timeDisplay));
  const updateDuration = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateDuration),
  );

  const duration = useAnimationStore(useShallow((state) => state.animations[animationId].duration));

  const tracks = useAnimationStore(useShallow((state) => pick(state.tracks, trackIds)));
  const instances = useAnimationStore(
    useShallow((state) => {
      const instanceInfo: Record<string, AnimationInstance> = {};
      Object.entries(state.namespaceInfo).forEach(([n, i]) => {
        if (namespaceIds.includes(n)) {
          Object.assign(instanceInfo, i);
        }
      });
      return instanceInfo;
      // pick(state.animations[animationId].instances, namespaceIds)),
    }),
  );

  const bounds = usePlayerStore(useShallow((state) => state.player.bounds));

  const framerate = useAnimationStore(useShallow((state) => state.framerate));

  const stamp = usePlayerStore(useShallow((state) => state.player.stamp));

  const prevKeyframeTime = useMemo(() => {
    return computePreviousTime(tracks, instances, stamp, bounds, true);
  }, [stamp, bounds, tracks, instances]);

  const nextKeyframeTime = useMemo(() => {
    return computeNextTime(tracks, instances, stamp, bounds, true);
  }, [stamp, bounds, tracks, instances]);

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
          value={bounds[0] * duration}
          onChange={(v) => {
            const vals = [v / duration, bounds[1]].sort((a, b) => a - b);
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
          value={bounds[1] * duration}
          onChange={(v) => {
            const vals = [bounds[0], v / duration].sort((a, b) => a - b);
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
          value={valueOverride !== undefined ? valueOverride * duration : prevKeyframeTime}
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
          value={valueOverride !== undefined ? valueOverride * duration : nextKeyframeTime}
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
            updateDuration(v, animationId);
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
          value={stamp * duration}
          onChange={(v) => resetPlayer(v / duration)}
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

  // return (
  //   <>
  //     {/* Current Time Display */}
  //     <TimeInput
  //       value={stamp * duration}
  //       onChange={(v) => resetPlayer(v / duration)}
  //       label="Current Time"
  //       min={0}
  //       size={Size.Sm}
  //       max={duration}
  //       display={timeDisplay}
  //       framerate={framerate}
  //       variant={Variant.Default}
  //       className={semanticTime !== SemanticTime.Current ? "hidden" : ""}
  //     />
  //     {/* Bounds Start Display */}
  //     <TimeInput
  //       value={bounds[0] * duration}
  //       onChange={(v) => {
  //         const vals = [v / duration, bounds[1]].sort((a, b) => a - b);
  //         updatePlayerBounds(vals[0], vals[1]);
  //       }}
  //       label="Bounds Start"
  //       min={0}
  //       size={Size.Sm}
  //       max={duration}
  //       display={timeDisplay}
  //       framerate={framerate}
  //       variant={Variant.Success}
  //       className={semanticTime !== SemanticTime.BoundsStart ? "hidden" : ""}
  //     />
  //     {/* Bounds End Display */}
  //     <TimeInput
  //       value={bounds[1] * duration}
  //       onChange={(v) => {
  //         const vals = [bounds[0], v / duration].sort((a, b) => a - b);
  //         updatePlayerBounds(vals[0], vals[1]);
  //       }}
  //       label="Bounds End"
  //       min={0}
  //       size={Size.Sm}
  //       max={duration}
  //       display={timeDisplay}
  //       framerate={framerate}
  //       variant={Variant.Error}
  //       className={semanticTime !== SemanticTime.BoundsEnd ? "hidden" : ""}
  //     />
  //     {/* Prev Keyframe Display */}
  //     <TimeInput
  //       value={valueOverride !== undefined ? valueOverride * duration : prevKeyframeTime}
  //       onChange={() => {}}
  //       label="Previous Keyed Frame"
  //       min={0}
  //       disabled
  //       size={Size.Sm}
  //       max={duration}
  //       display={timeDisplay}
  //       framerate={framerate}
  //       variant={Variant.Primary}
  //       className={semanticTime !== SemanticTime.Backward ? "hidden" : ""}
  //     />
  //     {/* Next Keyframe Display */}
  //     <TimeInput
  //       value={valueOverride !== undefined ? valueOverride * duration : nextKeyframeTime}
  //       onChange={() => {}}
  //       label="Next Keyed Frame"
  //       min={0}
  //       disabled
  //       size={Size.Sm}
  //       max={duration}
  //       display={timeDisplay}
  //       framerate={framerate}
  //       variant={Variant.Primary}
  //       className={semanticTime !== SemanticTime.Forward ? "hidden" : ""}
  //     />
  //     {/* Duration Display */}
  //     <TimeInput
  //       value={duration}
  //       onChange={(v) => {
  //         updateDuration(v, animationId);
  //       }}
  //       label="Duration"
  //       min={0}
  //       disabled
  //       size={Size.Sm}
  //       max={duration * 2}
  //       display={timeDisplay}
  //       framerate={framerate}
  //       variant={Variant.Default}
  //       className={semanticTime !== SemanticTime.Duration ? "hidden" : ""}
  //     />
  //   </>
  // );
}

InnerTimeDisplay.displayName = "TimeDisplay";

export const TimeDisplay = memo(InnerTimeDisplay);
