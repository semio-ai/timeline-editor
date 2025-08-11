import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMotionValue } from "motion/react";
import { clsx } from "clsx";
import useMeasure from "react-use-measure";
// import { Canvas } from "@react-three/fiber";
// import { Hud } from "@react-three/drei";
import { ToggleGroup, Size, ToggleSquare, IconPreviewView, useTheme } from "@semio/ui";
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
import { CanvasSheet } from "./canvas-sheet/canvas-sheet";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";
const MIN_SHEET_HEIGHT = 142;

export interface AnimationSheet3DProps {
  namespaceId: string;
  animationInstances: Record<string, AnimationInstance>;
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
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
  fonts = {},
}: AnimationSheet3DProps): ReactNode {
  const { resolvedTheme } = useTheme();
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
  // const [trackListBounds, setTrackListBounds] = useState<RegionBounds | null>(null);

  useEffect(() => {
    if (!currentAnimation || !animations[currentAnimation]) {
      return;
    }
    setSelectedTracks(animations[currentAnimation].tracks);
    updateDuration(animations[currentAnimation].duration);
  }, [currentAnimation, animations, updateDuration]);

  const [trackRegion, _trackBounds] = useMeasure();
  const trackRegionElement = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);

  const [emphasis, setEmphasis] = useState<string[]>([]);

  const setEmphasisSmart = useCallback(
    (id: string, opt: "add" | "remove") => {
      setEmphasis((prev) => {
        if (opt === "add") {
          return [...prev, id];
        } else {
          return prev.filter((e) => e !== id);
        }
      });
    },
    [setEmphasis],
  );

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
          <div
            ref={canvasRef}
            className={clsx(
              "w-full min-w-0 row-span-5 touch-none rounded-md overflow-clip",
              TRACK_MAIN_BG,
            )}
          >
            <CanvasSheet
              tracks={allTracks}
              selection={selectedTracks}
              scrollValue={scrollY}
              theme={resolvedTheme}
              emphasis={emphasis}
              onEmphasisChange={setEmphasisSmart}
              fonts={fonts}
            />
          </div>

          {/* Track List - Row 2 */}
          <div
            ref={(el) => {
              trackRegion(el);
              trackRegionElement.current = el;
            }}
          >
            {/* 3D Track List with color-coded tracks */}
            <TrackList3D
              animationId={currentAnimation}
              namespaceId={namespaceId}
              instanceSettings={instanceSettings}
              height={height - MIN_SHEET_HEIGHT}
              trackRender={trackRender}
              scrollY={scrollY}
              emphasis={emphasis}
              onEmphasisChange={setEmphasisSmart}
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
