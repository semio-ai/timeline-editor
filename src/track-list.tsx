import { ScrollArea } from "@semio/ui";
import { useAnimationStore } from "./hooks/use-animation-store";
import { TrackRow } from "./track-row";
import { TrackGap } from "./track-gap";

export function TrackList() {
  const tracks = useAnimationStore((state) => state.animations[state.activeAnimation].trackOrder);
  return (
    <ScrollArea className="dark:bg-neutral-900/50 bg-neutral-100 h-[240px]">
      {tracks.map((track) => (
        <TrackRow key={track} trackIds={[track]} />
      ))}
      {tracks.length < 8 && tracks.length > 0 && <TrackGap count={8 - tracks.length} />}
      {tracks.length === 0 && (
        <div className="h-[240px] grid place-items-center">
          <p className="text-neutral-500 font-thin text-sm">No tracks</p>
        </div>
      )}
    </ScrollArea>
  );
}
