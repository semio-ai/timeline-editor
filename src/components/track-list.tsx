import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ScrollArea } from "@semio/ui";
import { AnimatePresence, MotionValue, motion } from "motion/react";
import { useAnimationStore } from "../hooks";
import { AnimationData } from "../store-types";
import { ControlWidget } from "./control-widget";

export interface TrackListProps {
  height?: number;
  scrollY?: MotionValue<number>;
  emphasis: string[];
  onEmphasisChange?: (id: string, opt: "add" | "remove") => void;
}

const defaultRowIds: string[] = [];
const defaultRowLookup = { flat: defaultRowIds, spline: defaultRowIds };

function normalizeRowLookup(rows: AnimationData["sourceRowIds"] | undefined): {
  flat: string[];
  spline: string[];
} {
  if (!rows) return defaultRowLookup;
  if (Array.isArray(rows)) {
    return { flat: rows, spline: rows };
  }
  return rows;
}

export function TrackList({
  height = 240,
  scrollY,
  emphasis = [],
  onEmphasisChange = () => {},
}: TrackListProps): ReactNode {
  const sourceRowIdLookup = useAnimationStore(
    useShallow((state: AnimationData) => normalizeRowLookup(state.sourceRowIds)),
  );

  const flatRowIds = sourceRowIdLookup.flat;

  const sourceRows = useAnimationStore(
    useShallow((state: AnimationData) => flatRowIds.map((id) => state.instancedTrackSources[id])),
  );

  return (
    <div
      className={clsx(
        "relative h-full w-[300px] dark:bg-black bg-neutral-100",
        "flex flex-col not-group-aria-expanded/sheet:hidden",
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
          className="pr-1 w-full"
          style={{ maxHeight: height }}
          motionScrollY={scrollY}
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
                  <ControlWidget
                    sourceRow={sourceRow}
                    emphasis={emphasis.includes(sourceRow.id)}
                    onEmphasisChange={(v) => onEmphasisChange(sourceRow.id, v ? "add" : "remove")}
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
