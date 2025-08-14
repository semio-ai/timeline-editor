import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMotionValue } from "motion/react";
import { clsx } from "clsx";
// import { Canvas } from "@react-three/fiber";
// import { Hud } from "@react-three/drei";
import {
  ToggleGroup,
  Size,
  ToggleSquare,
  IconPreviewView,
  useTheme,
  TooltipProvider,
  TooltipContext,
  TooltipHost,
} from "@semio/ui";
import { IconArrowUpRight, IconChevronDown, IconLine, IconTable } from "@tabler/icons-react";
import { AnimationContext } from "../../context";
import { useDefaultAnimationStore } from "../../store";
import { TrackRender, AnimationInstance } from "../../types";
import { useAnimationStore, ColorContextProvider, NameContextProvider } from "../../hooks";
import { WithTooltipAndAnimationContextProps } from "../../utils/context-providers";
// Import existing components that we'll reuse for now
import { TimelineControl } from "../timeline-control";
import { TimeControls } from "../time-controls";
import { PlaybackSettings } from "../playback-settings";
import { TrackList3D } from "./track-list-3d";
import { CanvasSheet } from "./canvas-sheet/canvas-sheet";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";
const MIN_SHEET_HEIGHT = 142;

export interface AnimationSheet3DProps extends WithTooltipAndAnimationContextProps {
  namespaceId: string;
  animationInstances: Record<string, AnimationInstance>;
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
}

export interface AnimationSheet3DCoreProps {
  namespaceId: string;
  animationInstances: Record<string, AnimationInstance>;
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
}

/**
 * Core AnimationSheet3D component that requires both AnimationContext and TooltipContext to be provided by parent components.
 *
 * Use this component when:
 * - You know both AnimationContext and TooltipContext are already provided by parent components
 * - You want to avoid automatic context provision (for performance or control)
 * - You're testing the component in isolation with known contexts
 * - You're building custom wrapper components with specific context management
 *
 * @example
 * ```tsx
 * // Use when both contexts are already provided
 * <AnimationContext.Provider value={myAnimationStore}>
 *   <TooltipProvider>
 *     <TooltipHost className="w-full h-full">
 *       <AnimationSheet3DCore
 *         namespaceId="demo"
 *         animationInstances={instances}
 *       />
 *     </TooltipHost>
 *   </TooltipProvider>
 * </AnimationContext.Provider>
 * ```
 *
 * @throws Error if AnimationContext is not provided by a parent component
 * @throws Error if TooltipContext is not provided by a parent component (required for 3D tooltips)
 */
export const AnimationSheet3DCore = memo(function AnimationSheet3DCore(
  props: AnimationSheet3DCoreProps,
): ReactNode {
  return <InnerSheet3D {...props} />;
});

/**
 * Full AnimationSheet3D component that automatically provides AnimationContext and TooltipContext if needed.
 * This is the main export that most consumers should use for 3D animation sheets.
 *
 * Context Behavior:
 * - **AnimationContext**: If not present, creates one with default animation store
 * - **TooltipContext**: If not present, creates TooltipProvider + TooltipHost for 3D tooltip support
 * - If contexts already exist, uses existing ones (no unnecessary nesting)
 * - Always wraps with TooltipHost for proper 3D tooltip positioning support
 *
 * @param skipAnimationContext - Skip providing animation context, assume parent provides it
 * @param skipTooltipContext - Skip providing tooltip context, assume parent provides it
 *
 * @example
 * ```tsx
 * // Automatic context provision (recommended for most cases)
 * <AnimationSheet3D namespaceId="demo" animationInstances={instances} />
 *
 * // Skip animation context when parent provides it
 * <AnimationContext.Provider value={myCustomStore}>
 *   <AnimationSheet3D
 *     skipAnimationContext
 *     namespaceId="demo"
 *     animationInstances={instances}
 *   />
 * </AnimationContext.Provider>
 *
 * // Skip tooltip context when parent provides it
 * <TooltipProvider>
 *   <AnimationSheet3D
 *     skipTooltipContext
 *     namespaceId="demo"
 *     animationInstances={instances}
 *   />
 * </TooltipProvider>
 *
 * // Skip both contexts (parent must provide both)
 * <AnimationContext.Provider value={myStore}>
 *   <TooltipProvider>
 *     <AnimationSheet3D
 *       skipAnimationContext
 *       skipTooltipContext
 *       namespaceId="demo"
 *       animationInstances={instances}
 *     />
 *   </TooltipProvider>
 * </AnimationContext.Provider>
 *
 * // Nested usage (inner components skip contexts)
 * <AnimationSheet3D namespaceId="outer" animationInstances={outer}>
 *   <AnimationSheet3D
 *     skipAnimationContext
 *     skipTooltipContext
 *     namespaceId="inner"
 *     animationInstances={inner}
 *   />
 * </AnimationSheet3D>
 * ```
 */
export const AnimationSheet3D = memo(function AnimationSheet3D({
  skipTooltipContext = false,
  skipAnimationContext = false,
  ...props
}: AnimationSheet3DProps): ReactNode {
  const animationCtx = useContext(AnimationContext);
  const tooltipCtx = useContext(TooltipContext);

  // Determine what contexts need to be provided
  const needsAnimationContext = !skipAnimationContext && !animationCtx;
  const needsTooltipContext = !skipTooltipContext && !tooltipCtx;

  let content = <AnimationSheet3DCore {...props} />;

  // Wrap with animation context if needed
  if (needsAnimationContext) {
    content = (
      <AnimationContext.Provider value={useDefaultAnimationStore}>
        {content}
      </AnimationContext.Provider>
    );
  }

  // Wrap with tooltip context if needed
  if (needsTooltipContext) {
    content = (
      <TooltipProvider>
        <TooltipHost className="w-full h-full">{content}</TooltipHost>
      </TooltipProvider>
    );
  } else if (needsAnimationContext) {
    // If we only need animation context, we still need TooltipHost for the 3D tooltips
    content = <TooltipHost className="w-full h-full">{content}</TooltipHost>;
  }

  return content;
});

function InnerSheet3D({
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
      <NameContextProvider>
        <div className="animation-sheet-container w-full">
          {/* Grid layout with tracking divs - same structure as original */}
          <div
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
              className={clsx(
                "w-full min-w-0 row-span-5 touch-none rounded-md overflow-clip",
                TRACK_MAIN_BG,
              )}
            >
              <CanvasSheet
                tracks={allTracks}
                animationId={currentAnimation}
                namespaceId={namespaceId}
                instanceSettings={instanceSettings}
                selection={selectedTracks}
                scrollValue={scrollY}
                theme={resolvedTheme}
                emphasis={emphasis}
                onEmphasisChange={setEmphasisSmart}
                fonts={fonts}
              />
            </div>

            {/* Track List - Row 2 */}

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
      </NameContextProvider>
    </ColorContextProvider>
  );
}
