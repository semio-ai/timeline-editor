import type { ReactNode } from "react";
import { useMemo } from "react";
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
          // Forward wheel events through the shared MotionValue so scrolling
          // the track list also moves the canvas camera. Prevents ScrollArea
          // from handling independently.
          e.preventDefault();
          e.stopPropagation();
          const contentHeight = sourceRows.length * 36; // trackHeight = 36px
          setTrackScroll(trackScrollMotion.get() + e.deltaY, {
            canvasHeight: height,
            contentHeight,
            topOffsetPx: 0,
            bottomOffsetPx: 0,
          });
        }}
      >
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
