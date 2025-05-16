import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ToggleGroup, Size, ToggleSquare, IconPreviewView } from "@semio/ui";
import { IconArrowUpRight, IconChevronDown, IconLine, IconTable } from "@tabler/icons-react";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { TrackRender, AnimationInstance } from "../types";
import { useAnimationStore } from "../hooks";
import { Timeline } from "./timeline";
import { TrackList } from "./track-list";
import { Minimap } from "./minimap";
import { Ruler } from "./ruler";
import { TimelineControl } from "./timeline-control";
import { TimeControls } from "./time-controls";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";
// const TRACK_MAIN_BG = "dark:bg-red-500 bg-red-500";

export interface AnimationSheetProps {
  namespaceId: string;
  animationInstances: Record<string, AnimationInstance>;
}

export function AnimationSheet({
  namespaceId,
  animationInstances,
}: AnimationSheetProps): ReactNode {
  const ctx = useContext(AnimationContext);
  if (ctx) {
    return <MemoizedInnerSheet namespaceId={namespaceId} animationInstances={animationInstances} />;
  } else {
    return (
      <AnimationContext.Provider value={useDefaultAnimationStore}>
        <MemoizedInnerSheet namespaceId={namespaceId} animationInstances={animationInstances} />
      </AnimationContext.Provider>
    );
  }
}

export function InnerSheet({ namespaceId, animationInstances }: AnimationSheetProps): ReactNode {
  // TODO: Eventually we will allow seleciton of different animation instances to view. For now we assume there is only one instance per set.
  const [trackRender, setTrackRender] = useState<TrackRender>(TrackRender.Key);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const { expanded, setExpanded, animations, updateDuration } = useAnimationStore(
    useShallow((state) => {
      return {
        expanded: state.expanded,
        setExpanded: state.setExpanded,
        animations: state.animations,
        updateDuration: state.updateDuration,
      };
    }),
  );

  const currentAnimationInstance = Object.values(animationInstances)[0];
  const currentAnimation = currentAnimationInstance.animationId;
  const instanceSettings = currentAnimationInstance.settings;
  useEffect(() => {
    if (!currentAnimation || !animations[currentAnimation]) {
      return;
    }
    setSelectedTracks(animations[currentAnimation].tracks);
    updateDuration(animations[currentAnimation].duration);
  }, [currentAnimation, animations, updateDuration]);

  if (!currentAnimation || !animations[currentAnimation]) {
    return null;
  }
  console.log(animations[currentAnimation]);
  const allTracks = animations[currentAnimation].tracks;

  return (
    <div
      aria-expanded={expanded}
      className={clsx(
        "grid grid-cols-[298px_1fr] group w-full gap-x-1 pr-0.5 pb-0.5",
        // "dark:bg-layout-dark-inset bg-layout-light-inset",
      )}
    >
      {/* Expand Toggle/Ruler */}
      {/* <div className={clsx("h-6 relative", "w-full flex flex-row text-xs")}> */}
      <div className={clsx("flex flex-1 flex-row h-8 items-center justify-between pl-1")}>
        <ToggleSquare size={Size.Sm} value={expanded} onChange={setExpanded} label="Expand Tracks">
          <IconChevronDown
            size="11px"
            className={clsx(
              expanded ? "rotate-0" : "rotate-180",
              "transition-transform ease-in-out",
            )}
          />
        </ToggleSquare>

        <ToggleGroup
          bg
          visuals="icons"
          size={Size.Sm}
          value={trackRender}
          onChange={(v: string) => {
            console.log(`Updating Track Render from ${trackRender} to ${v}`);
            setTrackRender(v as TrackRender);
          }}
          options={[
            {
              value: TrackRender.Key,
              label: "Key View",
              icon: <IconLine size="11px" className="rotate-45" />,
            },
            {
              value: TrackRender.Transition,
              label: "Transition View",
              icon: <IconLine size="11px" />,
            },
            {
              value: TrackRender.Preview,
              label: "Preview View",
              // icon: <IconEaseInOut size="11px" />,
              icon: <IconPreviewView size="11px" />,
            },
            {
              value: TrackRender.Data,
              label: "Data View",
              icon: <IconTable size="11px" />,
              disabled: true,
            },
          ]}
        />
        <ToggleSquare size={Size.Sm} value={false} onChange={() => {}} label="Pop Out" disabled>
          <IconArrowUpRight size="11px" />
        </ToggleSquare>
        {/* </div> */}
      </div>
      <div className={clsx("flex-1 h-8 text-black dark:text-white rounded-t-sm", TRACK_MAIN_BG)}>
        <Ruler side="top" animationId={currentAnimation} height={32} />
      </div>

      <div className="col-span-2">
        {/* Tracks */}
        <div
          className={clsx(
            "group-aria-expanded:h-[240px] overflow-hidden",
            "transition-[height] duration-75 h-0",
          )}
        >
          {expanded && (
            <TrackList
              animationId={currentAnimation}
              namespaceId={namespaceId}
              trackRender={trackRender}
              instanceSettings={instanceSettings}
            />
          )}
        </div>
      </div>

      <TimelineControl
        animationId={currentAnimation}
        namespaceId={namespaceId}
        instanceSettings={instanceSettings}
        selection={selectedTracks}
        allTracks={allTracks}
        onChangeSelection={setSelectedTracks}
      />

      <div className={clsx("w-full", TRACK_MAIN_BG)}>
        <Timeline
          height={32}
          trackIds={selectedTracks}
          animationId={currentAnimation}
          namespaceId={namespaceId}
          instanceSettings={instanceSettings}
          trackRender={
            ([TrackRender.Key, TrackRender.Preview, TrackRender.Transition].includes(trackRender)
              ? trackRender
              : TrackRender.Key) as TrackRender.Key | TrackRender.Preview | TrackRender.Transition
          }
        />
      </div>

      <TimeControls
        animationId={currentAnimation}
        namespaceId={namespaceId}
        instanceSettings={instanceSettings}
        selection={selectedTracks}
        allTracks={allTracks}
        onChangeSelection={setSelectedTracks}
      />

      <div
        className={clsx("w-full h-[32px] items-center text-black dark:text-white", TRACK_MAIN_BG)}
      >
        <Minimap animationId={currentAnimation} instanceSettings={instanceSettings} />
      </div>

      <div className={clsx("w-full duration-75 h-8", "flex items-center justify-center")} />
      <div className={clsx("flex-1 h-8 text-black dark:text-white rounded-b-sm", TRACK_MAIN_BG)}>
        <Ruler side="bottom" animationId={currentAnimation} height={32} />
      </div>
    </div>
  );
}

const MemoizedInnerSheet = memo(InnerSheet);
