import { type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { ParentSize } from "@visx/responsive";
import { Track } from "./track";
import { TrackControl } from "./track-control";
import type { AnimationActions, AnimationData } from "./store-types";
import { useAnimationStore } from "./hooks/use-animation-store";

export function TrackRow({
  trackIds,
  isTop,
  isBottom,
}: {
  trackIds?: string[];
  isTop?: boolean;
  isBottom?: boolean;
}): ReactNode {
  const tracks = useAnimationStore((state) =>
    (trackIds ?? [])
      .map((t) => state.animations[state.activeAnimation].tracks.get(t))
      .filter((t) => t !== undefined),
  );

  const [removeKeypoint, removeKeyframe, createKeypoint, createKeyframe] =
    useAnimationStore(
      useShallow((state: AnimationActions) => [
        state.removeKeypoint,
        state.removeKeyframe,
        state.createKeypoint,
        state.createKeyframe,
      ]),
    );

  const track: string = trackIds?.[0] ?? "all";
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
  // const smallScreen = useMediaQuery("(max-width: 768px)");
  // const xsmallScreen = useMediaQuery("(max-width: 640px)");
  //

  const selectedFrame = useAnimationStore(
    useShallow((state: AnimationData) => state.selectedKeyframe),
  );
  const activeAnimation = useAnimationStore(
    useShallow((state: AnimationData) => state.activeAnimation),
  );

  let filled = false;
  if (pointId) {
    filled = true;
  } else if (track === "all" && selectedFrame) {
    filled = true;
  }

  return (
    <div className="flex flex-row items-center">
      <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] flex flex-row">
        <TrackControl
          trackIds={track === "all" ? [] : [track]}
          filled={filled}
          color="#737373"
          onHexClick={() => {
            if (pointId) {
              console.log("remove keypoint");
              removeKeypoint(pointId);
            } else if (selectedFrame && track === "all") {
              console.log("remove keyframe");
              removeKeyframe(selectedFrame);
            } else if (track !== "all") {
              console.log("create keypoint");
              createKeypoint(track, { track });
            } else {
              console.log("create keyframe");
              createKeyframe({}, activeAnimation, true);
            }
          }}
        />
        -
        <div className="flex-1 text-black dark:text-white">
          {tracks.length === 0 && "No tracks"}
          {tracks.length === 1 && tracks[0].name}
          {tracks.length > 1 && "Multiple tracks"}
        </div>
      </div>
      <div className="cursor-pointer items-center flex-1">
        <ParentSize debounceTime={10}>
          {({ width }) => (
            <Track
              width={width}
              trackIds={trackIds}
              isTop={isTop}
              isBottom={isBottom}
              canZoom
            />
          )}
        </ParentSize>
      </div>
    </div>
  );
}
