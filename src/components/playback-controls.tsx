import type { ReactNode } from "react";
import { useEffect } from "react";
import { IconButton, IconPlayerPlay2, Select, Size, Variant } from "@semio/ui";
import { IconPlayerPauseFilled, IconWorld } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { useAnimationStore } from "../hooks";
import { AnimationActions, AnimationData, SemanticTime } from "../store-types";
import { TimeDisplay } from "./time-display";
import { SkipButton } from "./skip-button";
import { TrackControl } from "./track-control";

export function PlaybackControls({
  animationId,
  track,
  onChangeTrack,
}: {
  animationId: string;
  track: string;
  onChangeTrack: (track: string) => void;
}): ReactNode {
  const previews = useAnimationStore(useShallow((state: AnimationData) => state.previews));
  const nonHoverPreviews = previews.filter((p) => p.semanticTime !== SemanticTime.Hover);

  const { playPlayer, pausePlayer, running } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      playPlayer: state.playPlayer,
      pausePlayer: state.pausePlayer,
      running: state.player.running,
    })),
  );

  const selectedFrame = useAnimationStore(
    useShallow((state: AnimationData) => state.selectedKeyframe),
  );

  const pointId: string | undefined = useAnimationStore(
    useShallow((state) => {
      if (state.selectedKeyframe) {
        const frame = state.animations[animationId].frames.get(state.selectedKeyframe);
        if (frame && track !== "all") {
          return frame.points.find(
            (p) => state.animations[animationId].points.get(p)?.track === track,
          );
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }),
  );

  const tracks: { label: string; value: string }[] = useAnimationStore(
    useShallow((state: AnimationData) =>
      Array.from(state.animations[animationId].tracks.keys()).map((id) => ({
        label: state.animations[animationId].tracks.get(id)?.name || "Unknown Track",
        value: id,
      })),
    ),
  );

  useEffect(() => {
    onChangeTrack("all");
  }, [animationId, onChangeTrack]);

  const [removeKeypoint, removeKeyframe, createKeypoint, createKeyframe] = useAnimationStore(
    useShallow((state: AnimationActions) => [
      state.removeKeypoint,
      state.removeKeyframe,
      state.createKeypoint,
      state.createKeyframe,
    ]),
  );

  let filled = false;
  if (pointId) {
    filled = true;
  } else if (track === "all" && selectedFrame) {
    filled = true;
  }

  return (
    <div className="h-[60px] dark:bg-neutral-800 bg-neutral-200">
      <div className="flex flex-1 flex-row items-center h-[30px] ">
        <TrackControl
          trackIds={track === "all" ? [] : [track]}
          filled={filled}
          color="#737373"
          onHexClick={() => {
            if (pointId) {
              console.log("remove keypoint");
              removeKeypoint(pointId, animationId);
            } else if (selectedFrame && track === "all") {
              console.log("remove keyframe");
              removeKeyframe(selectedFrame, animationId);
            } else if (track !== "all") {
              console.log("create keypoint");
              createKeypoint(track, { track }, animationId);
            } else {
              console.log("create keyframe");
              createKeyframe({}, animationId, true);
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
              },
              ...tracks,
            ]}
            value={track}
            onChange={(value: string) => {
              onChangeTrack(value);
            }}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-row h-[30px] items-center">
        <div className="h-[30px] flex flex-row gap-0 px-0 py-1 items-center justify-center w-[44px]">
          <SkipButton semanticTime={SemanticTime.BoundsStart} />
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
          <SkipButton semanticTime={SemanticTime.BoundsEnd} />
        </div>
        <div className="flex flex-1 flex-row items-center px-1">
          <TimeDisplay
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
