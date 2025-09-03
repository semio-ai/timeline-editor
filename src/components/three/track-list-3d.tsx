import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";
import { ScrollArea } from "@semio/ui";
import { MotionValue } from "motion/react";
import { useAnimationStore } from "../../hooks";
import { AnimationInstanceSettings, TrackRender } from "../../types";
import { ControlWidget } from "../control-widget";

export interface TrackList3DProps {
  animationId: string;
  namespaceId: string;
  instanceSettings: AnimationInstanceSettings;
  trackRender: TrackRender;
  height?: number;
  scrollY?: MotionValue<number>;
  emphasis: string[];
  onEmphasisChange?: (id: string, opt: "add" | "remove") => void;
  expanded: string[];
  onExpandedChange?: (id: string, opt: "expand" | "collapse") => void;
}

export function TrackList3D({
  animationId,
  namespaceId,
  instanceSettings,
  trackRender: _trackRender,
  height = 240,
  scrollY,
  emphasis = [],
  onEmphasisChange = () => {},
  expanded = [],
  onExpandedChange = () => {},
}: TrackList3DProps): ReactNode {
  const tracks = useAnimationStore(
    useShallow((state) => Array.from(state.animations[animationId]?.tracks || [])),
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
          {tracks.map((trackId) => (
            <ControlWidget
              key={trackId}
              animationId={animationId}
              trackId={trackId}
              namespace={namespaceId}
              instanceSettings={instanceSettings}
              onExpandedChange={(v) => onExpandedChange(trackId, v ? "expand" : "collapse")}
              emphasis={emphasis.includes(trackId)}
              onEmphasisChange={(v) => onEmphasisChange(trackId, v ? "add" : "remove")}
              expanded={expanded.includes(trackId)}
            />
          ))}
        </ScrollArea>
      </div>
    </div>
  );
}
