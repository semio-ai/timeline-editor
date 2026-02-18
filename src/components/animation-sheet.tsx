import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect, useCallback, useId, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMotionValue } from "motion/react";
import { clsx } from "clsx";
import { Search, Size, useTheme, TooltipProvider, TooltipContext } from "@semio/ui";
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
import { MIN_SHEET_HEIGHT } from "../constants";
import {
  filterVisibleSourceRowIds,
  matchesSourceRowQuery,
  normalizeVisibleSourceRowIds,
} from "../functions/filter-visible-source-row-ids";
// Import existing components that we'll reuse for now
import { TimelineControl } from "./timeline-control";
import { TimeControls } from "./time-controls";
import { PlaybackSettings } from "./playback-settings";
import { TrackList } from "./track-list";
import { CanvasSheet } from "./canvas-sheet/canvas-sheet";
import { Toolbar } from "./toolbar";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";

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
  const updateView = useAnimationStore(useShallow((state) => state.updateView));
  const trackFilter = useAnimationStore(
    useShallow((state) => state.editorViews[viewId]?.trackFilter ?? ""),
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

  const scrollY = useMotionValue(0);

  const [emphasis, setEmphasis] = useState<string[]>([]);
  const setTrackFilter = useCallback(
    (value: string) => {
      updateView(viewId, { trackFilter: value });
    },
    [updateView, viewId],
  );

  const { sourceRowLookup, sourceRows, tracks, animatables } = useAnimationStore(
    useShallow((state) => ({
      sourceRowLookup: normalizeVisibleSourceRowIds(state.sourceRowIds),
      sourceRows: state.instancedTrackSources,
      tracks: state.tracks,
      animatables: state.animatables,
    })),
  );

  const filteredRowLookup = useMemo(
    () =>
      filterVisibleSourceRowIds(sourceRowLookup, trackFilter, (rowId, query) =>
        matchesSourceRowQuery(rowId, query, {
          sourceRows,
          tracks,
          animatables,
        }),
      ),
    [animatables, sourceRowLookup, sourceRows, trackFilter, tracks],
  );

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

                {/* Track Filter - Row 2 */}
                <div className="h-9 px-1.5 py-0.5 flex items-center">
                  <div className="w-full flex">
                    <Search
                      size={Size.Sm}
                      value={trackFilter}
                      placeholder="Filter visible tracks"
                      onChange={(value) => setTrackFilter(value)}
                      outline="hidden"
                      className="bg-neutral-500/10 hover:bg-neutral-500/25 rounded-xs"
                      wrapperClassName="w-full"
                    />
                  </div>
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
                    rowIdLookup={filteredRowLookup}
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
                  rowIdLookup={filteredRowLookup}
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
