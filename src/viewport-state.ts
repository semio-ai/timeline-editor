import { MotionValue } from "motion/react";
import { useEffect, useState } from "react";
import { TrackRender } from "./types";

/**
 * Source-of-truth viewport for the animation timeline, in milliseconds.
 *
 * Module-level singleton so cameras, gestures, and the follow subscription
 * all see the same value without crossing the React boundary on every tick.
 *
 * Read directly with `viewportMotion.get()`, subscribe with
 * `useMotionValueEvent(viewportMotion, "change", cb)` (in React) or
 * `viewportMotion.on("change", cb)` (outside React). Writes go through
 * the helpers below.
 */
export const viewportMotion = new MotionValue<[number, number]>([0, 5000]);

/** Replace the entire viewport range. */
export function setViewport(start: number, end: number): void {
  viewportMotion.set([start, end]);
}

/**
 * Update one bound of the viewport, swapping start/end if they cross.
 * Mirrors the legacy `updatePlayerViewportBound` semantics.
 */
export function setViewportBound(bound: "start" | "end", time: number): void {
  const [start, end] = viewportMotion.get();
  if (bound === "start" && end <= time) {
    viewportMotion.set([end, time]);
  } else if (bound === "end" && start >= time) {
    viewportMotion.set([time, start]);
  } else if (bound === "start") {
    viewportMotion.set([time, end]);
  } else {
    viewportMotion.set([start, time]);
  }
}

/** Recenter the viewport on a stamp without resizing it. */
export function centerViewportOnStamp(stamp: number): void {
  viewportMotion.set(getFittedViewport(stamp, viewportMotion.get()));
}

/**
 * Adjusts the proposed viewport to keep it centered on the playhead.
 * Width is preserved; the window is translated so the playhead sits at
 * the center.
 */
export function getFittedViewport(
  playhead: number,
  proposedViewport: [number, number],
): [number, number] {
  const viewportWidth = proposedViewport[1] - proposedViewport[0];
  const proposedLeft = playhead - viewportWidth / 2;
  return [proposedLeft, proposedLeft + viewportWidth];
}

/**
 * React bridge that returns the current viewport as state and re-renders
 * on change. Use in JSX consumers that need to display viewport bounds
 * (e.g. the toolbar). Camera / gesture consumers should subscribe directly
 * to `viewportMotion` instead — they don't need a render.
 */
export function useViewport(): [number, number] {
  const [vp, setVp] = useState<[number, number]>(() => viewportMotion.get());
  useEffect(() => {
    return viewportMotion.on("change", (v) => setVp([v[0], v[1]]));
  }, []);
  return vp;
}

// ---------------------------------------------------------------------------
// Vertical axis: track scroll (non-spline) and spline camera Y (spline)
// ---------------------------------------------------------------------------

/**
 * Non-spline vertical scroll position in pixels. Bounded to the row stack
 * (clamped at write time when the bounds are known). Drives both the
 * track-list side panel scroll and the canvas camera Y in non-spline modes
 * — they share this MotionValue as a single source of truth.
 */
export const trackScrollMotion = new MotionValue<number>(0);

/**
 * Spline-mode camera Y bounds in world units. Free-form (no clamp), supports
 * vertical zoom. Initialized non-degenerate; the canvas reseeds on mount
 * once it knows its pixel size.
 */
export const splineCameraYMotion = new MotionValue<{ top: number; bottom: number }>({
  top: 100,
  bottom: -100,
});

/**
 * Monotonic counter signaling "reset vertical positioning to default."
 * The toolbar's Fit-to-Content button and the minimap's Fit-to-Viewport
 * menu item write this; the canvas subscribes and reacts based on its own
 * mode and size. Counter (rather than boolean) so repeated requests fire
 * the effect each time.
 */
export const verticalFitCounterMotion = new MotionValue<number>(0);

export interface VerticalPanContext {
  mode: TrackRender;
  canvasHeight: number;
  contentHeight: number;
  topOffsetPx: number;
  bottomOffsetPx: number;
}

/**
 * Mode-aware vertical pan. Spline mode shifts the camera Y in world units;
 * non-spline mode advances the track scroll in pixels, clamped to the row
 * stack.
 */
export function panVertical(deltaPx: number, ctx: VerticalPanContext): void {
  if (ctx.mode === TrackRender.Spline) {
    const cy = splineCameraYMotion.get();
    const frustumHeight = cy.top - cy.bottom;
    if (ctx.canvasHeight <= 0 || frustumHeight <= 0) return;
    const worldDelta = (deltaPx / ctx.canvasHeight) * frustumHeight;
    splineCameraYMotion.set({
      top: cy.top - worldDelta,
      bottom: cy.bottom - worldDelta,
    });
  } else {
    setTrackScroll(trackScrollMotion.get() + deltaPx, ctx);
  }
}

/**
 * Mode-aware vertical zoom. Only meaningful in spline mode; no-op
 * elsewhere. Caller is responsible for any factor clamping (zoom limits)
 * before calling.
 */
export function zoomVertical(
  factor: number,
  anchorClientY: number,
  ctx: { mode: TrackRender; canvasRect: DOMRect },
): void {
  if (ctx.mode !== TrackRender.Spline) return;
  const cy = splineCameraYMotion.get();
  const frustumHeight = cy.top - cy.bottom;
  if (frustumHeight <= 0) return;
  const relativeY = (anchorClientY - ctx.canvasRect.top) / ctx.canvasRect.height;
  const targetY = cy.top - relativeY * frustumHeight;
  const newHeight = frustumHeight / factor;
  splineCameraYMotion.set({
    top: targetY + newHeight * relativeY,
    bottom: targetY - newHeight * (1 - relativeY),
  });
}

/**
 * Set the non-spline track scroll directly. Clamps to row-stack bounds
 * if a context is supplied; falls back to a non-negative clamp otherwise.
 */
export function setTrackScroll(
  value: number,
  ctx?: { canvasHeight?: number; contentHeight?: number; topOffsetPx?: number; bottomOffsetPx?: number },
): void {
  if (!ctx || ctx.canvasHeight === undefined || ctx.contentHeight === undefined) {
    trackScrollMotion.set(Math.max(0, value));
    return;
  }
  const visible =
    ctx.canvasHeight - (ctx.topOffsetPx ?? 0) - (ctx.bottomOffsetPx ?? 0);
  const scrollMax = Math.max(0, ctx.contentHeight - visible);
  trackScrollMotion.set(Math.max(0, Math.min(scrollMax, value)));
}

/**
 * Reset spline camera Y to pixel-locked default given the canvas height.
 * Convenience for the canvas's own initial seeding and resize handling.
 */
export function resetSplineCameraY(canvasHeight: number): void {
  if (canvasHeight <= 0) return;
  splineCameraYMotion.set({ top: canvasHeight / 2, bottom: -canvasHeight / 2 });
}

/**
 * Signal that the active canvas should reset its vertical positioning to
 * default. Toolbar / context-menu callers fire this; the canvas subscribes
 * via `useMotionValueEvent(verticalFitCounterMotion, "change", …)` and
 * resets its own camera based on its own size and mode.
 */
export function requestVerticalFit(): void {
  verticalFitCounterMotion.set(verticalFitCounterMotion.get() + 1);
}

/**
 * React bridge for the track-list side panel: returns the current scroll
 * in pixels and re-renders on change.
 */
export function useTrackScroll(): number {
  const [v, setV] = useState<number>(() => trackScrollMotion.get());
  useEffect(() => trackScrollMotion.on("change", setV), []);
  return v;
}
