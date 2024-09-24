import { ScrollArea } from "@semio/ui";
import { useAnimationStore } from "./hooks/use-animation-store";
import { TrackRow } from "./track-row";
import { TrackGap } from "./track-gap";

export function TrackList() {
  const tracks = useAnimationStore(
    (state) => state.animations[state.activeAnimation].trackOrder,
  );
  return (
    <ScrollArea className="dark:bg-neutral-900/50 bg-neutral-100 h-[240px]">
      <div className="">
        {tracks.map((track, i) => (
          <TrackRow
            key={track}
            trackIds={[track]}
            isTop={i === 0}
            isBottom={false}
          />
        ))}
        {tracks.length < 8 && tracks.length > 0 && (
          <TrackGap count={8 - tracks.length} />
        )}
        {tracks.length === 0 && (
          <div className="h-[240px] grid place-items-center">
            <p className="text-neutral-500 font-thin text-sm">No tracks</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
