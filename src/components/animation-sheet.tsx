import type { ReactNode } from "react";
import { useContext, memo, useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { Search, Size, useTheme, TooltipProvider, TooltipContext } from "@semio/ui";
import { KeybindingProvider } from "@semio/ui";
import { AnimationContext } from "../context";
import { useDefaultAnimationStore } from "../store";
import { animationKeybindings } from "../keybindings";
import { TrackRender, VerticalAxis } from "../types";
import {
  useAnimationStore,
  useBlurInputsOnCanvasPointerDown,
  ColorContextProvider,
  NameContextProvider,
  TrackAnimatableContextProvider,
  LocalGlobalTransformContextProvider,
} from "../hooks";
import { WithTooltipAndAnimationContextProps } from "../utils/context-providers";
import {
  MIN_SHEET_HEIGHT,
  SLOT_SIZE,
  SLOT_GAP,
  SIDEBAR_WIDTH,
  SCROLLBAR_GUTTER,
} from "../constants";
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
import { TimelineCanvas, TracksCanvas, MinimapCanvas } from "./canvas-sheet/canvas-sheet";
import { preloadAnimationFonts } from "./canvas-sheet/preload-fonts";
import { Toolbar } from "./toolbar";
import { ToolbarWrapper } from "./toolbar/toolbar-wrapper";
import { WorkspaceToolbarSection } from "./toolbar/workspace-toolbar-section";
import { TrackFilterToggles } from "./track-filter-toggles";

const TRACK_MAIN_BG = "dark:bg-[#202020] bg-[#efefef]";

// Tunables for the main-canvas resize blur (see useEffect in AnimationSheet).
// MAIN_RESIZE_SETTLE_MS must exceed the TracksCanvas `resize.debounce` (in
// canvas-sheet.tsx, currently 100ms) so the blur lifts AFTER the crisp new
// content is rendered, not before. ~80ms buffer = one repaint frame.
const MAIN_BLUR_PX = 4;
// Horizontal-resize blur is subtler than vertical: width stretches affect
// thin vertical features (playhead line, tick marks, stamp text glyphs)
// rather than full rows, so a lighter touch is enough to mask the distortion
// while still signaling the intermediate state.
const HORIZONTAL_BLUR_PX = 2;
const MAIN_BLUR_FADE_MS = 80;
const MAIN_RESIZE_SETTLE_MS = 180;
const MAIN_RESIZE_DELTA_THRESHOLD_PX = 2;

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

  // The default animation store does not init its subscriptions at module
  // load, which would duplicate them when an app also creates its own
  // animation store (e.g. the studio's composite store), both reacting to
  // every playhead move. Standalone usage that falls back to the default store
  // initializes here on mount and cleans up on unmount. The store's
  // `initAnimationSubscriptions` is idempotent (clears any existing
  // cleanup before re-initing), so StrictMode double-mount is safe.
  useEffect(() => {
    if (!needsAnimationContext) return;
    return useDefaultAnimationStore.getState().initAnimationSubscriptions();
  }, [needsAnimationContext]);

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

  // Canvas pointer interactions don't blur a focused DOM input on their own, so
  // global hotkeys (Delete on a selected key) would otherwise be swallowed by a
  // still-focused value/name field. See the hook for the full rationale.
  useBlurInputsOnCanvasPointerDown();

  // Sheet-wide reveal coordination. Canvas children mount only after fonts
  // have preloaded (avoids drei's <Text> Suspense unmount/remount cycle on
  // first paint). The outer wrapper stays at opacity 0 until the canvases
  // that hold the user-visible carts (timeline + minimap) have reported
  // their first valid measurement, so the user never sees a partial /
  // wrong-sized initial render.
  //
  // The tracks canvas isn't part of the gate: at MIN_SHEET_HEIGHT its grid
  // cell is 0 tall, R3F skips its render loop (useFrame doesn't fire), and
  // its ReadyGate would never report ready. Since it's invisible at 0
  // height, its readiness is moot — when the user expands the sheet, the
  // canvas's ResizeObserver fires and it renders normally without remount.
  //
  // All ready flags are sticky: once true, they stay true. Resizing the
  // sheet (height changes), font URL changes, or any other re-render does
  // NOT toggle them off — canvases never remount.
  const [fontsReady, setFontsReady] = useState(() => !fonts.mono && !fonts.ui);
  const [timelineCanvasReady, setTimelineCanvasReady] = useState(false);
  const [minimapCanvasReady, setMinimapCanvasReady] = useState(false);
  const onTimelineReady = useCallback(() => setTimelineCanvasReady(true), []);
  const onMinimapReady = useCallback(() => setMinimapCanvasReady(true), []);
  const sheetReady = fontsReady && timelineCanvasReady && minimapCanvasReady;

  // Main-canvas resize blur. While the sheet height is changing, the
  // TracksCanvas's debounced resize keeps the previous-sized framebuffer up
  // and CSS-stretches it to fit the new container. We apply a brief blur to
  // the wrapper during this window so the stretch reads as an intermediate
  // "preview" state, rather than letting aliased stretched content sit
  // visible until R3F catches up. Settle delay must exceed the TracksCanvas
  // resize.debounce so the blur lifts AFTER the crisp new content renders.
  //
  // Only the main canvas needs this: the top/bottom canvases have fixed
  // pixel heights (their grid rows are 36px each) so a sheet-height drag
  // doesn't resize them.
  const [isMainResizing, setIsMainResizing] = useState(false);
  // Tracked separately from `isMainResizing` because the CSS stretch only
  // applies when the sheet is GROWING (R3F's debounced canvas keeps its
  // old CSS footprint, so without an override the new container space sits
  // empty). On shrink we deliberately don't stretch — that would squish the
  // old content; instead the container clips it, which reads cleanly.
  const [isMainExpanding, setIsMainExpanding] = useState(false);
  const lastHeightRef = useRef(height);
  const resizeSettleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const delta = height - lastHeightRef.current;
    if (Math.abs(delta) < MAIN_RESIZE_DELTA_THRESHOLD_PX) return;
    lastHeightRef.current = height;
    setIsMainResizing(true);
    setIsMainExpanding(delta > 0);
    if (resizeSettleTimerRef.current !== null) {
      window.clearTimeout(resizeSettleTimerRef.current);
    }
    resizeSettleTimerRef.current = window.setTimeout(() => {
      setIsMainResizing(false);
      setIsMainExpanding(false);
      resizeSettleTimerRef.current = null;
    }, MAIN_RESIZE_SETTLE_MS);
  }, [height]);

  useEffect(
    () => () => {
      if (resizeSettleTimerRef.current !== null) {
        window.clearTimeout(resizeSettleTimerRef.current);
      }
    },
    [],
  );

  // Horizontal (width) resize blur. All three canvases CSS-stretch their
  // existing framebuffers during the shared 100ms R3F debounce — that's
  // what keeps them aligned across the resize window. The stretch
  // visibly distorts thin vertical features (playhead line, ticks, time
  // labels), so we apply a subtle blur to all three canvas wrappers
  // while the width is changing. Driven by a ResizeObserver on a stable
  // outer element (height-only changes are filtered out so a sheet drag
  // doesn't double-trigger the horizontal path).
  const widthObserveRef = useRef<HTMLDivElement>(null);
  const [isWidthResizing, setIsWidthResizing] = useState(false);
  const lastObservedWidthRef = useRef(0);
  const widthSettleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const el = widthObserveRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const newWidth = entries[0]?.contentRect.width ?? 0;
      // First observation seeds the baseline without triggering the blur.
      if (lastObservedWidthRef.current === 0) {
        lastObservedWidthRef.current = newWidth;
        return;
      }
      if (Math.abs(newWidth - lastObservedWidthRef.current) < MAIN_RESIZE_DELTA_THRESHOLD_PX) {
        return;
      }
      lastObservedWidthRef.current = newWidth;
      setIsWidthResizing(true);
      if (widthSettleTimerRef.current !== null) {
        window.clearTimeout(widthSettleTimerRef.current);
      }
      widthSettleTimerRef.current = window.setTimeout(() => {
        setIsWidthResizing(false);
        widthSettleTimerRef.current = null;
      }, MAIN_RESIZE_SETTLE_MS);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (widthSettleTimerRef.current !== null) {
        window.clearTimeout(widthSettleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!fonts.mono && !fonts.ui) {
      setFontsReady(true);
      return;
    }
    let cancelled = false;
    preloadAnimationFonts(fonts).then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Deps narrowed to the URLs only — `fonts` itself is typically a fresh
    // object literal at the call site (e.g. <AnimationSheet fonts={{...}}/>),
    // so depending on its identity would re-run the preload every parent
    // render even when the URLs haven't changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts.mono, fonts.ui]);

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
  // Read the active render mode for the main-canvas resize stretch decision.
  // Spline rescales content to fit available height, so on shrink the CSS
  // squish is a reasonable preview of the post-debounce render. Non-spline
  // modes stack fixed-height rows that should not squish — they clip instead.
  const resolvedTrackRender = editorViews[resolvedViewId]?.trackRender ?? TrackRender.Key;
  const shouldStretchMainCanvas =
    isMainResizing && (isMainExpanding || resolvedTrackRender === TrackRender.Spline);

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

  const expanded = height > MIN_SHEET_HEIGHT;

  return (
    <KeybindingProvider value={animationKeybindings}>
      <ColorContextProvider>
        <NameContextProvider>
          <TrackAnimatableContextProvider>
            <LocalGlobalTransformContextProvider>
              <div
                className="animation-sheet-container w-full"
                data-testid="animation-sheet"
                // Queryable readiness signal: present once `sheetReady` —
                // fonts + the timeline and minimap canvases — has flipped
                // (mirrors the opacity/pointer reveal below; the central
                // tracks canvas is not part of that gate). Browser tests wait
                // on this so interaction doesn't begin while the sheet's WebGL
                // canvases are still initializing and janking the main thread.
                data-sheet-ready={sheetReady ? "" : undefined}
                style={{
                  opacity: sheetReady ? 1 : 0,
                  // Block pointer interactions while the sheet is invisible
                  // so the pre-reveal layout can't intercept clicks/scroll.
                  pointerEvents: sheetReady ? "auto" : "none",
                  transition: "opacity 200ms ease-in",
                }}
              >
                {/* Grid layout with tracking divs - same structure as original.
                    `widthObserveRef` watches this element for width changes so
                    the horizontal-resize blur fires across all three canvas
                    wrappers in sync (height changes are filtered inside the
                    observer's callback). */}
                <div
                  ref={widthObserveRef}
                  aria-expanded={expanded}
                  style={{
                    height,
                    minHeight: MIN_SHEET_HEIGHT,
                    gridTemplateColumns: `${SIDEBAR_WIDTH + 2}px 1fr`,
                  }}
                  className={clsx(
                    "group/sheet grid w-full overflow-hidden pr-0.5 pb-0.5",
                    "grid-rows-[36px_36px_36px_minmax(0,1fr)_36px_36px]",
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

                  {/* Track Filter - Row 2: uses the shared 7-column grid.
                    Width and right padding mirror the track-list rows
                    (SIDEBAR_WIDTH + ControlRow's `pr-0.5`) so the four
                    toggle buttons align horizontally with the track list's
                    options/strip slots and the bottom-section button rows. */}
                  <div
                    className="h-9 items-center py-0.5 pl-1 pr-0.5"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `1fr 1fr auto repeat(4, ${String(SLOT_SIZE)}px) ${String(SCROLLBAR_GUTTER)}px`,
                      gap: `${String(SLOT_GAP)}px`,
                      width: SIDEBAR_WIDTH,
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

                  {/* Top canvas: ruler + timeline (rows 2-3, col 2).
                      `[&_canvas]:w-full!` mirrors the main canvas wrapper so
                      this canvas's DOM also fills the new container width
                      during the debounce window — keeps tick/playhead X
                      positions aligned with the main canvas across resize.
                      No `!h-full` needed: the row is fixed at 36px. */}
                  <div
                    className={clsx(
                      "w-full min-w-0 touch-none overflow-clip rounded-t-md [&_canvas]:w-full!",
                    )}
                    style={{
                      gridColumn: 2,
                      gridRow: "2 / span 2",
                      filter: isWidthResizing ? `blur(${String(HORIZONTAL_BLUR_PX)}px)` : undefined,
                      transition: `filter ${String(MAIN_BLUR_FADE_MS)}ms ease-out`,
                    }}
                  >
                    {fontsReady && (
                      <TimelineCanvas
                        viewId={resolvedViewId}
                        theme={resolvedTheme}
                        fonts={fonts}
                        onReady={onTimelineReady}
                      />
                    )}
                  </div>

                  {/* Timeline Control - Row 3 (left, paired with timeline in row 3 right) */}
                  <div
                    className="pl-1 pr-0.5"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `1fr repeat(3, ${String(SLOT_SIZE)}px) ${String(SCROLLBAR_GUTTER)}px`,
                      gap: `${String(SLOT_GAP)}px`,
                      alignItems: "center",
                      width: SIDEBAR_WIDTH,
                    }}
                  >
                    <TimelineControl viewId={resolvedViewId} />
                  </div>

                  {/* Track List - Row 4 (left) */}
                  <TrackList height={height - MIN_SHEET_HEIGHT} rowIdLookup={filteredRowLookup} />

                  {/* Main canvas: tracks + overlays (row 4, col 2).
                      The `[&_canvas]:!w-full [&_canvas]:!h-full` overrides
                      R3F's inline canvas style during the resize window —
                      without it, the debounced canvas keeps its old pixel
                      footprint and leaves new container space empty. The
                      browser then stretches the existing framebuffer to
                      fill, and the blur masks the stretch artifacts.
                      Applied on grow always; on shrink only in spline mode
                      (which rescales naturally) — non-spline shrink clips. */}
                  <div
                    className={clsx(
                      "w-full min-w-0 touch-none overflow-clip [&_canvas]:w-full!",
                      TRACK_MAIN_BG,
                      shouldStretchMainCanvas && "[&_canvas]:h-full!",
                    )}
                    style={{
                      gridColumn: 2,
                      gridRow: 4,
                      // Larger vertical-resize blur wins over the subtler
                      // horizontal blur if both are active (e.g. a sheet drag
                      // while the window is also being resized).
                      filter: isMainResizing
                        ? `blur(${String(MAIN_BLUR_PX)}px)`
                        : isWidthResizing
                          ? `blur(${String(HORIZONTAL_BLUR_PX)}px)`
                          : undefined,
                      transition: `filter ${String(MAIN_BLUR_FADE_MS)}ms ease-out`,
                    }}
                  >
                    {fontsReady && (
                      <TracksCanvas
                        viewId={resolvedViewId}
                        theme={resolvedTheme}
                        rowIdLookup={filteredRowLookup}
                      />
                    )}
                  </div>

                  {/* Time Controls - Row 5 */}
                  <div
                    className="pl-1 pr-0.5"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `1fr repeat(3, ${String(SLOT_SIZE)}px) ${String(SCROLLBAR_GUTTER)}px`,
                      gap: `${String(SLOT_GAP)}px`,
                      alignItems: "center",
                      width: SIDEBAR_WIDTH,
                    }}
                  >
                    <TimeControls />
                  </div>

                  {/* Bottom canvas: minimap + bottom ruler (rows 5-6, col 2).
                      `[&_canvas]:w-full!` mirrors the main canvas wrapper —
                      keeps the minimap horizontally aligned with the main
                      canvas across the resize debounce window. No `!h-full`:
                      the rows are fixed at 36px each. */}
                  <div
                    className={clsx(
                      "w-full min-w-0 touch-none overflow-clip rounded-b-md [&_canvas]:w-full!",
                    )}
                    style={{
                      gridColumn: 2,
                      gridRow: "5 / span 2",
                      filter: isWidthResizing ? `blur(${String(HORIZONTAL_BLUR_PX)}px)` : undefined,
                      transition: `filter ${String(MAIN_BLUR_FADE_MS)}ms ease-out`,
                    }}
                  >
                    {fontsReady && (
                      <MinimapCanvas theme={resolvedTheme} fonts={fonts} onReady={onMinimapReady} />
                    )}
                  </div>

                  {/* Playback Settings - Row 6 */}
                  <div
                    className="pl-1 pr-0.5"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `1fr repeat(3, ${String(SLOT_SIZE)}px) ${String(SCROLLBAR_GUTTER)}px`,
                      gap: `${String(SLOT_GAP)}px`,
                      alignItems: "center",
                      width: SIDEBAR_WIDTH,
                    }}
                  >
                    <PlaybackSettings />
                  </div>

                  {/* Bottom Ruler - Row 6 */}
                </div>
              </div>
            </LocalGlobalTransformContextProvider>
          </TrackAnimatableContextProvider>
        </NameContextProvider>
      </ColorContextProvider>
    </KeybindingProvider>
  );
}
