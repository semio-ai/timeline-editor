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
import { useCanvasZoomGestures } from "../../hooks/use-canvas-zoom-gestures";
// Import existing components that we'll reuse for now
import { TimelineControl } from "../timeline-control";
import { TimeControls } from "../time-controls";
import { PlaybackSettings } from "../playback-settings";
import { TrackList3D } from "./track-list-3d";
import { LayoutProvider, useRegion } from "./layout";
import {
  DEFAULT_DATA_VISUALIZATION_LAYOUT,
  DATA_VISUALIZATION_REGIONS,
} from "./data-visualization-layout-config";
import {
  TopRulerRegion,
  TrackListRegion,
  TimelineRegion,
  MinimapRegion,
  BottomRulerRegion,
} from "./regions";
import { GestureOnlyCamera } from "./cameras";
import type { RegionBounds } from "./layout/types";

/**
 * GESTURE HANDLING ARCHITECTURE (Phase 2 Completion)
 *
 * This component implements a region-aware, maintainable gesture handling system for
 * zoom/pan interactions in the animation timeline editor:
 *
 * COORDINATE SYSTEM:
 * - Player viewport: [0, 1] normalized coordinates representing visible timeline portion
 * - Camera zoom: 1/viewport_width (inverse relationship)
 * - Camera pan: viewport_center - 0.5 (offset from timeline center)
 *
 * EVENT FLOW:
 * 1. handleCanvasWheel() - Routes wheel events based on modifiers AND cursor region
 *    - Ctrl/Cmd+wheel: Passes to gesture system for zoom
 *    - Vertical wheel: ONLY allowed in track region for scrolling
 *    - Horizontal wheel: Passes to gesture system for pan
 *    - CRITICAL: Region detection prevents vertical scroll leakage into HUD areas
 *
 * 2. CanvasGestureHandler - Manages pinch and drag gestures
 *    - Pinch: Zoom around cursor position with Safari duplicate event handling
 *    - Drag: Middle-click or modifier+drag for panning
 *    - All gestures respect [0,1] viewport bounds
 *
 * 3. Camera Controllers - Synchronize cameras with viewport state
 *    - MainSceneCameraController: Main track area camera
 *    - HUDCameraController: Timeline/ruler horizontal sync
 *    - All use frustum manipulation for consistent behavior
 *
 * REGION-SPECIFIC BEHAVIORS:
 * - Track List: Full zoom/pan with vertical scrolling (when cursor is in region)
 * - Top Ruler/Timeline: Horizontal zoom/pan sync only (vertical scroll blocked)
 * - Bottom Ruler/Minimap: No zoom/pan (static, vertical scroll blocked)
 *
 * REGION DETECTION IMPORTANCE:
 * Without cursor position detection, vertical scroll events would affect track list
 * even when scrolling over HUD regions (rulers, timeline), causing poor UX.
 * The coordinate conversion ensures scroll behavior is contextually appropriate.
 *
 * BENEFITS:
 * - Single source of truth (player viewport)
 * - Region-aware event routing prevents gesture conflicts
 * - No recursive update cycles
 * - Clean separation between DOM and Canvas interactions
 * - Maintainable gesture handling patterns
 */

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
  const [trackListBounds, setTrackListBounds] = useState<RegionBounds | null>(null);

  useEffect(() => {
    if (!currentAnimation || !animations[currentAnimation]) {
      return;
    }
    setSelectedTracks(animations[currentAnimation].tracks);
    updateDuration(animations[currentAnimation].duration);
  }, [currentAnimation, animations, updateDuration]);

  // Region-aware wheel event handler - prevents vertical scroll in HUD regions
  //
  // CRITICAL: We must detect which region the cursor is in because:
  // - DOM Track List (left side): Allow vertical scroll for track list navigation
  // - Canvas Track Region (right side): Allow vertical scroll for track list navigation
  // - HUD regions (rulers, timeline): Block vertical scroll to prevent unwanted behavior
  // - Without region detection, vertical scroll leaks into HUD areas causing UX issues
  const handleCanvasWheel = useCallback(
    (event: any) => {
      // Canvas wheel events have different signature than React wheel events
      if (!canvasRef.current || !trackListBounds) return;

      // For modifier keys (zoom), let gesture system handle it
      if (event.ctrlKey || event.metaKey) {
        return; // Gesture system will handle zoom
      }

      // Check if cursor is over DOM track list (left side, outside Canvas)
      const trackListRect = trackRegionElement.current?.getBoundingClientRect();
      const isInDOMTrackList =
        trackListRect &&
        event.clientX >= trackListRect.left &&
        event.clientX <= trackListRect.right &&
        event.clientY >= trackListRect.top &&
        event.clientY <= trackListRect.bottom;

      // Check if cursor is over Canvas track region (right side, inside Canvas)
      const rect = canvasRef.current.getBoundingClientRect();
      const worldX = event.clientX - rect.left - rect.width / 2;
      const worldY = rect.height / 2 - (event.clientY - rect.top);

      // Calculate Canvas track region boundaries in world coordinates
      const trackLeft = trackListBounds.position.x - trackListBounds.dimensions.width / 2;
      const trackRight = trackListBounds.position.x + trackListBounds.dimensions.width / 2;
      const trackTop = trackListBounds.position.y + trackListBounds.dimensions.height / 2;
      const trackBottom = trackListBounds.position.y - trackListBounds.dimensions.height / 2;

      const isInCanvasTrackRegion =
        worldX >= trackLeft && worldX <= trackRight && worldY <= trackTop && worldY >= trackBottom;

      // Allow scroll updates if cursor is in either track area
      const isInAnyTrackArea = isInDOMTrackList || isInCanvasTrackRegion;

      // 🐛 DEBUG: Log region detection results
      // console.log("🎯 Region Detection:", {
      //   clientX: event.clientX,
      //   clientY: event.clientY,
      //   isInDOMTrackList,
      //   isInCanvasTrackRegion,
      //   isInAnyTrackArea,
      //   deltaY: event.deltaY,
      //   isVerticalScroll: Math.abs(event.deltaY) > Math.abs(event.deltaX),
      // });

      // Handle vertical scroll - only allow in track areas to prevent HUD interference
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        if (isInAnyTrackArea && currentAnimation && animations[currentAnimation]) {
          const tracks = animations[currentAnimation].tracks;
          const contentHeight = tracks.length * 36; // 36px per track
          const visibleHeight = height - MIN_SHEET_HEIGHT;
          const maxScroll = Math.max(0, contentHeight - visibleHeight);

          const currentScroll = scrollY.get();
          const boundedScroll = Math.max(
            0,
            Math.min(maxScroll, currentScroll + event.deltaY * 0.5),
          );

          // Debugging logging
          // console.log("✅ SCROLL ALLOWED:", {
          //   currentScroll,
          //   boundedScroll,
          //   contentHeight,
          //   visibleHeight,
          //   maxScroll,
          // });

          scrollY.set(boundedScroll);
        }
        // Always prevent default to block unwanted vertical scroll in HUD regions
        // This ensures rulers, timeline, and minimap don't scroll when not intended
        event.preventDefault();
        event.stopPropagation();
      }
      // Horizontal scroll passes through to gesture handler
    },
    [scrollY, currentAnimation, animations, height, trackListBounds],
  );

  const [trackRegion, _trackBounds] = useMeasure();
  const trackRegionElement = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
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
          <div
            ref={canvasRef}
            className={clsx("w-full min-w-0 row-span-5 touch-none", TRACK_MAIN_BG)}
          >
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
                {/* Main Scene Camera Controller - TEMPORARILY DISABLED TO TEST NATURAL R3F BEHAVIOR */}
                {/* <MainSceneCameraController /> */}

                {/* Gesture-only camera for pan/zoom without resize interference */}
                <GestureOnlyCamera enabled />

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

                {/* Bounds provider - gets layout bounds and updates state */}
                <BoundsProvider onBoundsChange={setTrackListBounds} />
              </LayoutProvider>
            </Canvas>
            <CanvasGestureHandler canvasRef={canvasRef} bounds={trackListBounds} />
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

// Bounds provider component - runs inside LayoutProvider and updates parent state
function BoundsProvider({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: RegionBounds | null) => void;
}): ReactNode {
  const trackListBounds = useRegion(DATA_VISUALIZATION_REGIONS.TRACK_LIST);

  useEffect(() => {
    onBoundsChange(trackListBounds || null);
  }, [trackListBounds, onBoundsChange]);

  return null;
}

// Canvas gesture handler component - handles horizontal pan/zoom only
function CanvasGestureHandler({
  canvasRef,
  bounds,
}: {
  canvasRef: React.RefObject<HTMLDivElement>;
  bounds: RegionBounds | null;
}): ReactNode {
  // Set up horizontal zoom/pan gestures for the canvas
  useCanvasZoomGestures(canvasRef, {
    bounds: bounds || {
      position: { x: 0, y: 0 },
      dimensions: { width: 800, height: 400 },
      center: { x: 0, y: 0 },
    },
    enabled: Boolean(bounds),
  });

  return null;
}

const MemoizedInnerSheet3D = memo(InnerSheet3D);
