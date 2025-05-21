import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import useMeasure from "react-use-measure";
import { ToggleGroup, Size, ToggleSquare, IconPreviewView } from "@semio/ui";
import { IconArrowUpRight, IconChevronDown, IconLine, IconTable } from "@tabler/icons-react";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { TrackRender, AnimationInstance } from "../types";
import { useAnimationStore } from "../hooks";
import { DEFAULT_TRACK_HEIGHT } from "../constants";
import { Timeline } from "./timeline";
import { TrackList } from "./track-list";
import { Minimap } from "./minimap";
import { Ruler } from "./ruler";
import { TimelineControl } from "./timeline-control";
import { TimeControls } from "./time-controls";
import { ColorContextProvider } from "./color-provider";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";
const MIN_SHEET_HEIGHT = 134;

export interface AnimationSheetProps {
  namespaceId: string;
  animationInstances: Record<string, AnimationInstance>;
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
}

export function AnimationSheet(props: AnimationSheetProps): ReactNode {
  const ctx = useContext(AnimationContext);
  if (ctx) {
    return <MemoizedInnerSheet {...props} />;
  } else {
    return (
      <AnimationContext.Provider value={useDefaultAnimationStore}>
        <MemoizedInnerSheet {...props} />
      </AnimationContext.Provider>
    );
  }
}

export function InnerSheet({
  namespaceId,
  animationInstances,
  onToggleExpand,
  height = MIN_SHEET_HEIGHT,
}: AnimationSheetProps): ReactNode {
  // TODO: Eventually we will allow seleciton of different animation instances to view. For now we assume there is only one instance per set.
  const [trackRender, setTrackRender] = useState<TrackRender>(TrackRender.Key);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const { animations, updateDuration } = useAnimationStore(
    useShallow((state) => {
      return {
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

  const [trackRegion, trackBounds] = useMeasure();

  if (!currentAnimation || !animations[currentAnimation]) {
    return null;
  }

  const allTracks = animations[currentAnimation].tracks;

  const expanded = height > MIN_SHEET_HEIGHT;

  return (
    <ColorContextProvider>
      <div
        aria-expanded={expanded}
        style={{
          height,
          minHeight: MIN_SHEET_HEIGHT,
        }}
        className={clsx(
          "grid grid-cols-[298px_1fr] group/sheet w-full gap-x-1 pr-0.5 pb-0.5",
          "grid-rows-[32px_1fr_36px_32px_32px]",
          // "dark:bg-layout-dark-inset bg-layout-light-inset",
        )}
      >
        {/* Expand Toggle/Ruler */}
        {/* <div className={clsx("h-6 relative", "w-full flex flex-row text-xs")}> */}
        <div className={clsx("flex flex-1 flex-row h-8 items-center justify-between pl-1")}>
          <ToggleSquare
            size={Size.Sm}
            value={expanded}
            onChange={(v) => onToggleExpand?.(v)}
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
        <div
          ref={trackRegion}
          className={clsx("flex-1 h-8 text-black dark:text-white rounded-t-sm", TRACK_MAIN_BG)}
        >
          <Ruler side="top" animationId={currentAnimation} height={32} width={trackBounds.width} />
        </div>

        <div className="col-span-2">
          {/* Tracks */}
          {/* <div
          className={clsx(
            "group-aria-expanded:h-full overflow-hidden",
            "transition-[height] duration-75 h-0",
          )}
        > */}
          <TrackList
            animationId={currentAnimation}
            namespaceId={namespaceId}
            trackRender={trackRender}
            instanceSettings={instanceSettings}
            width={trackBounds.width}
            // Subtract the height of the other elements from the total height
            height={height - 134}
          />
          {/* </div> */}
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
            height={DEFAULT_TRACK_HEIGHT}
            width={trackBounds.width}
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

        <div className={clsx("w-full h-8 items-center text-black dark:text-white", TRACK_MAIN_BG)}>
          <Minimap
            animationId={currentAnimation}
            instanceSettings={instanceSettings}
            width={trackBounds.width}
          />
        </div>

        <div className={clsx("w-full duration-75 h-8", "flex items-center justify-center")} />
        <div className={clsx("flex-1 h-8 text-black dark:text-white rounded-b-sm", TRACK_MAIN_BG)}>
          <Ruler
            side="bottom"
            animationId={currentAnimation}
            height={32}
            width={trackBounds.width}
          />
        </div>
      </div>
    </ColorContextProvider>
  );
}

const MemoizedInnerSheet = memo(InnerSheet);
