import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect, useCallback, useId, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMotionValue } from "motion/react";
import { clsx } from "clsx";
import {
  Select,
  Size,
  ToggleSquare,
  useTheme,
  TooltipProvider,
  TooltipContext,
  IconUniform,
  IconVectorBezier,
  IconVectorBezierHandles,
  IconVectorAngled,
  IconVectorFlat,
  IconGraphView,
  IconVectorBezierInsertSloped,
  IconVectorBezierInsertFlat,
  IconVerticalNormalize,
} from "@semio/ui";
import { IconArrowUpRight, IconChevronDown } from "@tabler/icons-react";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { StandardTransitionType, TrackRender, VerticalAxis } from "../types";
import { TransitionDirective } from "../store-types";
import {
  useAnimationStore,
  ColorContextProvider,
  NameContextProvider,
  TrackAnimatableContextProvider,
  LocalGlobalTransformContextProvider,
} from "../hooks";
import { WithTooltipAndAnimationContextProps } from "../utils/context-providers";
import { MIN_SHEET_HEIGHT } from "../constants";
// Import existing components that we'll reuse for now
import { TimelineControl } from "./timeline-control";
import { TimeControls } from "./time-controls";
import { PlaybackSettings } from "./playback-settings";
import { TrackList } from "./track-list";
import { CanvasSheet } from "./canvas-sheet/canvas-sheet";
import { Toolbar } from "./toolbar";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";
const INSERTION_METHODS = {
  Flat: "flat",
  Sloped: "sloped",
} as const;
type InsertionMethod = (typeof INSERTION_METHODS)[keyof typeof INSERTION_METHODS];

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
  const verticalAxis = views?.[viewId]?.verticalAxis || VerticalAxis.Normalized;

  // Define callbacks that update the view properties in the store;
  const updateView = useAnimationStore(useShallow((state) => state.updateView));
  const setPreferences = useAnimationStore(useShallow((state) => state.setPreferences));
  const setTrackRender = useCallback(
    (renderOption: TrackRender) => {
      updateView(viewId, { trackRender: renderOption });
    },
    [viewId, updateView],
  );
  const setVerticalAxis = useCallback(
    (vAxis: VerticalAxis) => {
      updateView(viewId, { verticalAxis: vAxis });
    },
    [viewId, updateView],
  );
  const setInsertionMethod = useCallback(
    (method: InsertionMethod) => {
      const useExplicit = method === INSERTION_METHODS.Sloped;
      setPreferences({
        newKeyDefaults: {
          transitions: {
            in: useExplicit ? TransitionDirective.ExplicitHandles : StandardTransitionType.Cubic,
            out: useExplicit ? TransitionDirective.ExplicitHandles : StandardTransitionType.Cubic,
          },
        },
      });
    },
    [setPreferences],
  );

  const state = useAnimationStore((s) => s);
  const defaultTransitions = state.preferences.newKeyDefaults.transitions;
  const insertionMethod =
    defaultTransitions.in === TransitionDirective.ExplicitHandles ||
    defaultTransitions.out === TransitionDirective.ExplicitHandles
      ? INSERTION_METHODS.Sloped
      : INSERTION_METHODS.Flat;

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
                  "grid-rows-[36px_36px_1fr_36px_36px_36px]",
                )}
              >
                {/* Toolbar - Row 1 */}
                <Toolbar viewId={viewId} onToggleExpand={onToggleExpand} expanded={expanded} />

                {/* Expand Toggle/Ruler - Row 2 */}
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

                  <div className="flex gap-2">
                    <Select
                      sizing="inner"
                      visuals="icons"
                      side="top"
                      size={Size.Sm}
                      value={trackRender}
                      onChange={(v) => {
                        setTrackRender(v as TrackRender);
                      }}
                      options={[
                        {
                          value: TrackRender.Key,
                          label: "Key View",
                          icon: <IconVectorFlat className="h-3/4 aspect-square" />,
                        },
                        {
                          value: TrackRender.Transition,
                          label: "Transition View",
                          icon: <IconVectorAngled className="h-3/4 aspect-square" />,
                        },
                        {
                          value: TrackRender.Preview,
                          label: "Preview View",
                          icon: <IconVectorBezier className="h-3/4 aspect-square" />,
                        },
                        {
                          value: TrackRender.Spline,
                          label: "Spline View",
                          icon: <IconVectorBezierHandles className="h-3/4 aspect-square" />,
                        },
                        {
                          value: TrackRender.Data,
                          label: "Data View (Coming Soon)",
                          icon: <IconGraphView className="h-3/4 aspect-square" />,
                          disabled: true,
                        },
                      ]}
                    />

                    <Select
                      sizing="inner"
                      visuals="icons"
                      side="top"
                      size={Size.Sm}
                      value={verticalAxis}
                      onChange={(t) => {
                        setVerticalAxis(t as VerticalAxis);
                      }}
                      options={[
                        {
                          value: VerticalAxis.Normalized,
                          label: "Normalized Y",
                          icon: <IconVerticalNormalize className="h-3/4 aspect-square" />,
                          disabled: trackRender !== TrackRender.Spline,
                        },
                        {
                          value: VerticalAxis.Uniform,
                          label: "Uniform Y",
                          icon: <IconUniform className="h-3/4 aspect-square" />,
                          disabled: trackRender !== TrackRender.Spline,
                        },
                      ]}
                    />
                    <Select
                      sizing="inner"
                      visuals="icons"
                      side="top"
                      size={Size.Sm}
                      value={insertionMethod}
                      onChange={(v) => {
                        setInsertionMethod(v as InsertionMethod);
                      }}
                      options={[
                        {
                          value: INSERTION_METHODS.Flat,
                          label: "Insert Flat Handles",
                          icon: <IconVectorBezierInsertFlat className="h-3/4 aspect-square" />,
                        },
                        {
                          value: INSERTION_METHODS.Sloped,
                          label: "Insert Tangent Handles",
                          icon: <IconVectorBezierInsertSloped className="h-3/4 aspect-square" />,
                        },
                      ]}
                    />
                  </div>

                  <ToggleSquare
                    sizing="inner"
                    size={Size.Sm}
                    value={popped}
                    onChange={(v) => {
                      setPopped(v);
                      console.log(JSON.stringify(state));
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

                {/* Track List with color-coded tracks */}
                <TrackList
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
                  <TimeControls />
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
