import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ScrollArea } from "@semio/ui";
import { MotionValue } from "motion/react";
import { useAnimationStore } from "../hooks";
import { AnimationData } from "../store-types";
import { ControlWidget } from "./control-widget";

export interface TrackListProps {
  viewId: string;
  height?: number;
  scrollY?: MotionValue<number>;
  emphasis: string[];
  onEmphasisChange?: (id: string, opt: "add" | "remove") => void;
}

const defaultRowIds: string[] = [];

export function TrackList({
  viewId,
  height = 240,
  scrollY,
  emphasis = [],
  onEmphasisChange = () => {},
}: TrackListProps): ReactNode {
  const sourceRowIds = useAnimationStore(
    useShallow((state: AnimationData) => state.editorViews[viewId]?.sourceRowIds ?? defaultRowIds),
  );

  const sourceRows = useAnimationStore(
    useShallow((state: AnimationData) => sourceRowIds.map((id) => state.instancedTrackSources[id])),
  );

  return (
    <div
      className={clsx(
        "relative h-full w-[300px] dark:bg-black bg-neutral-100",
        "flex flex-col not-group-aria-expanded/sheet:hidden",
      )}
    >
      <div
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
          className="pr-1"
          style={{ maxHeight: height }}
          motionScrollY={scrollY}
        >
          {sourceRows.map((sourceRow) => (
            <ControlWidget
              key={sourceRow.id}
              sourceRow={sourceRow}
              emphasis={emphasis.includes(sourceRow.id)}
              onEmphasisChange={(v) => onEmphasisChange(sourceRow.id, v ? "add" : "remove")}
            />
          ))}
        </ScrollArea>
      </div>
    </div>
  );
}
