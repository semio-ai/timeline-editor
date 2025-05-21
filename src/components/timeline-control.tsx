import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Select, Size, Variant } from "@semio/ui";
import { getLookup, RawValue } from "@semio/utils";
import { IconWorld } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { pick } from "lodash";
import { useAnimationStore, usePlayerSubscription } from "../hooks";
import { computeLocalStamp, computeWorldStamp } from "../functions";
import { AnimationInterpolator, Track, AnimationInstanceSettings } from "../types";
import { AnimationActions, AnimationData } from "../store-types";
import { TrackControl } from "./track-control";

export function TimelineControl({
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
  const { updateKeypoints, removeKeypoints } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      updateKeypoints: state.updateKeypoints,
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

  const stateTracks = useAnimationStore(useShallow((state) => state.tracks));

  const tracks = useMemo(
    () =>
      allTracks.map((id) => {
        return {
          label: stateTracks[id]?.name || "Unknown Track",
          value: id,
          animatableId: stateTracks[id].animatableId,
          color: stateTracks[id]?.settings?.color || "#737373",
        };
      }),
    [allTracks, stateTracks],
  );

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
    <div className="flex flex-1 flex-row items-center h-9 gap-1 pl-1">
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
                return {
                  trackId,
                  keypoint: {
                    value,
                    stamp: localStamp.current,
                  },
                };
              })
              .filter((u) => u.keypoint.value !== undefined);

            updateKeypoints(updates);
          }
        }}
      />
      <div className="w-full items-center">
        <Select
          label="Select Track"
          variant={Variant.Default}
          size={Size.Sm}
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
  );
}
