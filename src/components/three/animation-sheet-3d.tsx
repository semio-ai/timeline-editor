import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import useMeasure from "react-use-measure";
import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { ToggleGroup, Size, ToggleSquare, IconPreviewView } from "@semio/ui";
import { IconArrowUpRight, IconChevronDown, IconLine, IconTable } from "@tabler/icons-react";
import { AnimationContext } from "../../context";
import { useDefaultAnimationStore } from "../../store";
import { TrackRender, AnimationInstance } from "../../types";
import { useAnimationStore, ColorContextProvider } from "../../hooks";
// Import existing components that we'll reuse for now
import { TimelineControl } from "../timeline-control";
import { TimeControls } from "../time-controls";
import { PlaybackSettings } from "../playback-settings";
import { TrackList3D } from "./track-list-3d";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";
const MIN_SHEET_HEIGHT = 142;

export interface AnimationSheet3DProps {
  namespaceId: string;
  animationInstances: Record<string, AnimationInstance>;
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
}

export function AnimationSheet3D(props: AnimationSheet3DProps): ReactNode {
  const ctx = useContext(AnimationContext);
  if (ctx) {
    return <MemoizedInnerSheet3D {...props} />;
  } else {
    return (
      <AnimationContext.Provider value={useDefaultAnimationStore}>
        <MemoizedInnerSheet3D {...props} />
      </AnimationContext.Provider>
    );
  }
}

export function InnerSheet3D({
  namespaceId,
  animationInstances,
  onToggleExpand,
  height = MIN_SHEET_HEIGHT,
}: AnimationSheet3DProps): ReactNode {
  // Same state management as original
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

  const currentAnimationInstance = Object.values(animationInstances || {})[0];
  const currentAnimation = currentAnimationInstance?.animationId;
  const instanceSettings = currentAnimationInstance?.settings;

  useEffect(() => {
    if (!currentAnimation || !animations[currentAnimation]) {
      return;
    }
    setSelectedTracks(animations[currentAnimation].tracks);
    updateDuration(animations[currentAnimation].duration);
  }, [currentAnimation, animations, updateDuration]);

  const [trackRegion, _trackBounds] = useMeasure();

  const layoutRef = useRef<HTMLDivElement>(null);

  if (!currentAnimation || !animations[currentAnimation]) {
    return null;
  }

  const allTracks = animations[currentAnimation].tracks;
  const expanded = height > MIN_SHEET_HEIGHT;

  return (
    <ColorContextProvider>
      <div className="animation-sheet-container relative">
        {/* Single Canvas for all 3D rendering */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <Canvas
            className="pointer-events-none absolute inset-0"
            frameloop="always"
            eventSource={layoutRef.current ?? undefined}
            gl={{
              antialias: false,
              alpha: true,
              preserveDrawingBuffer: true,
            }}
          >
            <View.Port />
          </Canvas>
        </div>

        {/* Grid layout with tracking divs - same structure as original */}
        <div
          ref={layoutRef}
          aria-expanded={expanded}
          style={{
            height,
            minHeight: MIN_SHEET_HEIGHT,
          }}
          className={clsx(
            "grid grid-cols-[298px_1fr] group/sheet w-full gap-x-1 pr-0.5 pb-0.5",
            "grid-rows-[32px_1fr_36px_36px_36px]",
          )}
        >
          {/* Expand Toggle/Ruler - Row 1 */}
          <div className={clsx("flex flex-1 flex-row h-8 items-center justify-between pl-1")}>
            <ToggleSquare
              sizing="inner"
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
            <ToggleSquare
              sizing="inner"
              size={Size.Sm}
              value={false}
              onChange={() => {}}
              label="Pop Out"
              disabled
            >
              <IconArrowUpRight size="11px" />
            </ToggleSquare>
          </div>

          {/* Top Ruler - Row 1 */}
          <div
            className={clsx("flex-1 h-8 text-black dark:text-white rounded-t-sm", TRACK_MAIN_BG)}
          >
            {/* 3D Ruler View */}
            <View className="w-full h-full">
              <color attach="background" args={["cyan"]} />
            </View>
          </div>

          {/* Track List - Row 2 */}
          <div className="col-span-2" ref={trackRegion}>
            {/* 3D Track List with color-coded tracks */}
            <TrackList3D
              animationId={currentAnimation}
              namespaceId={namespaceId}
              instanceSettings={instanceSettings}
              height={height - MIN_SHEET_HEIGHT}
              trackRender={trackRender}
            />
          </div>

          {/* Timeline Control - Row 3 */}
          <TimelineControl
            animationId={currentAnimation}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            selection={selectedTracks}
            allTracks={allTracks}
            onChangeSelection={setSelectedTracks}
          />

          {/* Timeline View - Row 3 */}
          <div className={clsx("w-full relative", TRACK_MAIN_BG)}>
            {/* 3D Timeline View with color-coded background */}
            <View className="w-full h-full">
              <color attach="background" args={["orange"]} />
            </View>
          </div>

          {/* Time Controls - Row 4 */}
          <TimeControls
            animationId={currentAnimation}
            namespaceId={namespaceId}
            instanceSettings={instanceSettings}
            selection={selectedTracks}
            allTracks={allTracks}
            onChangeSelection={setSelectedTracks}
          />

          {/* Minimap View - Row 4 */}
          <div
            className={clsx("w-full h-9 items-center text-black dark:text-white", TRACK_MAIN_BG)}
          >
            {/* 3D Minimap View */}
            <View className="w-full h-full">
              <color attach="background" args={["red"]} />
            </View>
          </div>

          {/* Playback Settings - Row 5 */}
          <PlaybackSettings />

          {/* Bottom Ruler - Row 5 */}
          <div
            className={clsx("flex-1 h-9 text-black dark:text-white rounded-b-sm", TRACK_MAIN_BG)}
          >
            {/* 3D Bottom Ruler View */}
            <View className="w-full h-full">
              <color attach="background" args={["lime"]} />
            </View>
          </div>
        </div>
      </div>
    </ColorContextProvider>
  );
}

const MemoizedInnerSheet3D = memo(InnerSheet3D);
