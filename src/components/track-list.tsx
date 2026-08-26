import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ScrollArea } from "@semio/ui";
import { AnimatePresence, motion } from "motion/react";
import { useAnimationStore } from "../hooks";
import { AnimationData } from "../store-types";
import type { SourceRow, VisibleSourceRowIds } from "../types";
import { SIDEBAR_WIDTH } from "../constants";
import { normalizeVisibleSourceRowIds } from "../functions/filter-visible-source-row-ids";
import { computeAncestorIsLast } from "../functions/compute-ancestor-is-last";
import { trackScrollMotion, setTrackScroll } from "../viewport-state";
import { TrackControl } from "./track-control";
import { TrackMenuProvider } from "./track-menu-context";

export interface TrackListProps {
  height?: number;
  rowIdLookup?: VisibleSourceRowIds;
}

export function TrackList({ height = 240, rowIdLookup }: TrackListProps): ReactNode {
  const sourceRowIdLookup = useAnimationStore(
    useShallow(
      (state: AnimationData) => rowIdLookup ?? normalizeVisibleSourceRowIds(state.sourceRowIds),
    ),
  );

  const flatRowIds = sourceRowIdLookup.flat;

  const instancedTrackSources = useAnimationStore(
    useShallow((state: AnimationData) => state.instancedTrackSources),
  );

  const sourceRows = useMemo(
    () =>
      flatRowIds
        .map((id) => instancedTrackSources[id])
        .filter((row): row is SourceRow => Boolean(row)),
    [flatRowIds, instancedTrackSources],
  );

  // Compute ancestor chain for tree connector lines
  const ancestorMap = useMemo(
    () => computeAncestorIsLast(flatRowIds, instancedTrackSources),
    [flatRowIds, instancedTrackSources],
  );

  // Shared track-scroll MotionValue: drives both the ScrollArea here and
  // the canvas camera Y in non-spline modes.

  // Forward wheel events through the shared MotionValue, so scrolling the track list
  // moves the canvas camera and the list together, and the ScrollArea does not also
  // scroll itself.
  //
  // A native listener registered `{ passive: false }`, NOT React's `onWheel`. React
  // registers `wheel` (with `touchstart` and `touchmove`) passively on its root
  // container, and `preventDefault` is inert on a passive listener — the browser goes
  // ahead and scrolls. Both movements then apply: the viewport scrolls natively AND the
  // MotionValue advances by the same delta, so the list travels at roughly twice the
  // wheel, and the MotionValue's own write of `scrollTop` lands on top of the position
  // the native scroll already set. Two writers on one property is what makes the
  // scrolling feel elastic rather than merely fast.
  const wheelHostRef = useRef<HTMLDivElement>(null);
  const rowCount = sourceRows.length;
  useEffect(() => {
    const el = wheelHostRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setTrackScroll(trackScrollMotion.get() + event.deltaY, {
        canvasHeight: height,
        // 36 is the track row height, spelled here rather than shared. The runtime
        // authority is `ROW_HEIGHT` in `canvas-sheet.tsx`, which is module-private; it
        // is also re-spelled as a default in `tracks-renderer` and `use-edge-scroll`.
        // If the rows ever change size, this clamp goes wrong before anything visible
        // does, and none of the four copies will be flagged.
        contentHeight: rowCount * 36,
        topOffsetPx: 0,
        bottomOffsetPx: 0,
      });
    };
    // Capture phase, so this runs before the listener Base UI puts on the scroll area's
    // own scrollbar. That one is registered on the scrollbar element itself and writes
    // `scrollTop` imperatively, so it fires in the target phase — ahead of any
    // bubble-phase handler out here — and `preventDefault` does not undo an imperative
    // write. A wheel over the ~10px gutter would otherwise move the list twice again,
    // which is the behaviour this listener exists to prevent. Capturing here stops the
    // event before it reaches the scrollbar at all.
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, [height, rowCount]);

  return (
    <TrackMenuProvider>
      <div
        style={{ width: SIDEBAR_WIDTH }}
        className={clsx(
          "relative h-full bg-neutral-100 dark:bg-black",
          "flex flex-col overflow-hidden",
        )}
      >
        <div ref={wheelHostRef} className="w-full overflow-hidden">
          <ScrollArea
            orientation="vertical"
            className="w-full"
            style={{ maxHeight: height }}
            motionScrollY={trackScrollMotion}
          >
            <div className="w-full">
              <AnimatePresence>
                {sourceRows.map((sourceRow) => (
                  <motion.div
                    key={sourceRow.id}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20, transition: { duration: 0.15, ease: "easeInOut" } }}
                  >
                    <TrackControl
                      sourceRow={sourceRow}
                      ancestorIsLast={ancestorMap.get(sourceRow.id) ?? []}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      </div>
    </TrackMenuProvider>
  );
}
