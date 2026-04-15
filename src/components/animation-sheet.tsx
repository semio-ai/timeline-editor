import type { ReactNode } from "react";
import { useContext, memo, useState, useEffect, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMotionValue } from "motion/react";
import { clsx } from "clsx";
import { Search, Size, useTheme, TooltipProvider, TooltipContext } from "@semio/ui";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { TrackRender, VerticalAxis } from "../types";
import {
  useAnimationStore,
  ColorContextProvider,
  NameContextProvider,
  TrackAnimatableContextProvider,
  LocalGlobalTransformContextProvider,
} from "../hooks";
import { WithTooltipAndAnimationContextProps } from "../utils/context-providers";
import { MIN_SHEET_HEIGHT, SLOT_SIZE, SLOT_GAP } from "../constants";
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
import { ToolbarWrapper } from "./toolbar/toolbar-wrapper";
import { WorkspaceToolbarSection } from "./toolbar/workspace-toolbar-section";
import { TrackFilterToggles } from "./track-filter-toggles";

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
  const animationStore = useContext(AnimationContext);

  const initialViewId = useMemo(() => `view-${crypto.randomUUID()}`, []);
  const {
    addView,
    removeView,
    setActiveEditorView,
    updateView,
    editorViews,
    editorViewOrder,
    activeEditorViewId,
  } = useAnimationStore(
    useShallow((state) => ({
      addView: state.addView,
      removeView: state.removeView,
      setActiveEditorView: state.setActiveEditorView,
      updateView: state.updateView,
      editorViews: state.editorViews,
      editorViewOrder: state.editorViewOrder,
      activeEditorViewId: state.activeEditorViewId,
    })),
  );

  const viewIds = useMemo(
    () => editorViewOrder.filter((id) => Boolean(editorViews[id])),
    [editorViewOrder, editorViews],
  );
  const activeViewId = useMemo(() => {
    if (activeEditorViewId && editorViews[activeEditorViewId]) {
      return activeEditorViewId;
    }
    return viewIds[0];
  }, [activeEditorViewId, editorViews, viewIds]);
  const resolvedViewId = activeViewId ?? viewIds[0] ?? initialViewId;
  const trackFilter = editorViews[resolvedViewId]?.trackFilter ?? "";

  useEffect(() => {
    if (viewIds.length === 0) {
      const currentViews = animationStore?.getState().editorViews;
      if (currentViews && Object.keys(currentViews).length > 0) {
        return;
      }
      addView({
        id: initialViewId,
        name: "View 1",
        trackRender: TrackRender.Key,
        verticalAxis: VerticalAxis.Normalized,
        hiddenSourceTrackIds: [],
        trackFilter: "",
      });
      return;
    }
    if (activeViewId && activeEditorViewId !== activeViewId) {
      setActiveEditorView(activeViewId);
    }
  }, [
    activeEditorViewId,
    activeViewId,
    addView,
    animationStore,
    initialViewId,
    setActiveEditorView,
    viewIds,
  ]);

  const scrollY = useMotionValue(0);

  const [emphasis, setEmphasis] = useState<string[]>([]);
  const setTrackFilter = useCallback(
    (value: string) => {
      updateView(resolvedViewId, { trackFilter: value });
    },
    [resolvedViewId, updateView],
  );

  const handleSelectView = useCallback(
    (viewId: string) => {
      setActiveEditorView(viewId);
    },
    [setActiveEditorView],
  );

  const handleCreateView = useCallback(() => {
    const nextId = `view-${crypto.randomUUID()}`;
    const activeView = editorViews[resolvedViewId];
    const existingNames = new Set(
      viewIds.map((id) => editorViews[id]?.name).filter((name): name is string => Boolean(name)),
    );

    let nextIndex = 1;
    let nextName = `View ${String(nextIndex)}`;
    while (existingNames.has(nextName)) {
      nextIndex += 1;
      nextName = `View ${String(nextIndex)}`;
    }

    addView({
      id: nextId,
      name: nextName,
      trackRender: activeView?.trackRender ?? TrackRender.Key,
      verticalAxis: activeView?.verticalAxis,
      // New views inherit render preferences but always start with a clean visibility/search state.
      hiddenSourceTrackIds: [],
      trackFilter: "",
    });
    setActiveEditorView(nextId);
  }, [addView, editorViews, resolvedViewId, setActiveEditorView, viewIds]);

  const handleCopyView = useCallback(
    (sourceViewId: string) => {
      if (!viewIds.includes(sourceViewId)) return;
      const sourceView = editorViews[sourceViewId];
      if (!sourceView) return;

      const nextId = `view-${crypto.randomUUID()}`;
      const sourceIndex = viewIds.indexOf(sourceViewId);
      const fallbackSourceName = sourceIndex >= 0 ? `View ${String(sourceIndex + 1)}` : "View";
      const sourceName = sourceView.name?.trim() || fallbackSourceName;
      const existingNames = new Set(
        viewIds.map((id) => editorViews[id]?.name).filter((name): name is string => Boolean(name)),
      );

      let candidateName = `${sourceName} Copy`;
      let copyIndex = 2;
      while (existingNames.has(candidateName)) {
        candidateName = `${sourceName} Copy ${String(copyIndex)}`;
        copyIndex += 1;
      }

      addView({
        id: nextId,
        name: candidateName,
        trackRender: sourceView.trackRender,
        verticalAxis: sourceView.verticalAxis,
        hiddenSourceTrackIds: [...(sourceView.hiddenSourceTrackIds ?? [])],
        trackFilter: sourceView.trackFilter ?? "",
      });
      setActiveEditorView(nextId);
    },
    [addView, editorViews, setActiveEditorView, viewIds],
  );

  const handleRemoveView = useCallback(
    (viewId: string) => {
      if (viewIds.length <= 1 || !viewIds.includes(viewId)) return;
      removeView(viewId);
    },
    [removeView, viewIds],
  );

  const { sourceRowLookup, sourceRows, tracks, animatables } = useAnimationStore(
    useShallow((state) => ({
      sourceRowLookup: normalizeVisibleSourceRowIds(
        state.sourceRowIdsByView[resolvedViewId] ?? state.sourceRowIds,
      ),
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
            <div className="animation-sheet-container pointer-events-auto w-full">
              {/* Grid layout with tracking divs - same structure as original */}
              <div
                aria-expanded={expanded}
                style={{
                  height,
                  minHeight: MIN_SHEET_HEIGHT,
                }}
                className={clsx(
                  "group/sheet grid w-full grid-cols-[317px_1fr] overflow-hidden pr-0.5 pb-0.5",
                  "grid-rows-[36px_36px_minmax(0,1fr)_36px_36px_36px]",
                )}
              >
                {/* Toolbar - Row 1 (Left) */}
                <ToolbarWrapper rightPadding={8}>
                  <WorkspaceToolbarSection
                    viewIds={viewIds}
                    activeViewId={resolvedViewId}
                    onSelectView={handleSelectView}
                    onCreateView={handleCreateView}
                    onCopyView={handleCopyView}
                    onRemoveView={handleRemoveView}
                    onToggleExpand={onToggleExpand}
                    expanded={expanded}
                  />
                </ToolbarWrapper>

                {/* Toolbar - Row 1 (Right) */}
                <Toolbar
                  viewId={resolvedViewId}
                  viewIds={viewIds}
                  onSelectView={handleSelectView}
                  onCreateView={handleCreateView}
                  onCopyView={handleCopyView}
                  onRemoveView={handleRemoveView}
                  onToggleExpand={onToggleExpand}
                  expanded={expanded}
                />

                {/* Track Filter - Row 2: uses the shared 7-column grid */}
                <div
                  className="h-9 items-center py-0.5 pl-1 pr-3"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `1fr 1fr auto repeat(4, ${String(SLOT_SIZE)}px)`,
                    gap: `${String(SLOT_GAP)}px`,
                  }}
                >
                  <div className="col-span-3 min-w-0">
                    <Search
                      size={Size.Sm}
                      value={trackFilter}
                      placeholder="Filter visible tracks"
                      onChange={(value) => setTrackFilter(value)}
                      outline="hidden"
                      className="rounded-xs bg-neutral-500/10 hover:bg-neutral-500/25"
                      wrapperClassName="w-full"
                    />
                  </div>
                  <TrackFilterToggles />
                </div>

                {/* Canvas (spans all rows) */}
                <div
                  className={clsx(
                    "row-span-5 w-full min-w-0 touch-none overflow-clip rounded-md",
                    TRACK_MAIN_BG,
                  )}
                >
                  <CanvasSheet
                    viewId={resolvedViewId}
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

                {/* Timeline Control - Row 4 */}
                <div
                  className="pl-1 pr-3"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `1fr repeat(3, ${String(SLOT_SIZE)}px)`,
                    gap: `${String(SLOT_GAP)}px`,
                    alignItems: "center",
                  }}
                >
                  <TimelineControl viewId={resolvedViewId} />
                </div>

                {/* Timeline View - Row 4 */}

                {/* Time Controls - Row 5 */}
                <div
                  className="pl-1 pr-3"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `1fr repeat(3, ${String(SLOT_SIZE)}px)`,
                    gap: `${String(SLOT_GAP)}px`,
                    alignItems: "center",
                  }}
                >
                  <TimeControls />
                </div>

                {/* Minimap View - Row 5 */}

                {/* Playback Settings - Row 6 */}
                <div
                  className="pl-1 pr-3"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `1fr repeat(3, ${String(SLOT_SIZE)}px)`,
                    gap: `${String(SLOT_GAP)}px`,
                    alignItems: "center",
                  }}
                >
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
