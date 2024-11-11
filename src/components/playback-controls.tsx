import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { IconButton, IconPlayerPlay2, Select, Size, Variant } from "@semio/ui";
import { getLookup, RawValue, usePlayerStore } from "@semio/utils";
import { IconPlayerPauseFilled, IconWorld } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { pick } from "lodash";
import { useAnimationStore, usePlayerSubscription } from "../hooks";
import { computeLocalStamp, computeStamps } from "../functions";
import { AnimationInterpolator, Track, SemanticTime } from "../types";
import { AnimationActions, AnimationData } from "../store-types";
import { TimeDisplay } from "./time-display";
import { SkipButton } from "./skip-button";
import { TrackControl } from "./track-control";

export function PlaybackControls({
  animationId,
  allTracks,
  selection,
  onChangeSelection,
  namespaceId,
}: {
  animationId: string;
  allTracks: string[];
  selection: string[];
  onChangeSelection: (tracks: string[]) => void;
  namespaceId: string;
}): ReactNode {
  const previews = useAnimationStore(useShallow((state: AnimationData) => state.previews));
  const nonHoverPreviews = previews.filter((p) => p.semanticTime !== SemanticTime.Hover);
  const instanceInfo = useAnimationStore(
    useShallow((state) => state.animations[animationId].instances[namespaceId]),
  );
  const { playPlayer, pausePlayer, running } = usePlayerStore(
    useShallow((state) => ({
      playPlayer: state.playPlayer,
      pausePlayer: state.pausePlayer,
      running: state.player.running,
    })),
  );
  const { setValues, removeKeypoints } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      setValues: state.setValues,
      removeKeypoints: state.removeKeypoints,
    })),
  );

  const trackData = useAnimationStore(
    useShallow((state) => pick(state.tracks, selection)),
  ) as Record<string, Track<RawValue>>;

  const interpolators = useAnimationStore(
    useShallow(
      (state) =>
        pick(
          state.trackInterpolators,
          selection.map((s) => getLookup(namespaceId, s)), //f2e2e33d-7c3c-4540-9bf0-e6fda5d41d49
        ) as AnimationInterpolator,
    ),
  );

  const controls = useAnimationStore(useShallow((state) => state.controls));
  const stateTracks = useAnimationStore(useShallow((state) => state.tracks));

  const tracks = useMemo(
    () =>
      allTracks.map((id) => {
        const control = Object.values(controls).find((c) => c.writeId === id);
        return {
          label: stateTracks[id]?.name || "Unknown Track",
          value: id,
          animatableId: control?.readId,
          color: control?.settings?.color || "#737373",
        };
      }),
    [allTracks, controls, stateTracks],
  );

  const stamps = useMemo(() => {
    return computeStamps(trackData, { [namespaceId]: instanceInfo });
  }, [trackData, instanceInfo, namespaceId]);

  // Use references to avoid rerendering
  const stamp = useRef<number>(0);
  const localStamp = useRef<number>(computeLocalStamp(0, instanceInfo));
  const filled = useRef<boolean>(false);

  // This updates the references when the player's timestamp changes
  usePlayerSubscription(
    (state) => state.player.stamp,
    (current) => {
      stamp.current = current;
      filled.current = stamps.some((s) => s === current);
      localStamp.current = computeLocalStamp(current, instanceInfo);
    },
    shallow,
  );

  useEffect(() => {
    onChangeSelection(allTracks);
  }, [animationId, allTracks, onChangeSelection]);

  return (
    <div className="h-[60px] dark:bg-neutral-800 bg-neutral-200">
      <div className="flex flex-1 flex-row items-center h-[30px] ">
        <TrackControl
          animationId={animationId}
          namespaceId={namespaceId}
          trackIds={selection}
          filled={filled.current}
          color="#737373"
          onHexClick={() => {
            if (filled.current) {
              const removals = selection
                .map((trackId) => {
                  const matchingKeypoint = trackData[trackId].points.find(
                    (point) => point.stamp === localStamp.current,
                  );
                  return { trackId, keypointId: matchingKeypoint?.id };
                })
                .filter((r) => r.keypointId !== undefined) as {
                trackId: string;
                keypointId: string;
              }[];
              removeKeypoints(removals);
            } else {
              const updates = selection
                .map((trackId) => {
                  const value = interpolators[trackId]?.(stamp.current);
                  const animatableId = tracks.find((t) => t.value === trackId)?.animatableId;
                  return {
                    trackId,
                    value,
                    stamp: localStamp.current,
                    animatableId,
                    namespace: namespaceId,
                  };
                })
                .filter((u) => u.value !== undefined && u.animatableId !== undefined) as {
                trackId: string;
                value: RawValue;
                stamp: number;
                animatableId: string;
                namespace: string;
              }[];

              setValues(updates);
            }
          }}
        />
        <div className="w-full items-center px-1">
          <Select
            variant={Variant.Default}
            size={Size.Xs}
            options={[
              {
                value: "all",
                label: "All Tracks",
                icon: <IconWorld size="13px" />,
                color: "#737373",
              },
              ...tracks,
            ]}
            value={selection === allTracks ? "all" : selection[0]}
            onChange={(value: string) => {
              if (value === "all") {
                onChangeSelection(allTracks);
              } else {
                onChangeSelection([value]);
              }
            }}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-row h-[30px] items-center">
        <div className="h-[30px] flex flex-row gap-0 px-0 py-1 items-center justify-center w-[44px]">
          <SkipButton
            semanticTime={SemanticTime.BoundsStart}
            animationId={animationId}
            namespaceIds={[namespaceId]}
            trackIds={selection}
          />
          <IconButton
            size="fit"
            onClick={() => {
              if (running) {
                pausePlayer();
              } else {
                playPlayer(1);
              }
            }}
            color="#737373"
          >
            {running ? <IconPlayerPauseFilled size="16px" /> : <IconPlayerPlay2 size="16px" />}
          </IconButton>
          <SkipButton
            semanticTime={SemanticTime.BoundsEnd}
            animationId={animationId}
            namespaceIds={[namespaceId]}
            trackIds={selection}
          />
        </div>
        <div className="flex flex-1 flex-row items-center px-1">
          <TimeDisplay
            animationId={animationId}
            trackIds={selection}
            namespaceIds={[namespaceId]}
            valueOverride={
              nonHoverPreviews.length === 1 &&
              [SemanticTime.Backward, SemanticTime.Forward].includes(
                nonHoverPreviews[0].semanticTime,
              )
                ? nonHoverPreviews[0].stamp
                : undefined
            }
            semanticTime={
              nonHoverPreviews.length === 1
                ? nonHoverPreviews[0].semanticTime
                : SemanticTime.Current
            }
          />
        </div>
      </div>
    </div>
  );
}
