import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ToggleGroup, Size, ToggleSquare, Variant, IconPreviewView } from "@semio/ui";
import { IconArrowUpRight, IconChevronDown, IconLine, IconTable } from "@tabler/icons-react";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { TrackRender, AnimationInstance } from "../types";
import { useAnimationStore } from "../hooks";
import { PlaybackControls } from "./playback-controls";
import { Timeline } from "./timeline";
import { TrackList } from "./track-list";
import { Minimap } from "./minimap";
import { Ruler } from "./ruler";

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
  const allTracks = animations[currentAnimation].tracks;

  return (
    <div
      aria-expanded={expanded}
      className={clsx(
        "flex flex-col group w-full dark:bg-layout-dark-inset bg-layout-light-inset",
        "divide-y divide-transparent",
      )}
    >
      {/* Expand Toggle/Ruler */}
      <div className={clsx("h-6 relative", "w-full flex flex-row text-xs")}>
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
          <ToggleSquare size={Size.Xs} value={false} onChange={() => {}} label="Pop Out" disabled>
            <IconArrowUpRight size="11px" />
          </ToggleSquare>
        </div>
        <div className="flex-1 xs:w-64 transition-[width] h-6 text-black dark:text-white">
          <Ruler side="top" animationId={currentAnimation} />
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
          {expanded && (
            <TrackList
              animationId={currentAnimation}
              namespaceId={namespaceId}
              trackRender={trackRender}
              instanceSettings={instanceSettings}
            />
          )}
        </div>
        {/* Content */}
        <div className="flex flex-row group ">
          <div className="w-[calc(100vw-40px)] xs:w-64 transition-[width] h-[60px]">
            <PlaybackControls
              animationId={currentAnimation}
              namespaceId={namespaceId}
              instanceSettings={instanceSettings}
              selection={selectedTracks}
              allTracks={allTracks}
              onChangeSelection={setSelectedTracks}
            />
          </div>
          <div className="flex-1 overflow-hidden h-[60px] flex-col flex">
            <div className="h-[60px]">
              <Timeline
                trackIds={selectedTracks}
                animationId={currentAnimation}
                namespaceId={namespaceId}
                instanceSettings={instanceSettings}
                trackRender={
                  ([TrackRender.Key, TrackRender.Preview, TrackRender.Transition].includes(
                    trackRender,
                  )
                    ? trackRender
                    : TrackRender.Key) as
                    | TrackRender.Key
                    | TrackRender.Preview
                    | TrackRender.Transition
                }
              />
              <div className="w-full h-[30px] items-center text-black dark:text-white">
                <Minimap animationId={currentAnimation} instanceSettings={instanceSettings} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={clsx("h-6 bg-transparent w-full flex flex-row text-xs")}>
        <div
          className={clsx(
            "w-[calc(100vw-40px)] xs:w-64 transition-[width] duration-75 h-6",
            "flex items-center justify-center",
          )}
        />
        <div className="flex-1 xs:w-64 transition-[width] h-6 text-black dark:text-white">
          <Ruler side="bottom" animationId={currentAnimation} />
        </div>
      </div>
    </div>
  );
}

const MemoizedInnerSheet = memo(InnerSheet);
