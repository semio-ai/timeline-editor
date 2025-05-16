import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { clsx } from "clsx";
import { Button, IconPlayerPlay2 } from "@semio/ui";
import { RawValue, usePlayerStore } from "@semio/utils";
import { IconPlayerPauseFilled } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { pick } from "lodash";
import { useAnimationStore, usePlayerSubscription } from "../hooks";
import { computeLocalStamp, computeWorldStamp } from "../functions";
import { Track, SemanticTime, AnimationInstanceSettings } from "../types";
import { AnimationData } from "../store-types";
import { TimeDisplay } from "./time-display";
import { SkipButton } from "./skip-button";

export function TimeControls({
  animationId,
  allTracks,
  selection,
  onChangeSelection,
  instanceSettings,
  namespaceId,
}: {
  animationId: string;
  instanceSettings: AnimationInstanceSettings;
  allTracks: string[];
  selection: string[];
  onChangeSelection: (tracks: string[]) => void;
  namespaceId: string;
}): ReactNode {
  const previews = useAnimationStore(useShallow((state: AnimationData) => state.previews));
  const nonHoverPreviews = previews.filter((p) => p.semanticTime !== SemanticTime.Hover);
  const { playPlayer, pausePlayer, running } = usePlayerStore(
    useShallow((state) => ({
      playPlayer: state.playPlayer,
      pausePlayer: state.pausePlayer,
      running: state.player.running,
    })),
  );

  const trackData = useAnimationStore(
    useShallow((state) => pick(state.tracks, selection)),
  ) as Record<string, Track<RawValue>>;

  const stamps = useMemo(() => {
    const s: number[] = [];
    Object.values(trackData).forEach((track) => {
      track.points.forEach((point) => {
        s.push(computeWorldStamp(point.stamp, instanceSettings.offset, instanceSettings.timescale));
      });
    });
    return s;
  }, [trackData, instanceSettings]);

  // Use references to avoid rerendering
  const stamp = useRef<number>(0);
  const localStamp = useRef<number>(
    computeLocalStamp(0, instanceSettings.timescale, instanceSettings.offset),
  );
  const filled = useRef<boolean>(false);

  // This updates the references when the player's timestamp changes
  usePlayerSubscription(
    (state) => state.player.stamp,
    (current) => {
      stamp.current = current;
      filled.current = stamps.some((s) => s === current);
      localStamp.current = computeLocalStamp(
        current,
        instanceSettings.timescale,
        instanceSettings.offset,
      );
    },
    shallow,
  );

  useEffect(() => {
    onChangeSelection(allTracks);
  }, [animationId, allTracks, onChangeSelection]);

  return (
    <div className="flex flex-1 flex-row h-8 items-center gap-1 pl-1">
      <div
        className={clsx(
          "min-w-16 h-7 rounded-xs grid grid-cols-3 items-center justify-between",
          // "dark:bg-layout-dark-base bg-layout-light-base",
        )}
      >
        <SkipButton
          semanticTime={SemanticTime.BoundsStart}
          animationId={animationId}
          namespaceIds={[namespaceId]}
          trackIds={selection}
        />
        <Button
          size="fit"
          onClick={() => {
            if (running) {
              pausePlayer();
            } else {
              playPlayer(1);
            }
          }}
          // color="#737373"
          leftIcon={
            running ? <IconPlayerPauseFilled size="18px" /> : <IconPlayerPlay2 size="18px" />
          }
          invert
        />
        <SkipButton
          semanticTime={SemanticTime.BoundsEnd}
          animationId={animationId}
          namespaceIds={[namespaceId]}
          trackIds={selection}
        />
      </div>
      <div className="flex flex-1 flex-row items-center">
        <TimeDisplay
          animationId={animationId}
          trackIds={selection}
          namespaceIds={[namespaceId]}
          valueOverride={
            nonHoverPreviews.length === 1 &&
            [SemanticTime.Backward, SemanticTime.Forward].includes(nonHoverPreviews[0].semanticTime)
              ? nonHoverPreviews[0].stamp
              : undefined
          }
          semanticTime={
            nonHoverPreviews.length === 1 ? nonHoverPreviews[0].semanticTime : SemanticTime.Current
          }
        />
      </div>
    </div>
  );
}
