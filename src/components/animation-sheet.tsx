import type { ReactNode } from "react";
import { useContext, memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { IconButton } from "@semio/ui";
import { IconChevronDown } from "@tabler/icons-react";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { useAnimationStore } from "../hooks";
import { PlaybackControls } from "./playback-controls";
import { Timeline } from "./timeline";
import { TrackList } from "./track-list";
import { Minimap } from "./minimap";
import { Ruler } from "./ruler";

export function AnimationSheet(): ReactNode {
  const ctx = useContext(AnimationContext);
  if (ctx) {
    return <MemoizedInnerSheet />;
  } else {
    return (
      <AnimationContext.Provider value={useDefaultAnimationStore}>
        <MemoizedInnerSheet />
      </AnimationContext.Provider>
    );
  }
}

export function InnerSheet(): ReactNode {
  const activeAnimation = useAnimationStore(useShallow((state) => state.activeAnimation));
  const expanded = useAnimationStore(useShallow((state) => state.expanded));
  const setExpanded = useAnimationStore(useShallow((state) => state.setExpanded));
  const [selectedTrack, setSelectedTrack] = useState<string>("all");
  return (
    <div
      aria-expanded={expanded}
      className={clsx(
        "flex flex-col group w-full dark:bg-neutral-800 bg-neutral-200",
        "divide-y divide-transparent",
      )}
    >
      {/* Expand Toggle/Ruler */}
      <div
        className={clsx(
          "h-6 relative z-10",
          "hover:dark:bg-neutral-900/10 hover:bg-neutral-100/10 bg-transparent",
          "w-full flex flex-row text-xs",
        )}
      >
        <div
          className={clsx(
            "w-[calc(100vw-40px)] xs:w-64 transition-[width] duration-75",
            "h-full flex items-center justify-center",
          )}
        >
          <IconButton
            size="fit"
            onClick={() => setExpanded(!expanded)}
            className={clsx(
              "w-[calc(100vw-40px)] xs:w-64 transition-[width]",
              "flex items-center justify-center",
            )}
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
        <div className="flex-1 xs:w-64 transition-[width] h-6 text-black dark:text-white">
          <Ruler side="top" animationId={activeAnimation} />
        </div>
      </div>
      <div>
        {/* Tracks */}
        <div
          className={clsx(
            "group-aria-expanded:xs:h-[240px] overflow-hidden",
            "transition-[height] duration-75 h-0",
          )}
        >
          {expanded && <TrackList animationId={activeAnimation} />}
        </div>
        {/* Content */}
        <div className="flex flex-row group ">
          <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] h-[60px]">
            <PlaybackControls
              animationId={activeAnimation}
              track={selectedTrack}
              onChangeTrack={setSelectedTrack}
            />
          </div>
          <div className="flex-1 overflow-hidden h-[60px] flex-col flex">
            <div className="h-[60px]">
              <Timeline
                trackIds={selectedTrack === "all" ? [] : [selectedTrack]}
                animationId={activeAnimation}
                namespaceId="default"
              />
              <div className="w-full h-[30px] items-center text-black dark:text-white">
                <Minimap animationId={activeAnimation} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={clsx("z-50 h-6 bg-transparent w-full flex flex-row text-xs")}>
        <div
          className={clsx(
            "w-[calc(100vw-40px)] xs:w-64 transition-[width] duration-75 h-6",
            "flex items-center justify-center",
          )}
        />
        <div className="flex-1 xs:w-64 transition-[width] h-6 text-black dark:text-white">
          <Ruler side="bottom" animationId={activeAnimation} />
        </div>
      </div>
    </div>
  );
}

const MemoizedInnerSheet = memo(InnerSheet);
