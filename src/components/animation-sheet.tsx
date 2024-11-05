import type { ReactNode } from "react";
import { useContext, memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ToggleGroup, Size, ToggleSquare, Variant } from "@semio/ui";
import {
  IconArrowUpRight,
  IconChevronDown,
  IconEaseInOut,
  IconEaseInOutControlPoints,
  IconLine,
  IconTable,
} from "@tabler/icons-react";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { TrackRender } from "../types";
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
  const allTracks = useAnimationStore(
    useShallow((state) => state.animations[activeAnimation].tracks),
  );
  const [trackRender, setTrackRender] = useState<TrackRender>(TrackRender.Dope);
  const [selectedTracks, setSelectedTracks] = useState<string[]>(allTracks);
  return (
    <div
      aria-expanded={expanded}
      className={clsx(
        "flex flex-col group w-full dark:bg-neutral-800 bg-neutral-200",
        "divide-y divide-transparent",
      )}
    >
      {/* Expand Toggle/Ruler */}
      <div className={clsx("h-6 relative z-10", "w-full flex flex-row text-xs")}>
        <div
          className={clsx(
            "w-[calc(100vw-40px)] xs:w-64 transition-[width] duration-75",
            "h-full flex items-center pl-3 pr-2 justify-between",
          )}
        >
          <ToggleSquare
            size={Size.Xs}
            value={expanded}
            onChange={setExpanded}
            label="Expand Tracks"
          >
            <IconChevronDown
              size="11px"
              className={clsx(
                expanded ? "rotate-0" : "rotate-180",
                "transition-transform ease-in-out",
              )}
            />
          </ToggleSquare>

          <ToggleGroup
            size={Size.Xs}
            variant={Variant.Default}
            value={trackRender}
            onChange={(v: string) => {
              console.log(`Updating Track Render from ${trackRender} to ${v}`);
              setTrackRender(v as TrackRender);
            }}
            options={[
              {
                value: TrackRender.Dope,
                label: "Dope Sheet",
                icon: <IconLine size="11px" className="rotate-45" />,
              },
              {
                value: TrackRender.Preview,
                label: "Preview View",
                icon: <IconEaseInOut size="11px" />,
              },
              {
                value: TrackRender.Transition,
                label: "Transition View",
                icon: <IconLine size="11px" />,
              },
              {
                value: TrackRender.Curve,
                label: "Curve View",
                icon: <IconEaseInOutControlPoints size="11px" />,
                disabled: true,
              },
              {
                value: TrackRender.Data,
                label: "Data View",
                icon: <IconTable size="11px" />,
                disabled: true,
              },
            ]}
          />
          <ToggleSquare size={Size.Xs} value={false} onChange={() => {}} label="Pop Out" disabled>
            <IconArrowUpRight size="11px" />
          </ToggleSquare>
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
          {expanded && <TrackList animationId={activeAnimation} trackRender={trackRender} />}
        </div>
        {/* Content */}
        <div className="flex flex-row group ">
          <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] h-[60px]">
            <PlaybackControls
              animationId={activeAnimation}
              namespaceId="default"
              selection={selectedTracks}
              allTracks={allTracks}
              onChangeSelection={setSelectedTracks}
            />
          </div>
          <div className="flex-1 overflow-hidden h-[60px] flex-col flex">
            <div className="h-[60px]">
              <Timeline
                trackIds={selectedTracks}
                animationId={activeAnimation}
                namespaceId="default"
                trackRender={
                  ([TrackRender.Dope, TrackRender.Preview, TrackRender.Transition].includes(
                    trackRender,
                  )
                    ? trackRender
                    : TrackRender.Dope) as
                    | TrackRender.Dope
                    | TrackRender.Preview
                    | TrackRender.Transition
                }
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
