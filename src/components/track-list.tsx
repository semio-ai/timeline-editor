import type { ReactNode } from "react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ScrollArea } from "@semio/ui";
import { AnimatePresence, MotionValue, motion } from "motion/react";
import { useAnimationStore } from "../hooks";
import { AnimationData } from "../store-types";
import type { SourceRow, VisibleSourceRowIds } from "../types";
import { SIDEBAR_WIDTH } from "../constants";
import { normalizeVisibleSourceRowIds } from "../functions/filter-visible-source-row-ids";
import { computeAncestorIsLast } from "../functions/compute-ancestor-is-last";
import { TrackControl } from "./track-control";

export interface TrackListProps {
  height?: number;
  scrollY?: MotionValue<number>;
  rowIdLookup?: VisibleSourceRowIds;
}

export function TrackList({ height = 240, scrollY, rowIdLookup }: TrackListProps): ReactNode {
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

  return (
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
          // CRITICAL: Prevent ScrollArea from independently handling wheel events
          // ScrollArea should only respond to motionScrollY changes from canvas gesture system
          // This ensures all scroll behavior goes through region detection logic
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <ScrollArea
          orientation="vertical"
          className="w-full pr-1"
          style={{ maxHeight: height }}
          motionScrollY={scrollY}
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
  );
}
