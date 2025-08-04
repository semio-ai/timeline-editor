import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMotionValue } from "motion/react";
import { clsx } from "clsx";
import useMeasure from "react-use-measure";
import { Canvas } from "@react-three/fiber";
import { Hud } from "@react-three/drei";
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
import { LayoutProvider } from "./layout";
import { DEFAULT_DATA_VISUALIZATION_LAYOUT } from "./data-visualization-layout-config";
import {
  TopRulerRegion,
  TrackListRegion,
  TimelineRegion,
  MinimapRegion,
  BottomRulerRegion,
} from "./regions";

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

  const scrollY = useMotionValue(0);

  useEffect(() => {
    if (!currentAnimation || !animations[currentAnimation]) {
      return;
    }
    setSelectedTracks(animations[currentAnimation].tracks);
    updateDuration(animations[currentAnimation].duration);
  }, [currentAnimation, animations, updateDuration]);

  // Phase 0: Scroll handler for R3F event system with bounds constraint
  const handleCanvasWheel = useCallback(
    (event: any) => {
      console.log("🎯 R3F wheel event detected:", event.deltaY);

      if (!currentAnimation || !animations[currentAnimation]) {
        return;
      }

      const tracks = animations[currentAnimation].tracks;
      const trackHeight = 36; // px per track
      const contentHeight = tracks.length * trackHeight;
      const visibleHeight = height - MIN_SHEET_HEIGHT; // Available height for tracks
      const maxScroll = Math.max(0, contentHeight - visibleHeight);

      // Apply bounds constraint
      const currentScroll = scrollY.get();
      const rawNewScroll = currentScroll + event.deltaY * 0.5;
      const boundedScroll = Math.max(0, Math.min(maxScroll, rawNewScroll));

      console.log("📊 Scroll update:", {
        currentScroll,
        deltaY: event.deltaY,
        rawNewScroll,
        boundedScroll,
        maxScroll,
        contentHeight,
        visibleHeight,
        trackCount: tracks.length,
      });

      scrollY.set(boundedScroll);
    },
    [scrollY, currentAnimation, animations, height],
  );

  const [trackRegion, _trackBounds] = useMeasure();

  const layoutRef = useRef<HTMLDivElement>(null);

  if (!currentAnimation || !animations[currentAnimation]) {
    return null;
  }

  const allTracks = animations[currentAnimation].tracks;
  const expanded = height > MIN_SHEET_HEIGHT;

  return (
    <ColorContextProvider>
      <div className="animation-sheet-container w-full">
        {/* Grid layout with tracking divs - same structure as original */}
        <div
          ref={layoutRef}
          aria-expanded={expanded}
          style={{
            height,
            minHeight: MIN_SHEET_HEIGHT,
          }}
          className={clsx(
            "grid grid-cols-[302px_1fr] group/sheet w-full pr-0.5 pb-0.5",
            "grid-rows-[32px_1fr_36px_36px_36px]",
          )}
        >
          {/* Expand Toggle/Ruler - Row 1 */}
          <div className={clsx("flex flex-1 flex-row h-8 items-center justify-between px-1")}>
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

          {/* Canvas (spans all rows) */}
          <div className={clsx("w-full min-w-0 row-span-5", TRACK_MAIN_BG)}>
            <Canvas
              className="w-full h-full"
              orthographic
              camera={{
                position: [0, 0, 100],
                up: [0, 1, 0],
                zoom: 1,
              }}
              onWheel={handleCanvasWheel}
            >
              <LayoutProvider config={DEFAULT_DATA_VISUALIZATION_LAYOUT}>
                {/* Main Scene - Track List (behind everything) */}
                <TrackListRegion
                  visible
                  animationId={currentAnimation}
                  namespaceId={namespaceId}
                  instanceSettings={instanceSettings}
                  scrollY={scrollY}
                />

                {/* HUD Layer 1 - Top Ruler */}
                <Hud renderPriority={1}>
                  <TopRulerRegion />
                </Hud>

                {/* HUD Layer 2 - Timeline */}
                <Hud renderPriority={2}>
                  <TimelineRegion />
                </Hud>

                {/* HUD Layer 3 - Minimap & Bottom Ruler */}
                <Hud renderPriority={3}>
                  <MinimapRegion />
                  <BottomRulerRegion />
                </Hud>

                <ambientLight intensity={1} />
              </LayoutProvider>
            </Canvas>
          </div>

          {/* Track List - Row 2 */}
          <div ref={trackRegion}>
            {/* 3D Track List with color-coded tracks */}
            <TrackList3D
              animationId={currentAnimation}
              namespaceId={namespaceId}
              instanceSettings={instanceSettings}
              height={height - MIN_SHEET_HEIGHT}
              trackRender={trackRender}
              scrollY={scrollY}
            />
          </div>

          {/* Timeline Control - Row 3 */}
          <div className="pr-2">
            <TimelineControl
              animationId={currentAnimation}
              namespaceId={namespaceId}
              instanceSettings={instanceSettings}
              selection={selectedTracks}
              allTracks={allTracks}
              onChangeSelection={setSelectedTracks}
            />
          </div>

          {/* Timeline View - Row 3 */}

          {/* Time Controls - Row 4 */}
          <div className="pr-2">
            <TimeControls
              animationId={currentAnimation}
              namespaceId={namespaceId}
              instanceSettings={instanceSettings}
              selection={selectedTracks}
              allTracks={allTracks}
              onChangeSelection={setSelectedTracks}
            />
          </div>

          {/* Minimap View - Row 4 */}

          {/* Playback Settings - Row 5 */}
          <div className="pr-2">
            <PlaybackSettings />
          </div>

          {/* Bottom Ruler - Row 5 */}
        </div>
      </div>
    </ColorContextProvider>
  );
}

const MemoizedInnerSheet3D = memo(InnerSheet3D);
