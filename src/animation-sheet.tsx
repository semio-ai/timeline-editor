import type { ReactNode } from "react";
import { useContext, memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { IconButton } from "@semio/ui";
import { IconChevronDown } from "@tabler/icons-react";
import { AnimationContext } from "./context";
import { useDefaultAnimationStore } from "./store";
import { useAnimationStore } from "./hooks/use-animation-store";
import { PlaybackControls } from "./playback-controls";
import { Timeline } from "./timeline";

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
  return (
    <div
      aria-expanded={expanded}
      className="flex flex-col group w-full dark:bg-neutral-800 bg-neutral-200"
    >
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
        <div className="flex-1 xs:w-64 transition-[width] h-full overflow-hidden">
          ruler
        </div>
      </div>
      <div className="flex flex-row group shadow-md">
        <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] h-full">
          <div className="group-aria-expanded:xs:h-64 transition-[height] duration-75 h-0 dark:bg-neutral-950 bg-neutral-50" />
          <div className="h-[60px] w-full overflow-hidden">
            <PlaybackControls />
          </div>
        </div>
        <div className="flex-1">
          {/* <div className="relative">
            <div
              className={clsx(
                "absolute w-full bg-transparent bottom-[1px]",
                "group-aria-expanded:dark:bg-black/10 group-aria-expanded:bg-white/10 group-aria-expanded:backdrop-blur-md",
                "group-hover:dark:bg-black/20 group-hover:bg-white/20 group-hover:backdrop-blur-md",
              )}
            >
              <button type="button" onClick={() => setExpanded(!expanded)}>
                {!expanded ? "Open" : "Close"}
              </button>
            </div>
          </div> */}
          <div className="group-aria-expanded:xs:h-64 transition-[height] ease-in-out duration-75 h-0 dark:bg-neutral-950 bg-neutral-50" />
          <div className="h-[60px]">
            <Timeline />
            <div className="w-full h-[30px] items-center px-4">Minimap</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MemoizedInnerSheet = memo(InnerSheet);
