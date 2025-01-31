import { ScrollArea } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import useMeasure from "react-use-measure";
import { useAnimationStore } from "../hooks";
import { TrackRender, AnimationInstanceSettings } from "../types";
import { TrackRow } from "./track-row";
import { TrackGap } from "./track-gap";

export function TrackList({
  animationId,
  namespaceId,
  instanceSettings,
  trackRender,
}: {
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender;
}) {
  const [contentRef, contentBounds] = useMeasure();
  const tracks = useAnimationStore(
    useShallow((state) => Array.from(state.animations[animationId].tracks)),
  );
  return (
    <ScrollArea className="dark:bg-layout-darkdeepinset bg-[#ededed] h-[240px]">
      <div ref={contentRef}>
        {tracks.map((track) => (
          <TrackRow
            key={track}
            animationId={animationId}
            trackIds={[track]}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            trackRender={trackRender}
          />
        ))}
      </div>
      {contentBounds.height < 240 && (
        <TrackGap animationId={animationId} height={240 - contentBounds.height} />
      )}
      {tracks.length === 0 && (
        <div className="h-[240px] grid place-items-center">
          <p className="text-neutral-500 font-thin text-sm">No tracks</p>
        </div>
      )}
    </ScrollArea>
  );
}
