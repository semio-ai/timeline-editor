import type { ReactNode } from "react";
import { useEffect } from "react";
// import { useMediaQuery } from "@semio/utils";
import { IconButton, IconPlayerPlay2, Select, Size, Variant } from "@semio/ui";
import { IconPlayerPauseFilled, IconWorld } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { useAnimationStore } from "./hooks/use-animation-store";
import { TimeDisplay } from "./time-display";
import { SkipButton } from "./skip-button";
import { AnimationActions, AnimationData, SemanticTime } from "./store-types";
import { TrackControl } from "./track-control";

export function PlaybackControls({
  track,
  onChangeTrack,
}: {
  track: string;
  onChangeTrack: (track: string) => void;
}): ReactNode {
  const previews = useAnimationStore(
    useShallow((state: AnimationData) => state.previews),
  );
  const nonHoverPreviews = previews.filter(
    (p) => p.semanticTime !== SemanticTime.Hover,
  );

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
        const frame = state.animations[state.activeAnimation].frames.get(
          state.selectedKeyframe,
        );
        if (frame && track !== "all") {
          return frame.points.find(
            (p) =>
              state.animations[state.activeAnimation].points.get(p)?.track ===
              track,
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
      state.animations[state.activeAnimation].trackOrder.map((id) => ({
        label:
          state.animations[state.activeAnimation].tracks.get(id)?.name ||
          "Unknown Track",
        value: id,
      })),
    ),
  );

  const activeAnimation = useAnimationStore(
    useShallow((state: AnimationData) => state.activeAnimation),
  );

  useEffect(() => {
    onChangeTrack("all");
  }, [activeAnimation, onChangeTrack]);

  const [removeKeypoint, removeKeyframe, createKeypoint, createKeyframe] =
    useAnimationStore(
      useShallow((state: AnimationActions) => [
        state.removeKeypoint,
        state.removeKeyframe,
        state.createKeypoint,
        state.createKeyframe,
      ]),
    );

  // const smallScreen = useMediaQuery("(max-width: 768px)");
  // const xsmallScreen = useMediaQuery("(max-width: 640px)");
  //
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
              removeKeypoint(pointId);
            } else if (selectedFrame && track === "all") {
              removeKeyframe(selectedFrame, activeAnimation);
            } else if (track !== "all") {
              createKeypoint(track, {});
            } else {
              createKeyframe({});
            }
          }}
        />
        <div className="block w-full items-center px-1">
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
            {/* <IconPlayPause
              size="16px"
              center={running ? "pause" : "play"}
              fillOpacity={playerHovered ? 0.5 : 0}
            /> */}
            {running ? (
              <IconPlayerPauseFilled size="16px" />
            ) : (
              <IconPlayerPlay2 size="16px" />
            )}
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

  // return (
  //   <div className="justify-between items-center p-1 flex">
  //     <div className="flex justify-center items-center gap-2">
  //       <SkipButton direction={SkipDirection.BoundsStart} />
  //       {!xsmallScreen && <TimeDisplay type={TimeDisplayType.BoundsStart} />}
  //     </div>
  //     <div className="flex justify-center items-center gap-2">
  //       {!smallScreen && <TimeDisplay type={TimeDisplayType.Forward} />}
  //       <SkipButton direction={SkipDirection.Backward} />

  //       <div
  //         className={clsx(
  //           "flex transition-all justify-center items-center h-9 gap-2",
  //           // running ? "w-10" : "w-40",
  //         )}
  //       >
  //         <IconButton
  //           onClick={() => {
  //             if (running) {
  //               pausePlayer();
  //             } else {
  //               playPlayer(-1);
  //             }
  //           }}
  //         >
  //           {running ? (
  //             <IconPlayerPauseFilled />
  //           ) : (
  //             <IconPlayerPlay
  //               className="transform rotate-180"
  //               // style={{ transform: "rotate(180deg)" }}
  //             />
  //           )}
  //         </IconButton>
  //         <div className="items-center p-2">
  //           <TimeDisplay type={TimeDisplayType.Current} />
  //         </div>
  //         <IconButton
  //           onClick={() => {
  //             if (running) {
  //               pausePlayer();
  //             } else {
  //               playPlayer(1);
  //             }
  //           }}
  //         >
  //           {running ? <IconPlayerPauseFilled /> : <IconPlayerPlay />}
  //         </IconButton>
  //       </div>
  //       <SkipButton direction={SkipDirection.Forward} />
  //       {!smallScreen && <TimeDisplay type={TimeDisplayType.Forward} />}
  //     </div>
  //     <div className="flex justify-center items-center gap-2">
  //       {!xsmallScreen && <TimeDisplay type={TimeDisplayType.BoundsEnd} />}
  //       <SkipButton direction={SkipDirection.BoundsEnd} />
  //     </div>
  //   </div>
  // );
}
