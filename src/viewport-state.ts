import { MotionValue } from "motion/react";
import { usePlayerStore } from "@semio/utils";
import { useEffect, useState } from "react";

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

/**
 * Recenter the viewport on a stamp without resizing it.
 * Defaults to the player's current stamp.
 */
export function centerViewportOnStamp(stamp?: number): void {
  const s = stamp ?? usePlayerStore.getState().player.stamp;
  viewportMotion.set(getFittedViewport(s, viewportMotion.get()));
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
