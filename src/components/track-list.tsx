import { ScrollArea } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import { useAnimationStore } from "../hooks";
import { TrackRow } from "./track-row";
import { TrackGap } from "./track-gap";

export function TrackList({ animationId }: { animationId: string }) {
  const tracks = useAnimationStore(
    useShallow((state) => Array.from(state.animations[animationId].tracks.keys())),
  );
  return (
    <ScrollArea className="dark:bg-neutral-900/50 bg-neutral-100 h-[240px]">
      {tracks.map((track) => (
        <TrackRow key={track} animationId={animationId} trackIds={[track]} namespaceId="default" />
      ))}
      {tracks.length < 8 && tracks.length > 0 && (
        <TrackGap animationId={animationId} count={8 - tracks.length} />
      )}
      {tracks.length === 0 && (
        <div className="h-[240px] grid place-items-center">
          <p className="text-neutral-500 font-thin text-sm">No tracks</p>
        </div>
      )}
    </ScrollArea>
  );
}
