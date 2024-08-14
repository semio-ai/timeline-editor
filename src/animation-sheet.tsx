import type { ReactNode } from "react";
import { useContext, memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { IconButton } from "@semio/ui";
import { IconChevronDown } from "@tabler/icons-react";
import { AnimationContext } from "./context";
import { useDefaultAnimationStore } from "./store";
import { useAnimationStore } from "./hooks/use-animation-store";
import { PlaybackControls } from "./playback-controls";
import { Timeline } from "./timeline";
import { TrackList } from "./track-list";
import { Minimap } from "./minimap";

export function AnimationSheet(): ReactNode {
  const ctx = useContext(AnimationContext);
  if (ctx) {
    return <MemoizedInnerSheet />;
  } else {
    useDefaultAnimationStore.getState().initPlayerInterval();
    return (
      <AnimationContext.Provider value={useDefaultAnimationStore}>
        <MemoizedInnerSheet />
      </AnimationContext.Provider>
    );
  }
}

export function InnerSheet(): ReactNode {
  const expanded = useAnimationStore(useShallow((state) => state.expanded));
  const setExpanded = useAnimationStore(
    useShallow((state) => state.setExpanded),
  );
  const [selectedTrack, setSelectedTrack] = useState<string>("all");
  return (
    <div
      aria-expanded={expanded}
      className="flex flex-col group w-full dark:bg-neutral-800 bg-neutral-200"
    >
      {/* Expand Toggle/Ruler */}
      <div
        className={clsx(
          "h-4 overflow-hidden",
          "relative hover:dark:bg-neutral-900/10 hover:bg-neutral-100/10 bg-transparent w-full flex flex-row text-xs",
        )}
      >
        <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] h-full duration-75 flex items-center justify-center">
          <IconButton
            size="fit"
            onClick={() => setExpanded(!expanded)}
            className="w-[calc(100vw-40px)] xs:w-64 transition-[width] flex items-center justify-center"
          >
            <IconChevronDown
              size="14px"
              className={clsx(
                expanded ? "rotate-180" : "rotate-0",
                "transition-transform ease-in-out",
              )}
            />
          </IconButton>
        </div>
        <div className="flex-1 xs:w-64 transition-[width] h-full overflow-hidden text-black dark:text-white">
          ruler
        </div>
      </div>
      <div className="divide-y divide-transparent">
        {/* Tracks */}
        <div
          className={clsx(
            "group-aria-expanded:xs:h-[240px] overflow-hidden",
            "transition-[height] duration-75 h-0",
          )}
        >
          {expanded && <TrackList />}
        </div>
        {/* Content */}
        <div className="flex flex-row group shadow-md">
          <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] h-[60px]">
            <PlaybackControls
              track={selectedTrack}
              onChangeTrack={setSelectedTrack}
            />
          </div>
          <div className="flex-1 overflow-hidden h-[60px] flex-col flex">
            <div className="h-[60px]">
              <Timeline
                trackIds={selectedTrack === "all" ? [] : [selectedTrack]}
              />
              <div className="w-full h-[30px] items-center text-black dark:text-white">
                <Minimap />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// function getSize(size: number): string {
//   switch (size) {
//     case 0:
//       return "group-aria-expanded:xs:h-[30px]";
//     case 1:
//       return "group-aria-expanded:xs:h-[30px]";
//     case 2:
//       return "group-aria-expanded:xs:h-[60px]";
//     case 3:
//       return "group-aria-expanded:xs:h-[90px]";
//     case 4:
//       return "group-aria-expanded:xs:h-[120px]";
//     case 5:
//       return "group-aria-expanded:xs:h-[150px]";
//     case 6:
//       return "group-aria-expanded:xs:h-[180px]";
//     case 7:
//       return "group-aria-expanded:xs:h-[210px]";
//     case 8:
//       return "group-aria-expanded:xs:h-[240px]";
//     default:
//       return "group-aria-expanded:xs:h-[240px]";
//   }
// }

const MemoizedInnerSheet = memo(InnerSheet);
