import { ScrollArea } from "@semio/ui";
import { useShallow } from "zustand/react/shallow";
import useMeasure from "react-use-measure";
import { useAnimationStore } from "../hooks";
import { TrackRender, AnimationInstanceSettings } from "../types";
import { DEFAULT_TRACK_HEIGHT, TIMELINE_PADDING } from "../constants";
import { TrackRow } from "./track-row";
import { TrackGap } from "./track-gap";

export function TrackList({
  animationId,
  namespaceId,
  instanceSettings,
  trackRender,
  height = 240,
  width = 2 * TIMELINE_PADDING,
}: {
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender;
  parentHeight?: number;
  height?: number;
  width?: number;
}) {
  const [contentRef, contentBounds] = useMeasure();
  const tracks = useAnimationStore(
    useShallow((state) => Array.from(state.animations[animationId].tracks)),
  );

  return (
    <div className="relative h-full w-full overflow-hidden dark:bg-black bg-neutral-100">
      <ScrollArea
        orientation="vertical"
        className="absolute left-0 top-0 right-0 bottom-0 "
        style={{ maxHeight: height }}
      >
        <div
          ref={contentRef}
          className="grid grid-cols-[298px_1fr] gap-x-1 not-group-aria-expanded/sheet:hidden"
        >
          {tracks.map((track) => (
            <TrackRow
              key={track}
              animationId={animationId}
              trackIds={[track]}
              namespaceId={namespaceId}
              instanceSettings={instanceSettings}
              trackRender={trackRender}
              width={width}
              height={DEFAULT_TRACK_HEIGHT}
            />
          ))}
        </div>
        {contentBounds.height < height && (
          <TrackGap animationId={animationId} height={height - contentBounds.height} />
        )}
      </ScrollArea>
      {tracks.length === 0 && (
        <div className="absolute grid place-items-center top-0 left-0 right-0 bottom-0 dark:bg-black/50 bg-neutral-100/50 pointer-events-none">
          <p className="text-neutral-500 text-sm">No tracks</p>
        </div>
      )}
    </div>
  );
}
