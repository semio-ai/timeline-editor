import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect, useCallback, useId, useRef } from "react";
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
} from "@semio/ui";
import {
  IconArrowUpRight,
  IconChevronDown,
  IconLine,
  IconTable,
  IconVectorBezier2,
} from "@tabler/icons-react";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { TrackRender } from "../types";
import {
  useAnimationStore,
  ColorContextProvider,
  NameContextProvider,
  TrackAnimatableContextProvider,
  LocalGlobalTransformContextProvider,
} from "../hooks";
import { WithTooltipAndAnimationContextProps } from "../utils/context-providers";
// Import existing components that we'll reuse for now
import { TimelineControl } from "./timeline-control";
import { TimeControls } from "./time-controls";
import { PlaybackSettings } from "./playback-settings";
import { TrackList } from "./track-list";
import { CanvasSheet } from "./canvas-sheet/canvas-sheet";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";
const MIN_SHEET_HEIGHT = 142;

export interface AnimationSheetProps extends WithTooltipAndAnimationContextProps {
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
}

export interface AnimationSheetCoreProps {
  onToggleExpand?: (expanded: boolean) => void;
  height?: number;
  fonts?: {
    mono?: string; // Path to monospace font, falls back to system default
    ui?: string; // Path to UI font, falls back to system default
  };
}

/**
 * Core AnimationSheet component that requires both AnimationContext and TooltipContext to be provided by parent components.
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
 *       <AnimationSheetCore
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
export const AnimationSheetCore = memo(function AnimationSheetCore(
  props: AnimationSheetCoreProps,
): ReactNode {
  return <InnerSheet {...props} />;
});

/**
 * Full AnimationSheet component that automatically provides AnimationContext and TooltipContext if needed.
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
 * <AnimationSheet namespaceId="demo" animationInstances={instances} />
 *
 * // Skip animation context when parent provides it
 * <AnimationContext.Provider value={myCustomStore}>
 *   <AnimationSheet
 *     skipAnimationContext
 *     namespaceId="demo"
 *     animationInstances={instances}
 *   />
 * </AnimationContext.Provider>
 *
 * // Skip tooltip context when parent provides it
 * <TooltipProvider>
 *   <AnimationSheet
 *     skipTooltipContext
 *     namespaceId="demo"
 *     animationInstances={instances}
 *   />
 * </TooltipProvider>
 *
 * // Skip both contexts (parent must provide both)
 * <AnimationContext.Provider value={myStore}>
 *   <TooltipProvider>
 *     <AnimationSheet
 *       skipAnimationContext
 *       skipTooltipContext
 *       namespaceId="demo"
 *       animationInstances={instances}
 *     />
 *   </TooltipProvider>
 * </AnimationContext.Provider>
 *
 * // Nested usage (inner components skip contexts)
 * <AnimationSheet namespaceId="outer" animationInstances={outer}>
 *   <AnimationSheet
 *     skipAnimationContext
 *     skipTooltipContext
 *     namespaceId="inner"
 *     animationInstances={inner}
 *   />
 * </AnimationSheet>
 * ```
 */
export const AnimationSheet = memo(function AnimationSheet({
  skipTooltipContext = false,
  skipAnimationContext = false,
  ...props
}: AnimationSheetProps): ReactNode {
  const animationCtx = useContext(AnimationContext);
  const tooltipCtx = useContext(TooltipContext);

  // Determine what contexts need to be provided
  const needsAnimationContext = !skipAnimationContext && !animationCtx;
  const needsTooltipContext = !skipTooltipContext && !tooltipCtx;

  let content = <AnimationSheetCore {...props} />;

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
    content = <TooltipProvider>{content}</TooltipProvider>;
  }

  return content;
});

function InnerSheet({
  onToggleExpand,
  height = MIN_SHEET_HEIGHT,
  fonts = {},
}: AnimationSheetProps): ReactNode {
  const { resolvedTheme } = useTheme();

  // Manage view registration with animation store
  const viewInitialized = useRef(false);
  const viewId = useId();
  const [addView, removeView] = useAnimationStore(
    useShallow((state) => [state.addView, state.removeView]),
  );

  useEffect(() => {
    if (!viewInitialized.current) {
      viewInitialized.current = true;
      addView({ id: viewId, trackRender: TrackRender.Key });
    }
    return () => {
      viewInitialized.current = false;
      removeView(viewId);
    };
  }, [viewId, removeView, addView]);

  // Extract information from the view about trackRender and timeline sources;
  const views = useAnimationStore(useShallow((state) => state.editorViews));
  const trackRender = views?.[viewId]?.trackRender || TrackRender.Key;

  // Define callbacks that update the view properties in the store;
  const updateView = useAnimationStore(useShallow((state) => state.updateView));
  const setTrackRender = useCallback(
    (renderOption: TrackRender) => {
      updateView(viewId, { trackRender: renderOption });
    },
    [viewId, updateView],
  );

  const getAnimationsToSave = useAnimationStore(useShallow((state) => state.getAnimationsToSave));

  const scrollY = useMotionValue(0);

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

  const [popped, setPopped] = useState(false);

  const expanded = height > MIN_SHEET_HEIGHT;

  return (
    <ColorContextProvider>
      <NameContextProvider>
        <TrackAnimatableContextProvider>
          <LocalGlobalTransformContextProvider>
            <div className="animation-sheet-container w-full pointer-events-auto">
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
                        value: TrackRender.Spline,
                        label: "Spline View",
                        icon: <IconVectorBezier2 size="11px" className="-scale-x-100" />,
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
                    value={popped}
                    onChange={(v) => {
                      setPopped(v);
                      console.log(JSON.stringify(getAnimationsToSave()[0]));
                    }}
                    label="Pop Out"
                    // disabled
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
                    viewId={viewId}
                    scrollValue={scrollY}
                    theme={resolvedTheme}
                    emphasis={emphasis}
                    onEmphasisChange={setEmphasisSmart}
                    fonts={fonts}
                  />
                </div>

                {/* Track List - Row 2 */}

                {/* 3D Track List with color-coded tracks */}
                <TrackList
                  viewId={viewId}
                  height={height - MIN_SHEET_HEIGHT}
                  scrollY={scrollY}
                  emphasis={emphasis}
                  onEmphasisChange={setEmphasisSmart}
                />

                {/* Timeline Control - Row 3 */}
                <div className="pr-2">
                  <TimelineControl viewId={viewId} />
                </div>

                {/* Timeline View - Row 3 */}

                {/* Time Controls - Row 4 */}
                <div className="pr-2">
                  <TimeControls viewId={viewId} />
                </div>

                {/* Minimap View - Row 4 */}

                {/* Playback Settings - Row 5 */}
                <div className="pr-2">
                  <PlaybackSettings />
                </div>

                {/* Bottom Ruler - Row 5 */}
              </div>
            </div>
          </LocalGlobalTransformContextProvider>
        </TrackAnimatableContextProvider>
      </NameContextProvider>
    </ColorContextProvider>
  );
}
