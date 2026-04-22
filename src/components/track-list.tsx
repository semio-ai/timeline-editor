import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ScrollArea } from "@semio/ui";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { useAnimationStore } from "../hooks";
import { AnimationData } from "../store-types";
import type { SourceRow, VisibleSourceRowIds } from "../types";
import { SIDEBAR_WIDTH } from "../constants";
import { normalizeVisibleSourceRowIds } from "../functions/filter-visible-source-row-ids";
import { computeAncestorIsLast } from "../functions/compute-ancestor-is-last";
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

  // Mirror the store's scrollOffset to a MotionValue for the ScrollArea
  const scrollMotion = useMotionValue(0);
  const scrollOffset = useAnimationStore(
    useShallow((state: AnimationData) => state.scrollOffset),
  );
  const setScrollOffset = useAnimationStore(
    useShallow((state) => state.setScrollOffset),
  );
  useEffect(() => {
    scrollMotion.set(scrollOffset);
  }, [scrollOffset, scrollMotion]);

  return (
    <TrackMenuProvider>
    <div
      style={{ width: SIDEBAR_WIDTH }}
      className={clsx(
        "relative h-full bg-neutral-100 dark:bg-black",
        "flex flex-col overflow-hidden",
      )}
    >
      <div
        className="w-full overflow-hidden"
        onWheel={(e) => {
          // Forward wheel events to the store so scrolling the track list
          // also updates the canvas. Prevents ScrollArea from handling
          // independently — all scroll goes through the shared store.
          e.preventDefault();
          e.stopPropagation();
          const contentHeight = sourceRows.length * 36; // trackHeight = 36px
          const visibleHeight = height;
          const scrollMax = Math.max(0, contentHeight - visibleHeight);
          const prev = scrollOffset;
          const next = Math.max(0, Math.min(scrollMax, prev + e.deltaY));
          if (next !== prev) {
            setScrollOffset(next);
          }
        }}
      >
        <ScrollArea
          orientation="vertical"
          className="w-full pr-1"
          style={{ maxHeight: height }}
          motionScrollY={scrollMotion}
        >
          <div className="w-full pr-1">
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
